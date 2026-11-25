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

import { GET, POST } from "@/app/api/instagram/webhook/route";
import { db } from "@/lib/db";
import { canalDeEnvio } from "@/regras/canal";
import { enderecoDeMidiaPermitido, extrairEventosInstagram } from "@/regras/instagram";
import { formatarTelefone, nomeExibicao } from "@/regras/telefone";
import { receberMensagemCliente, responderComoConsultor, responderComoConsultorComArquivo } from "@/servicos/conversa";
import { obterOuCriarLead, unirLeadInstagramComWhatsapp } from "@/servicos/leads";
import { enviarMensagemLoja } from "@/servicos/mensagens";
import { processarWebhook } from "@/servicos/whatsapp";
import { limparBanco } from "./ajuda";

const SEGREDO = "segredo-do-app";
const CONTA = "17841451828182322";
const CLIENTE = "9988776655";
const assinar = (corpo: string) => `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;

function payload(mid: string, texto: string, de = CLIENTE) {
  return { object: "instagram", entry: [{ id: CONTA, time: 1, messaging: [{ sender: { id: de }, recipient: { id: CONTA }, timestamp: 1, message: { mid, text: texto } }] }] };
}

function configurar() {
  vi.stubEnv("INSTAGRAM_TOKEN", "token-secreto");
  vi.stubEnv("INSTAGRAM_ACCOUNT_ID", CONTA);
  vi.stubEnv("META_APP_SECRET", SEGREDO);
  vi.stubEnv("INSTAGRAM_VERIFY_TOKEN", "minha-verificacao");
  vi.stubEnv("MODO_SIMULADOR", "0");
}

describe("regras do Instagram", () => {
  it("lê texto, imagem e áudio; ignora echo, a própria loja, apagadas e o que não conhece", () => {
    const e = extrairEventosInstagram({
      object: "instagram",
      entry: [
        {
          id: CONTA,
          messaging: [
            { sender: { id: CLIENTE }, message: { mid: "m1", text: "Oi" } },
            { sender: { id: CLIENTE }, message: { mid: "m2", attachments: [{ type: "image", payload: { url: "https://scontent.cdninstagram.com/a.jpg" } }] } },
            { sender: { id: CLIENTE }, message: { mid: "m3", attachments: [{ type: "audio", payload: { url: "https://lookaside.fbsbx.com/a.mp4" } }] } },
            { sender: { id: CLIENTE }, message: { mid: "m4", attachments: [{ type: "ig_reel", payload: { url: "https://x/r" } }] } },
            { sender: { id: CLIENTE }, message: { mid: "eco", text: "resposta da loja", is_echo: true } },
            { sender: { id: CONTA }, message: { mid: "propria", text: "da loja" } },
            { sender: { id: CLIENTE }, message: { mid: "apagada", is_deleted: true } },
            { sender: { id: CLIENTE }, message: { text: "sem id" } },
            { sender: { id: CLIENTE }, read: { mid: "lida1" } },
          ],
        },
        "lixo",
      ],
    });
    expect(e.mensagens.map((m) => [m.idExterno, m.texto, m.tipoMidia])).toEqual([
      ["m1", "Oi", null],
      ["m2", null, "image"],
      ["m3", null, "audio"],
      ["m4", expect.stringContaining("reel"), null],
    ]);
    expect(e.leituras).toEqual([{ idExterno: "lida1", igsid: CLIENTE }]);
    expect(extrairEventosInstagram(null)).toEqual({ mensagens: [], leituras: [] });
    // Payload do WhatsApp não vira mensagem do Instagram.
    expect(extrairEventosInstagram({ object: "whatsapp_business_account", entry: [] }).mensagens).toEqual([]);
  });

  it("só baixa arquivo de servidor da Meta/Instagram por https", () => {
    expect(enderecoDeMidiaPermitido("https://scontent.cdninstagram.com/v/a.jpg")).toBe(true);
    expect(enderecoDeMidiaPermitido("https://lookaside.fbsbx.com/x")).toBe(true);
    expect(enderecoDeMidiaPermitido("http://scontent.cdninstagram.com/a.jpg")).toBe(false);
    expect(enderecoDeMidiaPermitido("https://evil.example.com/a.jpg")).toBe(false);
    expect(enderecoDeMidiaPermitido("https://cdninstagram.com.evil.com/a.jpg")).toBe(false);
    expect(enderecoDeMidiaPermitido("lixo")).toBe(false);
  });

  it("canal de envio: um canal só responde por ele; os dois respondem por onde o cliente falou por último", () => {
    const ig = { telefone: null, igsid: "1", canal: "instagram" };
    const wa = { telefone: "+5588999990000", igsid: null, canal: "whatsapp" };
    const ambos = { telefone: "+5588999990000", igsid: "1", canal: "whatsapp" };
    expect(canalDeEnvio(ig)).toBe("instagram");
    expect(canalDeEnvio(wa)).toBe("whatsapp");
    expect(canalDeEnvio(ambos, "instagram")).toBe("instagram");
    expect(canalDeEnvio(ambos, "whatsapp")).toBe("whatsapp");
    expect(canalDeEnvio(ambos, null)).toBe("whatsapp");
  });

  it("nome do lead sem telefone: nome, perfil, @usuário ou 'Sem telefone'", () => {
    expect(nomeExibicao({ nome: null, nomePerfil: null, telefone: null, igUsuario: "ana.moveis" })).toBe("@ana.moveis");
    expect(nomeExibicao({ nome: null, nomePerfil: "Ana", telefone: null, igUsuario: "ana.moveis" })).toBe("Ana");
    expect(nomeExibicao({ nome: null, nomePerfil: null, telefone: null })).toBe("Sem telefone");
    expect(formatarTelefone(null)).toBe("Sem telefone");
  });
});

describe("Instagram no sistema", () => {
  beforeEach(async () => {
    await limparBanco();
    configurar();
  });
  afterEach(async () => {
    await Promise.allSettled(fundo.tarefas.splice(0));
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("GET: verifica com o token certo e recusa o errado", async () => {
    const url = (t: string) => `https://crm.exemplo/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=${t}&hub.challenge=777`;
    const ok = await GET(new Request(url("minha-verificacao")));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("777");
    expect((await GET(new Request(url("errado")))).status).toBe(403);
  });

  it("POST: recusa assinatura inválida; a válida cria o lead sem telefone, no canal Instagram", async () => {
    const corpo = JSON.stringify(payload("mid.A1", "Oi, quero uma cozinha"));
    const ruim = await POST(new Request("https://x/api/instagram/webhook", { method: "POST", body: corpo, headers: { "x-hub-signature-256": "sha256=00" } }));
    expect(ruim.status).toBe(401);
    expect(await db.lead.count()).toBe(0);

    // A busca do perfil não pode ir à rede de verdade.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ name: "Ana Souza", username: "ana.souza" }), { status: 200 })));
    const boa = await POST(new Request("https://x/api/instagram/webhook", { method: "POST", body: corpo, headers: { "x-hub-signature-256": assinar(corpo) } }));
    expect(boa.status).toBe(200);
    await vi.waitFor(async () => expect(await db.mensagem.count({ where: { idExterno: "mid.A1" } })).toBe(1));
    const lead = await db.lead.findUniqueOrThrow({ where: { igsid: CLIENTE } });
    expect(lead).toMatchObject({ telefone: null, canal: "instagram", nomePerfil: "Ana Souza", igUsuario: "ana.souza" });
    const msg = await db.mensagem.findUniqueOrThrow({ where: { idExterno: "mid.A1" } });
    expect(msg.canal).toBe("instagram");
  });

  it("não configurado: responde 503", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("INSTAGRAM_TOKEN", "");
    expect((await GET(new Request("https://x/api/instagram/webhook?hub.mode=subscribe"))).status).toBe(503);
    expect((await POST(new Request("https://x/api/instagram/webhook", { method: "POST", body: "{}" }))).status).toBe(503);
  });

  it("mensagem repetida pela Meta é processada uma vez só, e a echo da loja não vira cliente", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const p = payload("mid.REP", "Oi");
    await processarWebhook(p);
    await processarWebhook(p);
    expect(await db.mensagem.count({ where: { idExterno: "mid.REP" } })).toBe(1);
    const eco = { object: "instagram", entry: [{ id: CONTA, messaging: [{ sender: { id: CLIENTE }, message: { mid: "mid.ECO", text: "mandada pelo CRM", is_echo: true } }] }] };
    await processarWebhook(eco);
    expect(await db.mensagem.count({ where: { idExterno: "mid.ECO" } })).toBe(0);
  });

  it("resposta sai pelo Instagram (id do cliente, token no cabeçalho) e guarda o id da Meta", async () => {
    const chamadas: { url: string; corpo: unknown; auth: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          chamadas.push({ url, corpo: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
          return new Response(JSON.stringify({ recipient_id: CLIENTE, message_id: "mid.OUT1" }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }),
    );
    const { leadId } = await receberMensagemCliente({ instagram: { igsid: CLIENTE, usuario: "ana" }, texto: "Oi", idExterno: "mid.IN1" });
    const m = await enviarMensagemLoja({ leadId, autor: "consultor", autorNome: "Carlos", texto: "Olá!" });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toContain(`/${CONTA}/messages`);
    expect(chamadas[0].corpo).toEqual({ recipient: { id: CLIENTE }, message: { text: "Olá!" } });
    expect(chamadas[0].auth).toBe("Bearer token-secreto");
    expect(m).toMatchObject({ canal: "instagram", idExterno: "mid.OUT1", status: "enviado" });
  });

  it("falha da Meta fica como 'falhou', sem o texto do erro no log", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: 10, message: "dado do cliente" } }), { status: 400 })));
    const { leadId } = await receberMensagemCliente({ instagram: { igsid: CLIENTE }, texto: "Oi", idExterno: "mid.IN2" });
    const m = await enviarMensagemLoja({ leadId, autor: "consultor", autorNome: "Carlos", texto: "Olá" });
    expect(m.status).toBe("falhou");
    const logs = await db.logWebhook.findMany();
    expect(logs.some((l) => l.resumo.includes("código 10"))).toBe(true);
    expect(logs.some((l) => l.resumo.includes("dado do cliente"))).toBe(false);
  });

  it("sem simulador ligado e sem chaves nada 'finge' ter sido enviado", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("MODO_SIMULADOR", "0");
    const { leadId } = await receberMensagemCliente({ instagram: { igsid: CLIENTE }, texto: "Oi", idExterno: "mid.IN3" });
    const m = await enviarMensagemLoja({ leadId, autor: "consultor", autorNome: "Carlos", texto: "Olá" });
    expect(m.status).toBe("falhou");
  });

  it("Instagram: fora das 24h, sem modelo e sem arquivo; nada disso pausa o bot", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const { leadId } = await receberMensagemCliente({ instagram: { igsid: CLIENTE }, texto: "Oi", idExterno: "mid.IN4" });
    // Sem instrução ativa o bot já passa o lead ao consultor ("pausado"); o que importa é que as recusas abaixo não mudem o modo.
    const modoAntes = (await db.lead.findUniqueOrThrow({ where: { id: leadId } })).modoAtendimento;
    await expect(responderComoConsultor(leadId, { nome: "Carlos" }, undefined, "retomada")).rejects.toThrow(/não tem modelo/);
    await expect(responderComoConsultorComArquivo(leadId, { nome: "Carlos" }, { dados: Buffer.from("x"), tipo: "image/png", nome: "a.png" })).rejects.toThrow(/Instagram/);
    expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).modoAtendimento).toBe(modoAntes);
    await db.lead.update({ where: { id: leadId }, data: { ultimaMsgClienteEm: new Date(Date.now() - 30 * 3600_000) } });
    await expect(enviarMensagemLoja({ leadId, autor: "consultor", autorNome: "Carlos", texto: "Olá" })).rejects.toThrow(/24h do Instagram/);
  });

  it("unir: mensagens e dados vão para o lead do WhatsApp, e a resposta segue o canal da última mensagem do cliente", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message_id: "mid.OUT9" }), { status: 200 })));
    const wa = await obterOuCriarLead("+5588999991111", "Ana WhatsApp");
    await db.lead.update({ where: { id: wa.id }, data: { cidade: "Juazeiro do Norte" } });
    const { leadId: igId } = await receberMensagemCliente({ instagram: { igsid: CLIENTE, usuario: "ana.souza" }, nomePerfil: "Ana IG", texto: "Oi pelo insta", idExterno: "mid.U1" });
    await db.nota.create({ data: { leadId: igId, autorNome: "Carlos", texto: "pediu orçamento", criadoEm: new Date() } });

    await expect(unirLeadInstagramComWhatsapp(igId, igId, "Carlos")).rejects.toThrow(/diferentes/);
    await expect(unirLeadInstagramComWhatsapp(wa.id, igId, "Carlos")).rejects.toThrow(/Instagram sem telefone/);

    const final = await unirLeadInstagramComWhatsapp(igId, wa.id, "Carlos");
    expect(final).toBe(wa.id);
    expect(await db.lead.findUnique({ where: { id: igId } })).toBeNull();
    const lead = await db.lead.findUniqueOrThrow({ where: { id: wa.id } });
    expect(lead).toMatchObject({ telefone: "+5588999991111", igsid: CLIENTE, igUsuario: "ana.souza", cidade: "Juazeiro do Norte" });
    expect(await db.mensagem.count({ where: { leadId: wa.id, canal: "instagram" } })).toBe(1);
    expect(await db.nota.count({ where: { leadId: wa.id } })).toBe(1);

    // Cliente escreveu por último no Instagram: a resposta sai por lá. A janela do WhatsApp (sem mensagem dele) não vale para o Instagram.
    const m = await enviarMensagemLoja({ leadId: wa.id, autor: "consultor", autorNome: "Carlos", texto: "Olá" });
    expect(m).toMatchObject({ canal: "instagram", idExterno: "mid.OUT9" });

    // A mesma pessoa volta a escrever no Instagram: cai no lead unido, não cria outro.
    await receberMensagemCliente({ instagram: { igsid: CLIENTE }, texto: "voltei", idExterno: "mid.U2" });
    expect(await db.lead.count()).toBe(1);
  });

  it("unir recusa lead do WhatsApp que já tem Instagram", async () => {
    const wa = await obterOuCriarLead("+5588999991111");
    const { leadId: ig1 } = await receberMensagemCliente({ instagram: { igsid: "1111" }, texto: "a", idExterno: "mid.V1" });
    const { leadId: ig2 } = await receberMensagemCliente({ instagram: { igsid: "2222" }, texto: "b", idExterno: "mid.V2" });
    await unirLeadInstagramComWhatsapp(ig1, wa.id, "Carlos");
    await expect(unirLeadInstagramComWhatsapp(ig2, wa.id, "Carlos")).rejects.toThrow(/ainda não tem Instagram/);
  });

  it("'parar' pelo Instagram vale como no WhatsApp", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const { leadId } = await receberMensagemCliente({ instagram: { igsid: CLIENTE }, texto: "PARAR", idExterno: "mid.P1" });
    expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).naoReceberEm).not.toBeNull();
  });
});
