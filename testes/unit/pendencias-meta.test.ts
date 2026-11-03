import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { temConsentimento } from "@/regras/consentimento";
import { variantesTelefone } from "@/regras/telefone";
import { enviarMensagemLoja } from "@/servicos/mensagens";
import { acharLeadPorTelefone, obterOuCriarLead } from "@/servicos/leads";
import { registrarConsentimento, registrarPedidoParar } from "@/servicos/lgpd";
import { guardarEvento, processarEventoGuardado, processarWebhook, reprocessarEventosPendentes } from "@/servicos/whatsapp";
import { transcricaoConfigurada, transcreverAudio } from "@/servicos/transcricao";
import { limparBanco } from "./ajuda";

function configurarMeta() {
  vi.stubEnv("WHATSAPP_TOKEN", "token-secreto");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456");
  vi.stubEnv("META_APP_SECRET", "segredo-do-app");
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "verificacao");
  vi.stubEnv("MODO_SIMULADOR", "0");
}
const payload = (id: string, tipo: "text" | "audio", extra: object, de = "5588999991111") => ({
  entry: [{ changes: [{ value: { contacts: [{ wa_id: de, profile: { name: "Ana" } }], messages: [{ id, from: de, type: tipo, ...extra }] } }] }],
});

describe("nono dígito (Brasil)", () => {
  beforeEach(limparBanco);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("variantes: com e sem o 9; outros países e fixos ficam como estão", () => {
    expect(variantesTelefone("+5588999991111")).toEqual(["+5588999991111", "+558899991111"]);
    expect(variantesTelefone("+558899991111")).toEqual(["+558899991111", "+5588999991111"]);
    expect(variantesTelefone("+14155550123")).toEqual(["+14155550123"]);
    expect(variantesTelefone("+558831011234")).toEqual(["+558831011234"]); // fixo (começa com 3)
  });

  it("é a mesma pessoa: o lead criado com 9 é achado quando a Meta manda sem 9 (e vice-versa), sem duplicar", async () => {
    const criado = await obterOuCriarLead("+5588999991111", "Ana");
    const de_novo = await obterOuCriarLead("+558899991111", null, "558899991111");
    expect(de_novo.id).toBe(criado.id);
    expect(de_novo.waId).toBe("558899991111");
    expect((await acharLeadPorTelefone("+5588999991111"))?.id).toBe(criado.id);
    expect(await db.lead.count()).toBe(1);
  });

  it("envia para o wa_id guardado e atualiza quando a Meta devolve outro", async () => {
    configurarMeta();
    const corpos: { to?: string }[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      corpos.push(JSON.parse(init.body as string));
      return new Response(JSON.stringify({ messages: [{ id: `wamid.X${corpos.length}` }], contacts: [{ input: "5588999991111", wa_id: "558899991111" }] }), { status: 200 });
    });
    const lead = await obterOuCriarLead("+5588999991111", "Ana");
    await db.lead.update({ where: { id: lead.id }, data: { ultimaMsgClienteEm: await agora() } });
    await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", texto: "Oi" });
    expect(corpos[0].to).toBe("5588999991111"); // 1ª vez: o número digitado
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).waId).toBe("558899991111"); // a Meta disse como ela o conhece
    await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", texto: "Oi de novo" });
    expect(corpos[1].to).toBe("558899991111"); // 2ª vez: o wa_id
  });
});

describe("consentimento e pedido de parar", () => {
  beforeEach(limparBanco);

  it("modelo exige consentimento: cliente que escreveu primeiro conta (provisório); número digitado pela loja não", async () => {
    const digitado = await obterOuCriarLead("+5588999990001");
    expect(temConsentimento(digitado)).toBe(false);
    await expect(enviarMensagemLoja({ leadId: digitado.id, autor: "consultor", modelo: "primeiro_contato" })).rejects.toThrow(/aceitou receber/);
    await registrarConsentimento(digitado.id, "formulario", "Mateus");
    await expect(enviarMensagemLoja({ leadId: digitado.id, autor: "consultor", modelo: "primeiro_contato" })).resolves.toBeTruthy();
    expect((await db.alteracao.findFirstOrThrow({ where: { leadId: digitado.id, descricao: { contains: "consentimento" } } })).autor).toBe("Mateus");

    const escreveu = await obterOuCriarLead("+5588999990002");
    await db.lead.update({ where: { id: escreveu.id }, data: { ultimaMsgClienteEm: await agora() } });
    await expect(enviarMensagemLoja({ leadId: escreveu.id, autor: "consultor", modelo: "retomada" })).resolves.toBeTruthy();
  });

  it("quem pediu para parar não recebe modelo, nem com consentimento registrado", async () => {
    const lead = await obterOuCriarLead("+5588999990003");
    await db.lead.update({ where: { id: lead.id }, data: { ultimaMsgClienteEm: await agora() } });
    await registrarConsentimento(lead.id, "balcao", "Mateus");
    await registrarPedidoParar(lead.id);
    await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", modelo: "primeiro_contato" })).rejects.toThrow(/pediu para parar/);
  });
});

describe("caixa de entrada do webhook (não perde mensagem se o servidor reiniciar)", () => {
  beforeEach(limparBanco);
  afterEach(() => vi.unstubAllEnvs());

  it("evento pendente é reprocessado pela rotina e a mensagem entra uma vez só", async () => {
    const corpo = JSON.stringify(payload("wamid.PEND", "text", { text: { body: "Oi, quero uma cozinha" } }));
    const id = await guardarEvento(corpo); // gravado, mas o servidor "caiu" antes de processar
    expect(await db.mensagem.count()).toBe(0);
    // Ainda recente (menos de 5 minutos): a rotina não mexe, pode estar sendo processado agora.
    expect(await reprocessarEventosPendentes()).toBe(0);
    await db.eventoWebhook.update({ where: { id }, data: { criadoEm: new Date((await agora()).getTime() - 10 * 60_000) } });
    expect(await reprocessarEventosPendentes()).toBe(1);
    expect(await db.mensagem.count({ where: { idExterno: "wamid.PEND" } })).toBe(1);
    const feito = await db.eventoWebhook.findUniqueOrThrow({ where: { id } });
    expect(feito.processadoEm).not.toBeNull();
    expect(feito.corpo).toBe(""); // o texto do cliente não fica guardado depois de processado
    // Rodar de novo não duplica.
    await processarEventoGuardado(id);
    expect(await db.mensagem.count({ where: { idExterno: "wamid.PEND" } })).toBe(1);
  });

  it("evento que sempre falha é descartado depois de 5 tentativas e avisa no log", async () => {
    const id = await guardarEvento("isto não é json");
    for (let i = 0; i < 5; i++) await processarEventoGuardado(id);
    const e = await db.eventoWebhook.findUniqueOrThrow({ where: { id } });
    expect(e.tentativas).toBe(5);
    expect(e.processadoEm).not.toBeNull();
    expect(await db.logWebhook.count({ where: { resumo: { contains: "descartado" } } })).toBe(1);
  });

  it("eventos processados há mais de 2 dias são apagados (trazem texto do cliente)", async () => {
    const id = await guardarEvento(JSON.stringify(payload("wamid.VELHO", "text", { text: { body: "oi" } })));
    await processarEventoGuardado(id);
    await db.eventoWebhook.update({ where: { id }, data: { processadoEm: new Date((await agora()).getTime() - 3 * 24 * 3600_000) } });
    await reprocessarEventosPendentes();
    expect(await db.eventoWebhook.count()).toBe(0);
  });
});

describe("LGPD e eventos pendentes", () => {
  beforeEach(limparBanco);
  it("excluir o cliente apaga também os eventos da Meta ainda não processados (com e sem o 9)", async () => {
    const { excluirComRegistro } = await import("@/servicos/lgpd");
    const lead = await obterOuCriarLead("+5588999991111", "Ana", "558899991111");
    await guardarEvento(JSON.stringify(payload("wamid.PEND2", "text", { text: { body: "oi" } }, "558899991111")));
    const outro = await guardarEvento(JSON.stringify(payload("wamid.OUTRO", "text", { text: { body: "oi" } }, "5511988887777")));
    await excluirComRegistro([lead.id], "Mateus");
    const restantes = await db.eventoWebhook.findMany();
    expect(restantes.map((e) => e.id)).toEqual([outro]);
  });

  it("pedido de PARAR falado em áudio também vale", async () => {
    const { receberMensagemCliente } = await import("@/servicos/conversa");
    await receberMensagemCliente({ telefone: "+5588999992222", texto: "[áudio transcrito automaticamente] Parar." });
    expect((await db.lead.findUniqueOrThrow({ where: { telefone: "+5588999992222" } })).naoReceberEm).not.toBeNull();
  });

  it("o mesmo evento processado em paralelo é tratado uma vez só (áudio não vai 2 vezes à OpenAI)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-chave-falsa");
    vi.stubEnv("WHATSAPP_TOKEN", "t");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1");
    vi.stubEnv("META_APP_SECRET", "s");
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "v");
    vi.stubEnv("MODO_SIMULADOR", "0");
    let transcricoes = 0;
    vi.stubGlobal("fetch", async (entrada: string | URL | Request) => {
      const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      if (url.includes("api.openai.com")) {
        transcricoes++;
        await new Promise((r) => setTimeout(r, 50));
        return new Response(JSON.stringify({ text: "oi" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/audio9")) return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/a", mime_type: "audio/ogg" }), { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });
    const id = await guardarEvento(JSON.stringify(payload("wamid.PAR", "audio", { audio: { id: "audio9" } })));
    await Promise.all([processarEventoGuardado(id), processarEventoGuardado(id)]);
    expect(transcricoes).toBe(1);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});

describe("transcrição de áudio (Whisper)", () => {
  beforeEach(limparBanco);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const ogg = Buffer.from("4f67675300020000", "hex");
  function fingirMetaEOpenAI(opcoes: { mime?: string; openai?: () => Response } = {}) {
    const chamadas: { url: string; auth?: string; corpo?: unknown }[] = [];
    vi.stubGlobal("fetch", async (entrada: string | URL | Request, init?: RequestInit) => {
      const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      const auth = new Headers(init?.headers).get("authorization") ?? undefined;
      chamadas.push({ url, auth, corpo: init?.body });
      if (url.includes("api.openai.com")) return opcoes.openai ? opcoes.openai() : new Response(JSON.stringify({ text: "quero uma cozinha planejada" }), { status: 200, headers: { "content-type": "application/json" } });
      if (url.includes("/audio9")) return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/audio-arquivo", mime_type: opcoes.mime ?? "audio/ogg; codecs=opus" }), { status: 200 });
      if (url.startsWith("https://lookaside.fbsbx.com")) return new Response(new Uint8Array(ogg), { status: 200 });
      return new Response("{}", { status: 404 });
    });
    return chamadas;
  }
  const audioMsg = (id = "wamid.AUD1") => payload(id, "audio", { audio: { id: "audio9", voice: true, mime_type: "audio/ogg; codecs=opus" } });

  it("sem OPENAI_API_KEY: nada é enviado à OpenAI e a mensagem avisa que não deu para ouvir", async () => {
    configurarMeta();
    vi.stubEnv("OPENAI_API_KEY", "");
    const chamadas = fingirMetaEOpenAI();
    expect(await transcricaoConfigurada()).toBe(false);
    await processarWebhook(audioMsg());
    expect(chamadas.some((c) => c.url.includes("openai"))).toBe(false);
    const m = await db.mensagem.findFirstOrThrow({ where: { idExterno: "wamid.AUD1" } });
    expect(m.texto).toMatch(/não consegue ouvir/);
  });

  it("com a chave: baixa o áudio da Meta, transcreve e guarda só o texto (sem arquivo de áudio)", async () => {
    configurarMeta();
    vi.stubEnv("OPENAI_API_KEY", "sk-chave-falsa");
    const chamadas = fingirMetaEOpenAI();
    await processarWebhook(audioMsg());
    const m = await db.mensagem.findFirstOrThrow({ where: { idExterno: "wamid.AUD1" } });
    expect(m.texto).toBe("[áudio transcrito automaticamente] quero uma cozinha planejada");
    expect(m.midiaArquivo).toBeNull();
    const aOpenAI = chamadas.find((c) => c.url.includes("api.openai.com/v1/audio/transcriptions"));
    expect(aOpenAI?.auth).toBe("Bearer sk-chave-falsa");
    // O token da Meta nunca vai para a OpenAI, nem o da OpenAI para a Meta.
    expect(chamadas.filter((c) => !c.url.includes("openai")).every((c) => c.auth !== "Bearer sk-chave-falsa")).toBe(true);
    // O log tem o tamanho, nunca o que o cliente disse.
    const logs = JSON.stringify(await db.logWebhook.findMany());
    expect(logs).toContain("transcrito");
    expect(logs).not.toContain("cozinha");
    expect(logs).not.toContain("sk-chave-falsa");
  });

  it("falha da OpenAI ou formato não aceito: o cliente não fica sem registro e o consultor vê o aviso", async () => {
    configurarMeta();
    vi.stubEnv("OPENAI_API_KEY", "sk-chave-falsa");
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    fingirMetaEOpenAI({ openai: () => new Response(JSON.stringify({ error: { message: "x" } }), { status: 400, headers: { "content-type": "application/json" } }) });
    await processarWebhook(audioMsg("wamid.AUD2"));
    expect((await db.mensagem.findFirstOrThrow({ where: { idExterno: "wamid.AUD2" } })).texto).toMatch(/não conseguiu transcrever/);

    fingirMetaEOpenAI({ mime: "audio/amr" });
    await processarWebhook(audioMsg("wamid.AUD3"));
    expect((await db.mensagem.findFirstOrThrow({ where: { idExterno: "wamid.AUD3" } })).texto).toMatch(/não conseguiu processar/);
    erro.mockRestore();
  });

  it("recusa áudio vazio, grande demais ou de tipo que a OpenAI não lista", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-chave-falsa");
    let chamou = false;
    vi.stubGlobal("fetch", async () => {
      chamou = true;
      return new Response("{}");
    });
    expect(await transcreverAudio(Buffer.alloc(0), "audio/ogg")).toBeNull();
    expect(await transcreverAudio(Buffer.alloc(17 * 1024 * 1024), "audio/ogg")).toBeNull();
    expect(await transcreverAudio(ogg, "audio/amr")).toBeNull();
    expect(chamou).toBe(false);
  });
});
