import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `after` do Next só funciona dentro de uma requisição de verdade: aqui roda na hora e guarda a tarefa para o teste esperar.
const fundo = vi.hoisted(() => ({ tarefas: [] as Promise<unknown>[] }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    fundo.tarefas.push(Promise.resolve().then(fn));
  },
}));

import { GET, POST } from "@/app/api/whatsapp/webhook/route";
import { db } from "@/lib/db";
import { assinaturaValida, extrairEventos, responderVerificacao } from "@/regras/whatsapp";
import { enviarMensagemLoja, statusEfetivo } from "@/servicos/mensagens";
import { obterOuCriarLead } from "@/servicos/leads";
import { processarWebhook } from "@/servicos/whatsapp";
import { limparBanco } from "./ajuda";

const SEGREDO = "segredo-do-app";
const assinar = (corpo: string) => `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;

function payloadTexto(id: string, texto: string, de = "5588999991111") {
  return { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { contacts: [{ wa_id: de, profile: { name: "Ana Souza" } }], messages: [{ id, from: de, type: "text", text: { body: texto } }] } }] }] };
}
const payloadStatus = (id: string, status: string) => ({ entry: [{ changes: [{ value: { statuses: [{ id, status, recipient_id: "5588999991111" }] } }] }] });

function configurar() {
  vi.stubEnv("WHATSAPP_TOKEN", "token-secreto");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456");
  vi.stubEnv("META_APP_SECRET", SEGREDO);
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "minha-verificacao");
  vi.stubEnv("MODO_SIMULADOR", "0"); // WhatsApp real só envia com o simulador desligado
}

describe("regras do webhook", () => {
  it("assinatura: aceita a correta e recusa adulterada, ausente ou de outro segredo", () => {
    const corpo = '{"a":1}';
    expect(assinaturaValida(corpo, assinar(corpo), SEGREDO)).toBe(true);
    expect(assinaturaValida(corpo + " ", assinar(corpo), SEGREDO)).toBe(false);
    expect(assinaturaValida(corpo, null, SEGREDO)).toBe(false);
    expect(assinaturaValida(corpo, "sha256=zzzz", SEGREDO)).toBe(false);
    expect(assinaturaValida(corpo, assinar(corpo), "outro")).toBe(false);
  });

  it("verificação devolve o desafio só com o token certo", () => {
    const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "abc", "hub.challenge": "999" });
    expect(responderVerificacao(ok, "abc")).toBe("999");
    expect(responderVerificacao(ok, "errado")).toBeNull();
    expect(responderVerificacao(new URLSearchParams({ "hub.mode": "outro", "hub.verify_token": "abc" }), "abc")).toBeNull();
  });

  it("lê texto, imagem, áudio e status; ignora o que não conhece", () => {
    const e = extrairEventos({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "5588999991111", profile: { name: "Ana" } }],
                messages: [
                  { id: "m1", from: "5588999991111", type: "text", text: { body: "Oi" } },
                  { id: "m2", from: "5588999991111", type: "image", image: { id: "midia9", caption: "planta" } },
                  { id: "m3", from: "5588999991111", type: "audio", audio: { id: "a1" } },
                  { id: "m4", from: "5588999991111", type: "interactive", interactive: { button_reply: { title: "Sim" } } },
                  { from: "sem-id", type: "text" },
                ],
                statuses: [{ id: "w1", status: "read" }, { id: "w2", status: "failed", errors: [{ code: 131026 }] }, { id: "w3", status: "esquisito" }],
              },
            },
          ],
        },
        "lixo",
      ],
    });
    expect(e.mensagens.map((m) => [m.idExterno, m.texto, m.midiaId])).toEqual([
      ["m1", "Oi", null],
      ["m2", "planta", "midia9"],
      ["m3", expect.stringContaining("áudio"), null],
      ["m4", "Sim", null],
    ]);
    expect(e.mensagens[0].nomePerfil).toBe("Ana");
    expect(e.statuses).toEqual([
      { idExterno: "w1", status: "read", codigoErro: null },
      { idExterno: "w2", status: "failed", codigoErro: 131026 },
    ]);
    expect(extrairEventos(null)).toEqual({ mensagens: [], statuses: [] });
  });
});

describe("webhook no sistema", () => {
  beforeEach(async () => {
    await limparBanco();
    configurar();
  });
  afterEach(async () => {
    // Espera o bot e o webhook terminarem antes de o próximo teste limpar o banco.
    await Promise.allSettled(fundo.tarefas.splice(0));
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("GET: verifica com o token certo e recusa o errado", async () => {
    const url = (t: string) => `https://crm.exemplo/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${t}&hub.challenge=777`;
    const ok = await GET(new Request(url("minha-verificacao")));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("777");
    expect((await GET(new Request(url("errado")))).status).toBe(403);
  });

  it("POST: recusa assinatura inválida e não grava nada; aceita a válida", async () => {
    const corpo = JSON.stringify(payloadTexto("wamid.A1", "Oi, quero uma cozinha"));
    const ruim = await POST(new Request("https://x/api/whatsapp/webhook", { method: "POST", body: corpo, headers: { "x-hub-signature-256": "sha256=00" } }));
    expect(ruim.status).toBe(401);
    expect(await db.lead.count()).toBe(0);

    const boa = await POST(new Request("https://x/api/whatsapp/webhook", { method: "POST", body: corpo, headers: { "x-hub-signature-256": assinar(corpo) } }));
    expect(boa.status).toBe(200);
    await vi.waitFor(async () => expect(await db.mensagem.count({ where: { idExterno: "wamid.A1" } })).toBe(1));
    const lead = await db.lead.findUniqueOrThrow({ where: { telefone: "+5588999991111" } });
    expect(lead.nomePerfil).toBe("Ana Souza");
  });

  it("não configurado: responde 503", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect((await GET(new Request("https://x/api/whatsapp/webhook?hub.mode=subscribe"))).status).toBe(503);
    expect((await POST(new Request("https://x/api/whatsapp/webhook", { method: "POST", body: "{}" }))).status).toBe(503);
  });

  it("mensagem repetida pela Meta é processada uma vez só", async () => {
    const p = payloadTexto("wamid.REP", "Oi");
    await processarWebhook(p);
    await processarWebhook(p);
    expect(await db.mensagem.count({ where: { idExterno: "wamid.REP" } })).toBe(1);
    expect(await db.logWebhook.count({ where: { resumo: { contains: "repetida" } } })).toBe(1);
  });

  it("envio real: chama a Meta com o token, guarda o id e o status vem do webhook", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.SAIDA" }] }), { status: 200 });
    });
    const lead = await obterOuCriarLead("+5588999992222", "Beto");
    await db.lead.update({ where: { id: lead.id }, data: { ultimaMsgClienteEm: new Date() } });
    const m = await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", autorNome: "Rafael", texto: "Olá, Beto!" });

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toContain("/123456/messages");
    expect((chamadas[0].init.headers as Record<string, string>).Authorization).toBe("Bearer token-secreto");
    expect(JSON.parse(chamadas[0].init.body as string)).toMatchObject({ to: "5588999992222", type: "text", text: { body: "Olá, Beto!" } });
    expect(m.idExterno).toBe("wamid.SAIDA");

    await processarWebhook(payloadStatus("wamid.SAIDA", "delivered"));
    let atual = await db.mensagem.findUniqueOrThrow({ where: { id: m.id } });
    expect(atual.status).toBe("entregue");
    await processarWebhook(payloadStatus("wamid.SAIDA", "read"));
    await processarWebhook(payloadStatus("wamid.SAIDA", "delivered")); // fora de ordem: não volta
    atual = await db.mensagem.findUniqueOrThrow({ where: { id: m.id } });
    expect(atual.status).toBe("lido");
    expect(atual.lidaEm).not.toBeNull();
    // O status mostrado na tela é o real, não o simulado.
    expect(statusEfetivo({ autor: "consultor", status: "enviado", enviadaEm: new Date(Date.now() - 60_000), lidaEm: null }, new Date())).toBe("enviado");
  });

  it("envio recusado pela Meta vira 'falhou' e o log não traz o token", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { code: 131047, message: "Re-engagement" } }), { status: 400 }));
    const lead = await obterOuCriarLead("+5588999993333", "Carla");
    const m = await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", modelo: "retomada" });
    expect(m.status).toBe("falhou");
    const logs = await db.logWebhook.findMany();
    expect(logs.some((l) => !l.ok && l.resumo.includes("131047"))).toBe(true);
    expect(JSON.stringify(logs)).not.toContain("token-secreto");
  });

  it("modelo é enviado como template com o nome do código", async () => {
    let corpo: { type?: string; template?: { name?: string; language?: { code?: string } } } = {};
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      corpo = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ messages: [{ id: "wamid.T" }] }), { status: 200 });
    });
    const lead = await obterOuCriarLead("+5588999994444", "Dani");
    await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", modelo: "retomada" });
    expect(corpo).toMatchObject({ type: "template", template: { name: "retomada", language: { code: "pt_BR" } } });
  });

  it("imagem do cliente é baixada só de servidor da Meta", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const pedidos: string[] = [];
    vi.stubGlobal("fetch", async (entrada: string | URL) => {
      const url = String(entrada);
      pedidos.push(url);
      if (url.includes("/midia9")) return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/arquivo", mime_type: "image/png" }), { status: 200 });
      if (url.startsWith("https://lookaside.fbsbx.com")) return new Response(new Uint8Array(png), { status: 200 });
      return new Response("{}", { status: 404 });
    });
    const { baixarMidiaDaMeta } = await import("@/servicos/whatsapp");
    const r = await baixarMidiaDaMeta("midia9");
    expect(r?.tipo).toBe("image/png");
    expect(r?.dados.length).toBe(png.length);

    vi.stubGlobal("fetch", async (entrada: string | URL) =>
      String(entrada).includes("/midia8") ? new Response(JSON.stringify({ url: "https://servidor-malicioso.exemplo/x", mime_type: "image/png" }), { status: 200 }) : new Response("x", { status: 200 }),
    );
    expect(await baixarMidiaDaMeta("midia8")).toBeNull();
  });
});

describe("proteções do WhatsApp real", () => {
  beforeEach(limparBanco);
  afterEach(async () => {
    await Promise.allSettled(fundo.tarefas.splice(0));
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("com o simulador ligado NADA sai pela Meta, mesmo com as 4 chaves preenchidas", async () => {
    configurar();
    vi.stubEnv("MODO_SIMULADOR", "1");
    let chamou = false;
    vi.stubGlobal("fetch", async () => {
      chamou = true;
      return new Response("{}");
    });
    const lead = await obterOuCriarLead("+5588999996666", "Fictício");
    const m = await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", modelo: "retomada" });
    expect(chamou).toBe(false);
    expect(m.idExterno).toBeNull();
  });

  it("não segue redirecionamento com o token e recusa imagem grande ou de tipo estranho", async () => {
    configurar();
    const { baixarMidiaDaMeta } = await import("@/servicos/whatsapp");
    const opcoes: RequestInit[] = [];
    vi.stubGlobal("fetch", async (url: string | URL, init: RequestInit) => {
      opcoes.push(init);
      const u = String(url);
      if (u.includes("/m1")) return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/a", mime_type: "image/png" }), { status: 200 });
      if (u.includes("/m2")) return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/b", mime_type: "application/pdf" }), { status: 200 });
      if (u.includes("/m3")) return new Response(JSON.stringify({ url: "http://lookaside.fbsbx.com/c", mime_type: "image/png" }), { status: 200 });
      return new Response(new Uint8Array(6 * 1024 * 1024), { status: 200 }); // 6 MB
    });
    expect(await baixarMidiaDaMeta("m1")).toBeNull(); // grande demais
    expect(opcoes.at(-1)?.redirect).toBe("manual");
    expect(await baixarMidiaDaMeta("m2")).toBeNull(); // não é imagem
    expect(await baixarMidiaDaMeta("m3")).toBeNull(); // http, não https
  });

  it("se a Meta recusar a resposta do bot, o lead vai para um humano (não fica sem resposta em silêncio)", async () => {
    configurar();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-falsa");
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).includes("graph.facebook.com")) return new Response(JSON.stringify({ error: { code: 190 } }), { status: 401 });
      // API do Claude (resposta mínima de texto)
      return new Response(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: "Olá!" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const { receberMensagemCliente } = await import("@/servicos/conversa");
    const r = await receberMensagemCliente({ telefone: "+5588999997777", nomePerfil: "Gil", texto: "Oi" });
    expect(r.erro).toMatch(/não entregou/);
    const lead = await db.lead.findUniqueOrThrow({ where: { telefone: "+5588999997777" } });
    expect(lead.aguardandoHumano).toBe(true);
  });
});

describe("produção sem chaves da Meta", () => {
  beforeEach(limparBanco);
  afterEach(() => vi.unstubAllEnvs());
  it("nenhuma mensagem finge ter sido enviada", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WHATSAPP_TOKEN", "");
    const lead = await obterOuCriarLead("+5588999995555", "Edu");
    const m = await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", modelo: "retomada" });
    expect(m.status).toBe("falhou");
  });
});
