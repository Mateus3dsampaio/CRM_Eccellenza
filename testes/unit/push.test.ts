import { beforeEach, describe, expect, it, vi } from "vitest";

// A biblioteca de push é trocada por uma falsa: nenhum aviso de verdade sai nos testes.
const enviados: { endpoint: string; corpo: string; opcoes: unknown }[] = [];
let falhaPara: Record<string, number> = {};
vi.mock("web-push", () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: "BPUBLICA".padEnd(87, "x"), privateKey: "PRIVADA".padEnd(43, "y") }),
    sendNotification: async (sub: { endpoint: string }, corpo: string, opcoes: unknown) => {
      if (falhaPara[sub.endpoint]) throw Object.assign(new Error("falhou"), { statusCode: falhaPara[sub.endpoint] });
      enviados.push({ endpoint: sub.endpoint, corpo, opcoes });
    },
  },
}));

import { db } from "@/lib/db";
import { montarAvisoPush, quemRecebePush, TRECHO_MAXIMO_PUSH } from "@/regras/push";
import { textoDoAlerta } from "@/regras/alertas";
import { registrarAlerta } from "@/servicos/alertas";
import { obterOuCriarLead } from "@/servicos/leads";
import { assinarPush, cancelarPush, chavesVapid, contatoVapid, enviarPushDeTeste, pushAtivo } from "@/servicos/push";
import { criarConsultores, limparBanco } from "./ajuda";

const sub = (n: string) => ({ endpoint: `https://push.exemplo.com/${n}`, keys: { p256dh: "p".repeat(20), auth: "a".repeat(20) } });

describe("avisos com o CRM fechado (regras)", () => {
  const destinos = [
    { usuarioId: "adm", perfil: "admin" },
    { usuarioId: "c1", perfil: "consultor" },
    { usuarioId: "c2", perfil: "consultor" },
  ];

  it("o admin recebe tudo; o consultor só os dos seus leads e nunca o de prazo vencido", () => {
    expect(quemRecebePush({ tipo: "mensagem", consultorId: "c1" }, destinos).sort()).toEqual(["adm", "c1"]);
    expect(quemRecebePush({ tipo: "mensagem", consultorId: null }, destinos)).toEqual(["adm"]);
    expect(quemRecebePush({ tipo: "prazo_vermelho", consultorId: "c1" }, destinos)).toEqual(["adm"]);
    expect(quemRecebePush({ tipo: "retorno", consultorId: "c2" }, destinos).sort()).toEqual(["adm", "c2"]);
  });

  it("mensagem nova: nome do cliente no título e o trecho embaixo, cortado no limite", () => {
    const a = { id: 7, tipo: "mensagem" as const, leadId: "L1", leadNome: "Ana Souza", consultorId: "c1", consultorNome: "Rafael", texto: "  Oi,   quero\numa cozinha  " };
    expect(montarAvisoPush(a, "c1", textoDoAlerta)).toEqual({ titulo: "Ana Souza", corpo: "Oi, quero uma cozinha", tag: "alerta-7", url: "/lead/L1" });
    const longo = montarAvisoPush({ ...a, texto: "palavra ".repeat(60) }, "c1", textoDoAlerta);
    expect(longo.corpo.length).toBeLessThanOrEqual(TRECHO_MAXIMO_PUSH);
    expect(longo.corpo.endsWith("…")).toBe(true);
    expect(montarAvisoPush({ ...a, texto: null }, "c1", textoDoAlerta).corpo).toBe("Nova mensagem");
  });

  it("os outros avisos usam o texto de sempre, do ponto de vista de quem recebe", () => {
    const a = { id: 8, tipo: "lead_passado" as const, leadId: "L2", leadNome: "Beto", consultorId: "c1", consultorNome: "Rafael", texto: null };
    expect(montarAvisoPush(a, "c1", textoDoAlerta).titulo).toBe("Beto foi passado para você");
    expect(montarAvisoPush(a, "adm", textoDoAlerta).titulo).toBe("Beto foi passado para Rafael");
  });
});

describe("avisos com o CRM fechado (envio)", () => {
  beforeEach(async () => {
    await limparBanco();
    enviados.length = 0;
    falhaPara = {};
  });

  async function cenario() {
    const [a, b] = await criarConsultores();
    const adm = await db.usuario.create({ data: { nome: "Adm", login: "adm", senhaHash: "x", perfil: "admin" } });
    await assinarPush(a.id, sub("a"));
    await assinarPush(b.id, sub("b"));
    await assinarPush(adm.id, sub("adm"));
    const lead = await obterOuCriarLead("+5588999990101", "Ana Souza");
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: a.id } });
    return { a, b, adm, lead };
  }

  it("mensagem nova vai para o dono do lead e para o admin, com nome e trecho; o outro consultor não recebe", async () => {
    const { lead } = await cenario();
    await registrarAlerta({ tipo: "mensagem", leadId: lead.id, texto: "Quero orçamento de closet" });
    await vi.waitFor(() => expect(enviados).toHaveLength(2));
    expect(enviados.map((e) => e.endpoint).sort()).toEqual(["https://push.exemplo.com/a", "https://push.exemplo.com/adm"]);
    expect(JSON.parse(enviados[0].corpo)).toMatchObject({ titulo: "Ana Souza", corpo: "Quero orçamento de closet", url: `/lead/${lead.id}` });
    expect(enviados[0].opcoes).toMatchObject({ urgency: "high", TTL: 3600 });
  });

  it("prazo vencido só vai para o admin", async () => {
    const { lead } = await cenario();
    await registrarAlerta({ tipo: "prazo_vermelho", leadId: lead.id, texto: "40 min" });
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0].endpoint).toBe("https://push.exemplo.com/adm");
  });

  it("usuário desativado não recebe, e navegador que o serviço diz que morreu (410) sai da lista", async () => {
    const { a, lead } = await cenario();
    falhaPara["https://push.exemplo.com/adm"] = 410;
    await db.usuario.update({ where: { id: a.id }, data: { ativo: false } });
    await registrarAlerta({ tipo: "mensagem", leadId: lead.id, texto: "oi" });
    await vi.waitFor(async () => expect(await db.assinaturaPush.count({ where: { endpoint: "https://push.exemplo.com/adm" } })).toBe(0));
    expect(enviados).toHaveLength(0);
    expect(await db.assinaturaPush.count()).toBe(2); // só o do admin saiu
  });

  it("assinar de novo o mesmo navegador passa ele para a pessoa que entrou; cancelar só vale para o dono", async () => {
    const [a, b] = await criarConsultores();
    await assinarPush(a.id, sub("x"));
    await assinarPush(b.id, sub("x")); // mesmo navegador, outra pessoa
    expect(await pushAtivo(a.id, sub("x").endpoint)).toBe(false);
    expect(await pushAtivo(b.id, sub("x").endpoint)).toBe(true);
    await cancelarPush(a.id, sub("x").endpoint); // não é dela: nada acontece
    expect(await pushAtivo(b.id, sub("x").endpoint)).toBe(true);
    await cancelarPush(b.id, sub("x").endpoint);
    expect(await db.assinaturaPush.count()).toBe(0);
  });

  it("as chaves do servidor são criadas uma vez e a privada fica criptografada no banco", async () => {
    const um = await chavesVapid();
    const dois = await chavesVapid();
    expect(um).not.toBeNull();
    expect(dois).toEqual(um);
    const guardada = await db.configuracao.findUniqueOrThrow({ where: { chave: "push_vapid_privada" } });
    expect(guardada.valor.startsWith("v1.")).toBe(true);
    expect(guardada.valor).not.toContain(um!.privada);
  });

  it("o teste do sino só manda para os navegadores de quem pediu", async () => {
    const { a } = await cenario();
    expect(await enviarPushDeTeste(a.id, 0)).toBe(1);
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0].endpoint).toBe("https://push.exemplo.com/a");
    expect(JSON.parse(enviados[0].corpo).titulo).toBe("Teste de aviso");
  });
});

describe("contato do servidor de avisos (a Apple recusa contato inválido)", () => {
  it("usa PUSH_CONTATO válido, senão o endereço público do Railway, senão um mailto válido; nunca domínio local", () => {
    vi.stubEnv("PUSH_CONTATO", "");
    vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", "crm-eccellenza.up.railway.app");
    expect(contatoVapid()).toBe("https://crm-eccellenza.up.railway.app");
    vi.stubEnv("PUSH_CONTATO", "mailto:mateus@loja.com.br");
    expect(contatoVapid()).toBe("mailto:mateus@loja.com.br");
    vi.stubEnv("PUSH_CONTATO", "mateus sem mailto");
    expect(contatoVapid()).toBe("https://crm-eccellenza.up.railway.app");
    vi.stubEnv("PUSH_CONTATO", "");
    vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", "");
    expect(contatoVapid()).toMatch(/^mailto:[^@]+@[^@]+\.com$/);
    expect(contatoVapid()).not.toMatch(/\.local$|localhost/);
    vi.unstubAllEnvs();
  });
});
