import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { apagarMidia } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { limparNomeParaCliente, nomeParaCliente, textoComNome } from "@/regras/nome-cliente";
import { responderComoConsultor, responderComoConsultorComArquivo } from "@/servicos/conversa";
import { transferirLead } from "@/servicos/distribuicao";
import { obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja } from "@/servicos/mensagens";
import { criarUsuario, editarUsuario, listarEquipe } from "@/servicos/usuarios";
import { limparBanco } from "./ajuda";

const pdf = () => Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(20, 65)]);

describe("regra do nome para o cliente", () => {
  it("formato do WhatsApp: nome em negrito, dois pontos, quebra de linha e o texto", () => {
    expect(textoComNome("Bom dia!", "Ana")).toBe("*Ana:*\nBom dia!");
  });
  it("sem texto (arquivo sem legenda) não cria legenda só com o nome", () => {
    expect(textoComNome("", "Ana")).toBe("");
    expect(textoComNome("   ", "Ana")).toBe("");
    expect(textoComNome(null, "Ana")).toBe("");
  });
  it("sem nome devolve o texto como veio", () => {
    expect(textoComNome("Oi", "")).toBe("Oi");
    expect(textoComNome("Oi", null)).toBe("Oi");
  });
  it("tira o que quebraria o negrito e limita o tamanho", () => {
    expect(limparNomeParaCliente("  *Ana*_\nMaria~ ")).toBe("Ana Maria");
    expect(limparNomeParaCliente("a".repeat(100))).toHaveLength(40);
    expect(textoComNome("Oi", "*")).toBe("Oi");
  });
  it("campo vazio usa o primeiro nome do cadastro", () => {
    expect(nomeParaCliente({ nome: "Ana Paula Souza", nomeCliente: null })).toBe("Ana");
    expect(nomeParaCliente({ nome: "Ana Paula Souza", nomeCliente: "  " })).toBe("Ana");
    expect(nomeParaCliente({ nome: "Ana Paula Souza", nomeCliente: "Paula" })).toBe("Paula");
    expect(nomeParaCliente({ nome: "Mateus" })).toBe("Mateus");
  });
});

describe("cadastro: Nome para o cliente", () => {
  beforeEach(limparBanco);
  it("grava ao criar e ao editar (consultor e admin); vazio apaga; aparece na equipe", async () => {
    const adm = await criarUsuario({ nome: "Mateus Sampaio", login: "mateus", senha: "Mateus123", perfil: "admin", nomeCliente: " Mateus " });
    const ana = await criarUsuario({ nome: "Ana Souza", login: "ana", senha: "Ana12345", perfil: "consultor" });
    expect(adm.nomeCliente).toBe("Mateus");
    expect(ana.nomeCliente).toBeNull();
    await editarUsuario(ana.id, { nomeCliente: "Aninha" });
    expect((await listarEquipe()).find((u) => u.id === ana.id)?.nomeCliente).toBe("Aninha");
    await editarUsuario(ana.id, { nome: "Ana Maria Souza" }); // não mexer no campo não apaga
    expect((await db.usuario.findUniqueOrThrow({ where: { id: ana.id } })).nomeCliente).toBe("Aninha");
    await editarUsuario(ana.id, { nomeCliente: "" });
    expect((await db.usuario.findUniqueOrThrow({ where: { id: ana.id } })).nomeCliente).toBeNull();
  });
});

describe("envio: o nome vai para a Meta, não para o banco", () => {
  const guardados: string[] = [];
  let corpos: { type?: string; text?: { body: string }; document?: { caption?: string }; template?: unknown }[];

  beforeEach(async () => {
    await limparBanco();
    vi.stubEnv("WHATSAPP_TOKEN", "token-secreto");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456");
    vi.stubEnv("META_APP_SECRET", "segredo");
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "verificacao");
    vi.stubEnv("MODO_SIMULADOR", "0");
    corpos = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (url.endsWith("/media")) return new Response(JSON.stringify({ id: "MEDIA1" }), { status: 200 });
      corpos.push(JSON.parse(init.body as string));
      return new Response(JSON.stringify({ messages: [{ id: `wamid.${corpos.length}` }] }), { status: 200 });
    });
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    for (const n of guardados.splice(0)) await apagarMidia(n);
  });

  async function leadComJanela(tel = "+5588999990001") {
    const lead = await obterOuCriarLead(tel, "Carla");
    await db.lead.update({ where: { id: lead.id }, data: { ultimaMsgClienteEm: await agora() } });
    return lead;
  }

  it("texto do consultor: vai com o nome em negrito, mas fica gravado sem o nome", async () => {
    const ana = await criarUsuario({ nome: "Ana Souza", login: "ana", senha: "Ana12345", perfil: "consultor" });
    const lead = await leadComJanela();
    const m = await responderComoConsultor(lead.id, ana, "Posso ajudar?");
    expect(corpos[0].text?.body).toBe("*Ana:*\nPosso ajudar?"); // fallback: primeiro nome do cadastro
    expect(m.texto).toBe("Posso ajudar?");
    expect(m.autorNome).toBe("Ana Souza");
    expect(m.nomeNoEnvio).toBe("Ana");
  });

  it("admin também leva o nome (e usa o campo preenchido, não o primeiro nome)", async () => {
    const adm = await criarUsuario({ nome: "Mateus Sampaio", login: "mateus", senha: "Mateus123", perfil: "admin", nomeCliente: "Mateus da Eccellenza" });
    const lead = await leadComJanela();
    await responderComoConsultor(lead.id, adm, "Oi");
    expect(corpos[0].text?.body).toBe("*Mateus da Eccellenza:*\nOi");
  });

  it("arquivo com legenda: o nome vai no início da legenda; sem legenda continua sem legenda", async () => {
    const ana = await criarUsuario({ nome: "Ana Souza", login: "ana", senha: "Ana12345", perfil: "consultor" });
    const lead = await leadComJanela();
    const com = await responderComoConsultorComArquivo(lead.id, ana, { dados: pdf(), tipo: "application/pdf", nome: "proposta.pdf" }, "Segue a proposta");
    const sem = await responderComoConsultorComArquivo(lead.id, ana, { dados: pdf(), tipo: "application/pdf", nome: "planta.pdf" });
    guardados.push(com.midiaArquivo!, sem.midiaArquivo!);
    expect(corpos[0].document?.caption).toBe("*Ana:*\nSegue a proposta");
    expect(com.texto).toBe("Segue a proposta");
    expect(corpos[1].document).toBeDefined();
    expect(corpos[1].document?.caption).toBeUndefined();
    expect(sem.texto).toBeNull();
    expect(sem.nomeNoEnvio).toBeNull();
  });

  it("bot e sistema não levam nome, mesmo que alguém passe o nome", async () => {
    const lead = await leadComJanela();
    await enviarMensagemLoja({ leadId: lead.id, autor: "bot", autorNome: "Bot", nomeParaCliente: "Ana", texto: "Olá!" });
    await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", autorNome: "Sistema", nomeParaCliente: "Ana", texto: "Aviso" });
    expect(corpos[0].text?.body).toBe("Olá!");
    expect(corpos[1].text?.body).toBe("Aviso");
    expect((await db.mensagem.findMany({ where: { leadId: lead.id } })).every((m) => m.nomeNoEnvio === null)).toBe(true);
  });

  it("modelo da Meta não leva nome (texto fixo aprovado)", async () => {
    const ana = await criarUsuario({ nome: "Ana Souza", login: "ana", senha: "Ana12345", perfil: "consultor" });
    const lead = await leadComJanela();
    await db.lead.update({ where: { id: lead.id }, data: { consentimentoEm: await agora(), consentimentoOrigem: "cliente_escreveu" } });
    const m = await responderComoConsultor(lead.id, ana, undefined, "retomada");
    expect(corpos[0].type).toBe("template");
    expect(corpos[0].text).toBeUndefined();
    expect(m.nomeNoEnvio).toBeNull();
  });

  it("depois de transferir o lead, a mensagem seguinte sai com o nome de quem enviou (o novo vendedor)", async () => {
    const ana = await criarUsuario({ nome: "Ana Souza", login: "ana", senha: "Ana12345", perfil: "consultor" });
    const rui = await criarUsuario({ nome: "Rui Lima", login: "rui", senha: "Rui12345", perfil: "consultor", nomeCliente: "Ruy" });
    const lead = await leadComJanela();
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: ana.id } });
    await responderComoConsultor(lead.id, ana, "Aqui é a Ana.");
    await transferirLead(lead.id, rui.id, "Mateus");
    await responderComoConsultor(lead.id, rui, "Agora sou eu.");
    expect(corpos.map((c) => c.text?.body)).toEqual(["*Ana:*\nAqui é a Ana.", "*Ruy:*\nAgora sou eu."]);
    // Sem mensagem automática de aviso de troca: só as duas do vendedor.
    expect(await db.mensagem.count({ where: { leadId: lead.id } })).toBe(2);
  });

  it("simulador (sem Meta): a mensagem também guarda o nome usado, para o chat do cliente mostrar", async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    const ana = await criarUsuario({ nome: "Ana Souza", login: "ana", senha: "Ana12345", perfil: "consultor" });
    const lead = await leadComJanela("+5588999990002");
    const m = await responderComoConsultor(lead.id, ana, "Oi");
    expect(m.texto).toBe("Oi");
    expect(textoComNome(m.texto, m.nomeNoEnvio)).toBe("*Ana:*\nOi");
  });
});
