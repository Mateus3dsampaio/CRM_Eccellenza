import { utimes } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { apagarMidia, lerMidia, PASTA_MIDIAS, salvarMidia, tamanhoDaMidia } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { pode } from "@/regras/permissoes";
import { DIAS_MIDIA_ATE_APAGAR, extensaoBloqueada, formatarTamanho, rotuloDoArquivo, TIPO_GENERICO, intervaloDeBytes, LIMITES_BYTES, nomeSeguroDeArquivo, previaDaMidia, rotuloDoTipo, tipoDoArquivo, tipoMidiaAceito, tipoPodeEnviar } from "@/regras/midia";
import { DIA } from "@/regras/tempo";
import { responderComoConsultorComArquivo } from "@/servicos/conversa";
import { acharLeadPorTelefone, excluirLeads, obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { apagarMidiaDaMensagem, apagarMidiasAntigas, apagarMidiasSoltas, armazenamento, listarGaleria, resumoDeMidias } from "@/servicos/midias";
import { processarWebhook } from "@/servicos/whatsapp";
import { criarConsultores, limparBanco } from "./ajuda";

const pdf = (extra = 20) => Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(extra, 65)]);
const mp4 = (extra = 40) => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42"), Buffer.alloc(extra, 1)]);
const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const zip = (extra = 30) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(extra, 7)]); // docx e xlsx são ZIP
const ole = (extra = 30) => Buffer.concat([Buffer.from("d0cf11e0a1b11ae1", "hex"), Buffer.alloc(extra, 7)]); // doc e xls antigos
const dwg = (extra = 60) => Buffer.concat([Buffer.from("AC1032"), Buffer.alloc(extra, 0)]);

const guardados: string[] = [];
async function guardar(dados: Buffer, tipo: string, nomeOriginal?: string) {
  const nome = await salvarMidia(dados, tipo, nomeOriginal);
  guardados.push(nome);
  return nome;
}
afterEach(async () => {
  for (const n of guardados.splice(0)) await apagarMidia(n);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("regras de mídia", () => {
  it("aceita imagem, vídeo MP4/3GP e PDF; recusa o resto", () => {
    for (const t of ["image/png", "image/jpeg", "video/mp4", "video/3gpp", "application/pdf", "Application/PDF; x=1"]) expect(tipoMidiaAceito(t)).toBe(true);
    for (const t of [DOCX, XLSX, "application/msword", "application/vnd.ms-excel", "application/acad", "application/zip", "application/x-zip-compressed"]) expect(tipoMidiaAceito(t)).toBe(true);
    for (const t of ["application/x-rar-compressed", "text/html", "video/x-msvideo", "application/vnd.ms-powerpoint", ""]) expect(tipoMidiaAceito(t)).toBe(false);
  });
  it("nome de arquivo: sem pasta, sem caracteres perigosos, com limite", () => {
    expect(nomeSeguroDeArquivo("../../etc/passwd")).toBe("passwd");
    expect(nomeSeguroDeArquivo('C:\\docs\\orçamento "final".pdf')).toBe("orçamento final.pdf");
    expect(nomeSeguroDeArquivo("")).toBe("arquivo");
    expect(nomeSeguroDeArquivo("..", "x")).toBe("x");
    expect(nomeSeguroDeArquivo("a".repeat(300)).length).toBe(120);
  });
  it("Range de vídeo", () => {
    expect(intervaloDeBytes("bytes=0-99", 1000)).toEqual({ inicio: 0, fim: 99 });
    expect(intervaloDeBytes("bytes=900-", 1000)).toEqual({ inicio: 900, fim: 999 });
    expect(intervaloDeBytes("bytes=-100", 1000)).toEqual({ inicio: 900, fim: 999 });
    expect(intervaloDeBytes("bytes=0-5000", 1000)).toEqual({ inicio: 0, fim: 999 });
    expect(intervaloDeBytes("bytes=2000-", 1000)).toBeNull();
    expect(intervaloDeBytes("bytes=5-1", 1000)).toBeNull();
    expect(intervaloDeBytes("bytes=0-1,5-9", 1000)).toBeNull();
    expect(intervaloDeBytes(null, 1000)).toBeNull();
  });
  it("tamanho e prévia", () => {
    expect(formatarTamanho(512)).toBe("512 B");
    expect(formatarTamanho(2048)).toBe("2 KB");
    expect(formatarTamanho(5 * 1024 * 1024)).toBe("5,0 MB");
    expect(previaDaMidia("application/pdf")).toBe("📄 PDF");
    expect(previaDaMidia("video/mp4")).toBe("🎥 Vídeo");
    expect(previaDaMidia("image/png")).toBe("📷 Imagem");
  });
  it("tipo do arquivo: o informado vale; se vier vazio ou genérico, a extensão decide, mas só para documentos", () => {
    expect(tipoDoArquivo("planta.dwg", "")).toBe("application/acad");
    expect(tipoDoArquivo("PLANTA.DWG", "application/octet-stream")).toBe("application/acad");
    expect(tipoDoArquivo("orçamento.docx", "")).toBe(DOCX);
    expect(tipoDoArquivo("tabela.xlsx", "application/zip")).toBe(XLSX);
    expect(tipoDoArquivo("a.xls", "application/vnd.ms-excel")).toBe("application/vnd.ms-excel");
    expect(tipoDoArquivo("x.png", "image/png")).toBe("image/png");
    expect(tipoDoArquivo("projeto.zip", "application/x-zip-compressed")).toBe("application/zip");
    expect(tipoDoArquivo("projeto.zip", "")).toBe("application/zip");
    expect(tipoDoArquivo("medidas.docx", "application/zip")).toBe(DOCX); // docx é ZIP por dentro: o nome decide
    expect(rotuloDoTipo("application/zip")).toBe("ZIP");
    expect(tipoDoArquivo("virus.exe", "application/octet-stream")).toBeNull();
    expect(tipoDoArquivo("foto.png", "")).toBeNull(); // extensão de imagem não vale sozinha
    expect(tipoDoArquivo(null, "")).toBeNull();
    expect(rotuloDoTipo(DOCX)).toBe("Word");
    expect(rotuloDoTipo("application/acad")).toBe("DWG");
    expect(previaDaMidia(XLSX)).toBe("📄 Excel");
  });
  it("extensões bloqueadas no modo 'qualquer arquivo': programas, scripts, páginas e arquivos com macro", () => {
    for (const nome of ["setup.exe", "A.BAT", "foto.jpg.exe", "pagina.html", "logo.svg", "planilha.xlsm", "script.ps1", "x.exe.", "x.EXE "]) expect(extensaoBloqueada(nome)).not.toBeNull();
    for (const nome of ["projeto.rar", "apresentacao.pptx", "lista.txt", "dados.csv", "modelo.skp", "semextensao", ".exe", "exe", ""]) expect(extensaoBloqueada(nome)).toBeNull();
    expect(rotuloDoArquivo(TIPO_GENERICO, "projeto.rar")).toBe("RAR");
    expect(rotuloDoArquivo(TIPO_GENERICO, "semextensao")).toBe("Arquivo");
    expect(rotuloDoArquivo(TIPO_GENERICO, "x.extensaomuitolonga")).toBe("Arquivo");
    expect(rotuloDoArquivo("application/pdf", "a.pdf")).toBe("PDF");
    // octet-stream é o "não sei": o nome decide (docx continua docx; desconhecido fica genérico no recebimento)
    expect(tipoDoArquivo("a.docx", TIPO_GENERICO)).toBe(DOCX);
    expect(tipoDoArquivo("a.rar", TIPO_GENERICO)).toBeNull();
  });
  it("o vendedor só envia JPG, PNG, MP4, PDF, Word, Excel, DWG e ZIP (WEBP, GIF e 3GP só se recebem)", () => {
    for (const ok of ["image/jpeg", "image/png", "video/mp4", "application/pdf", DOCX, XLSX, "application/msword", "application/vnd.ms-excel", "application/acad", "application/zip"]) expect(tipoPodeEnviar(ok)).toBe(true);
    for (const nao of ["image/webp", "image/gif", "video/3gpp", "application/x-rar-compressed", TIPO_GENERICO]) expect(tipoPodeEnviar(nao)).toBe(false); // arquivo genérico só se recebe
  });
  it("só o admin apaga arquivo", () => {
    expect(pode("admin", "apagar_midia")).toBe(true);
    expect(pode("consultor", "apagar_midia")).toBe(false);
  });
});

describe("guardar arquivos", () => {
  it("PDF e MP4 válidos são guardados e lidos de volta; tamanho conferido", async () => {
    const nomePdf = await guardar(pdf(), "application/pdf");
    const nomeMp4 = await guardar(mp4(), "video/mp4");
    expect(nomePdf).toMatch(/\.pdf$/);
    expect(nomeMp4).toMatch(/\.mp4$/);
    expect((await lerMidia(nomePdf)).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await tamanhoDaMidia(nomeMp4)).toBe(mp4().length);
  });
  it("Word, Excel e DWG: guardados quando o conteúdo confere; recusados quando o conteúdo é de outra coisa", async () => {
    const docx = await guardar(zip(), DOCX);
    const xlsx = await guardar(zip(), XLSX);
    const doc = await guardar(ole(), "application/msword");
    const xls = await guardar(ole(), "application/vnd.ms-excel");
    const d = await guardar(dwg(), "application/acad");
    const z = await guardar(zip(), "application/x-zip-compressed");
    expect([docx, xlsx, doc, xls, d, z].map((n) => n.split(".").pop())).toEqual(["docx", "xlsx", "doc", "xls", "dwg", "zip"]);
    await expect(salvarMidia(Buffer.from("MZ programa disfarçado de zip"), "application/zip")).rejects.toThrow(/não parece/);
    await expect(salvarMidia(Buffer.from("isto é um executável, não um Word"), DOCX)).rejects.toThrow(/não parece/);
    await expect(salvarMidia(zip(), "application/msword")).rejects.toThrow(/não parece/); // ZIP não é .doc antigo
    await expect(salvarMidia(ole(), XLSX)).rejects.toThrow(/não parece/);
    await expect(salvarMidia(pdf(), "application/acad")).rejects.toThrow(/não parece/);
    await expect(salvarMidia(Buffer.concat([zip(), Buffer.alloc(LIMITES_BYTES.documento)]), DOCX)).rejects.toThrow(/maior que/);
  });
  it("arquivo genérico: guardado como .bin se o nome for seguro; recusado se for programa, script ou página", async () => {
    const g = await guardar(Buffer.from("conteúdo qualquer de um rar"), TIPO_GENERICO, "projeto.rar");
    expect(g).toMatch(/\.bin$/);
    await expect(salvarMidia(Buffer.from("MZ..."), TIPO_GENERICO, "setup.exe")).rejects.toThrow(/bloqueados/);
    await expect(salvarMidia(Buffer.from("<html>"), TIPO_GENERICO, "pagina.html")).rejects.toThrow(/bloqueados/);
    await expect(salvarMidia(Buffer.alloc(0), TIPO_GENERICO, "vazio.rar")).rejects.toThrow(/vazio/);
    await expect(salvarMidia(Buffer.alloc(LIMITES_BYTES.documento + 1), TIPO_GENERICO, "grande.rar")).rejects.toThrow(/maior que/);
  });
  it("recusa arquivo que não é do tipo que diz ser, vazio ou grande demais", async () => {
    await expect(salvarMidia(Buffer.from("<html>oi</html>"), "application/pdf")).rejects.toThrow(/não parece/);
    await expect(salvarMidia(Buffer.from("isto não é um vídeo, só texto longo"), "video/mp4")).rejects.toThrow(/não parece/);
    await expect(salvarMidia(Buffer.alloc(0), "application/pdf")).rejects.toThrow(/vazio/);
    await expect(salvarMidia(Buffer.concat([pdf(), Buffer.alloc(LIMITES_BYTES.documento)]), "application/pdf")).rejects.toThrow(/maior que/);
    await expect(salvarMidia(Buffer.concat([mp4(), Buffer.alloc(LIMITES_BYTES.video)]), "video/mp4")).rejects.toThrow(/maior que/);
    await expect(salvarMidia(Buffer.from("PK"), "application/x-rar-compressed")).rejects.toThrow(/não aceito/);
  });
});

function fingirMeta(arquivos: Record<string, { mime: string; dados: Buffer }>) {
  const chamadas: { url: string; metodo: string; corpo?: unknown }[] = [];
  vi.stubGlobal("fetch", async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    chamadas.push({ url, metodo: init?.method ?? "GET", corpo: init?.body });
    for (const [id, a] of Object.entries(arquivos)) {
      // O endereço do arquivo termina igual ao da consulta: confere o do arquivo primeiro.
      if (url === `https://lookaside.fbsbx.com/${id}`) return new Response(new Uint8Array(a.dados), { status: 200 });
      if (url.endsWith(`/${id}`)) return new Response(JSON.stringify({ url: `https://lookaside.fbsbx.com/${id}`, mime_type: a.mime }), { status: 200 });
    }
    if (url.endsWith("/media")) return new Response(JSON.stringify({ id: "MEDIA123" }), { status: 200 });
    if (url.endsWith("/messages")) return new Response(JSON.stringify({ messages: [{ id: `wamid.${chamadas.length}` }] }), { status: 200 });
    return new Response("{}", { status: 404 });
  });
  return chamadas;
}
function metaConfigurada() {
  vi.stubEnv("WHATSAPP_TOKEN", "token-secreto");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456");
  vi.stubEnv("META_APP_SECRET", "segredo");
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "verificacao");
  vi.stubEnv("MODO_SIMULADOR", "0");
}
const entrada = (id: string, tipo: string, corpo: object, de = "5588999991111") => ({
  entry: [{ changes: [{ value: { contacts: [{ wa_id: de, profile: { name: "Ana" } }], messages: [{ id, from: de, type: tipo, ...corpo }] } }] }],
});

describe("receber PDF e vídeo do cliente (WhatsApp)", () => {
  beforeEach(limparBanco);

  it("PDF e vídeo ficam guardados, com nome, tipo e tamanho; a prévia do card diz o que é", async () => {
    metaConfigurada();
    fingirMeta({ doc1: { mime: "application/pdf", dados: pdf() }, vid1: { mime: "video/mp4", dados: mp4() } });
    await processarWebhook(entrada("wamid.D1", "document", { document: { id: "doc1", filename: "planta cozinha.pdf", caption: "segue a planta" } }));
    await processarWebhook(entrada("wamid.V1", "video", { video: { id: "vid1" } }));
    const d = await db.mensagem.findFirstOrThrow({ where: { idExterno: "wamid.D1" } });
    guardados.push(d.midiaArquivo!);
    expect(d).toMatchObject({ midiaTipo: "application/pdf", midiaNome: "planta cozinha.pdf", midiaBytes: pdf().length, texto: "segue a planta" });
    const v = await db.mensagem.findFirstOrThrow({ where: { idExterno: "wamid.V1" } });
    guardados.push(v.midiaArquivo!);
    expect(v).toMatchObject({ midiaTipo: "video/mp4", midiaBytes: mp4().length });
    expect((await acharLeadPorTelefone("+5588999991111"))?.ultimaMensagemPrevia).toBe("🎥 Vídeo");
  });

  it("vídeo grande demais ou de formato estranho: a conversa registra o aviso e nada é guardado", async () => {
    metaConfigurada();
    fingirMeta({ grande: { mime: "video/mp4", dados: Buffer.concat([mp4(), Buffer.alloc(LIMITES_BYTES.video)]) }, avi: { mime: "video/x-msvideo", dados: Buffer.from("RIFF") } });
    await processarWebhook(entrada("wamid.G1", "video", { video: { id: "grande" } }));
    await processarWebhook(entrada("wamid.G2", "video", { video: { id: "avi" } }));
    for (const id of ["wamid.G1", "wamid.G2"]) {
      const m = await db.mensagem.findFirstOrThrow({ where: { idExterno: id } });
      expect(m.midiaArquivo).toBeNull();
      expect(m.texto).toMatch(/não conseguiu baixar ou não aceita/);
    }
  });

  it("Word, Excel e DWG que o cliente manda ficam guardados, mesmo quando a Meta informa o tipo genérico (usa a extensão)", async () => {
    metaConfigurada();
    fingirMeta({
      w: { mime: DOCX, dados: zip() },
      x: { mime: "application/octet-stream", dados: zip() },
      d: { mime: "application/octet-stream", dados: dwg() },
      falso: { mime: "application/octet-stream", dados: Buffer.from("MZ executável disfarçado de dwg") },
    });
    await processarWebhook(entrada("wamid.A1", "document", { document: { id: "w", filename: "orçamento.docx" } }));
    await processarWebhook(entrada("wamid.A2", "document", { document: { id: "x", filename: "medidas.xlsx" } }));
    await processarWebhook(entrada("wamid.A3", "document", { document: { id: "d", filename: "projeto.DWG" } }));
    await processarWebhook(entrada("wamid.A4", "document", { document: { id: "falso", filename: "projeto.dwg" } }));
    const tipos = [];
    for (const id of ["wamid.A1", "wamid.A2", "wamid.A3"]) {
      const m = await db.mensagem.findFirstOrThrow({ where: { idExterno: id } });
      guardados.push(m.midiaArquivo!);
      tipos.push(m.midiaTipo);
    }
    expect(tipos).toEqual([DOCX, XLSX, "application/acad"]);
    // O conteúdo não confere com DWG: nada é guardado e o aviso fica na conversa.
    const falso = await db.mensagem.findFirstOrThrow({ where: { idExterno: "wamid.A4" } });
    expect(falso.midiaArquivo).toBeNull();
    expect(falso.texto).toMatch(/não conseguiu baixar ou não aceita/);
    expect((await acharLeadPorTelefone("+5588999991111"))?.ultimaMensagemPrevia).toMatch(/enviou um arquivo que o sistema não conseguiu/);
  });

  it("qualquer arquivo que o cliente mande como documento fica guardado (RAR, PowerPoint, TXT); programa e página não", async () => {
    metaConfigurada();
    const chamadas = fingirMeta({
      rar: { mime: "application/x-rar-compressed", dados: Buffer.from("Rar!conteudo") },
      ppt: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", dados: Buffer.from("PK conteudo de apresentacao") },
      txt: { mime: "text/plain", dados: Buffer.from("medidas: 2,5 x 3") },
      exe: { mime: "application/x-msdownload", dados: Buffer.from("MZ...") },
      html: { mime: "text/html", dados: Buffer.from("<script>alert(1)</script>") },
      docx: { mime: "application/octet-stream", dados: zip() },
      video: { mime: "video/x-msvideo", dados: Buffer.from("RIFF") },
    });
    const doc = (id: string, nome: string, cod: string) => processarWebhook(entrada(id, "document", { document: { id: cod, filename: nome } }));
    await doc("wamid.R1", "projeto.rar", "rar");
    await doc("wamid.R2", "apresentacao.pptx", "ppt");
    await doc("wamid.R3", "medidas.txt", "txt");
    await doc("wamid.R4", "instalador.exe", "exe");
    await doc("wamid.R5", "pagina.html", "html");
    await doc("wamid.R6", "orçamento.docx", "docx"); // tipo genérico, mas o nome diz Word
    await processarWebhook(entrada("wamid.R7", "video", { video: { id: "video" } })); // vídeo de formato estranho: NÃO vira arquivo genérico
    const pegar = (id: string) => db.mensagem.findFirstOrThrow({ where: { idExterno: id } });
    for (const id of ["wamid.R1", "wamid.R2", "wamid.R3"]) {
      const m = await pegar(id);
      guardados.push(m.midiaArquivo!);
      expect(m.midiaTipo).toBe(TIPO_GENERICO);
      expect(m.midiaArquivo).toMatch(/\.bin$/);
    }
    expect((await pegar("wamid.R1")).midiaNome).toBe("projeto.rar");
    const w = await pegar("wamid.R6");
    guardados.push(w.midiaArquivo!);
    expect(w.midiaTipo).toBe(DOCX);
    for (const id of ["wamid.R4", "wamid.R5"]) {
      const m = await pegar(id);
      expect(m.midiaArquivo).toBeNull();
      expect(m.texto).toMatch(/bloqueia por segurança/);
    }
    // Arquivo bloqueado nem é baixado.
    expect(chamadas.some((c) => c.url.endsWith("/exe") || c.url.endsWith("/html"))).toBe(false);
    const v = await pegar("wamid.R7");
    expect(v.midiaArquivo).toBeNull();
    // Na galeria o genérico aparece com a extensão e entra no filtro Documentos.
    const lead = (await acharLeadPorTelefone("+5588999991111"))!;
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: null } });
    const docs = await listarGaleria({ id: "x", perfil: "admin" }, { familia: "documento" });
    expect(docs.itens.map((i) => i.rotulo).sort()).toEqual(["RAR", "TXT", "PPTX", "Word"].sort());
  });

  it("o bot não recebe PDF nem vídeo como imagem (só um aviso de que chegou)", async () => {
    metaConfigurada();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-falsa");
    const corpos: string[] = [];
    vi.stubGlobal("fetch", async (entrada: string | URL | Request, init?: RequestInit) => {
      const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      if (url.includes("anthropic")) {
        corpos.push(String(init?.body));
        return new Response(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: "Recebi!" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ messages: [{ id: `wamid.${Math.random()}` }] }), { status: 200 });
    });
    const lead = await obterOuCriarLead("+5588999993333", "Beto");
    const nome = await guardar(pdf(), "application/pdf");
    await registrarMensagemCliente(lead.id, null, { arquivo: nome, tipo: "application/pdf", nome: "projeto.pdf", bytes: 10 });
    const { responderCliente } = await import("@/bot/atendimento");
    const r = await responderCliente(lead.id);
    expect(r.erro).toBeUndefined();
    expect(corpos.length).toBeGreaterThan(0);
    expect(corpos[0]).not.toContain('"type":"image"');
    expect(corpos[0]).toContain("um PDF");
    expect(corpos[0]).toContain("projeto.pdf");
  });
});

describe("enviar imagem, vídeo e PDF (vendedor)", () => {
  beforeEach(limparBanco);

  async function leadComJanela(tel = "+5588999994444") {
    const lead = await obterOuCriarLead(tel, "Carla");
    await db.lead.update({ where: { id: lead.id }, data: { ultimaMsgClienteEm: await agora() } });
    return lead;
  }

  it("WhatsApp real: sobe o arquivo para a Meta e manda a mensagem de documento com o id e o nome", async () => {
    metaConfigurada();
    const chamadas = fingirMeta({});
    const lead = await leadComJanela();
    const m = await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", autorNome: "Rafael", texto: "Segue o orçamento", anexo: { dados: pdf(), tipo: "application/pdf", nome: "../orçamento.pdf" } });
    guardados.push(m.midiaArquivo!);
    const upload = chamadas.find((c) => c.url.endsWith("/123456/media"));
    expect(upload?.metodo).toBe("POST");
    expect(upload?.corpo).toBeInstanceOf(FormData);
    const envio = chamadas.find((c) => c.url.endsWith("/messages"));
    expect(JSON.parse(String(envio?.corpo))).toMatchObject({ type: "document", document: { id: "MEDIA123", caption: "Segue o orçamento", filename: "orçamento.pdf" } });
    expect(m).toMatchObject({ midiaTipo: "application/pdf", midiaNome: "orçamento.pdf", texto: "Segue o orçamento", status: "enviado" });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).ultimaMensagemPrevia).toBe("Segue o orçamento");
  });

  it("Word, Excel e DWG saem como documento, com o nome e o tipo certos", async () => {
    metaConfigurada();
    const chamadas = fingirMeta({});
    const lead = await leadComJanela("+5588999994455");
    const w = await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", anexo: { dados: zip(), tipo: DOCX, nome: "proposta.docx" } });
    const d = await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", anexo: { dados: dwg(), tipo: "application/acad", nome: "planta.dwg" } });
    guardados.push(w.midiaArquivo!, d.midiaArquivo!);
    const envios = chamadas.filter((c) => c.url.endsWith("/messages")).map((c) => JSON.parse(String(c.corpo)));
    expect(envios[0]).toMatchObject({ type: "document", document: { filename: "proposta.docx" } });
    expect(envios[1]).toMatchObject({ type: "document", document: { filename: "planta.dwg" } });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).ultimaMensagemPrevia).toBe("📄 DWG");
  });

  it("imagem e vídeo usam o tipo certo da Meta; sem legenda a prévia mostra o tipo", async () => {
    metaConfigurada();
    const chamadas = fingirMeta({});
    const lead = await leadComJanela();
    const v = await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", anexo: { dados: mp4(), tipo: "video/mp4", nome: "obra.mp4" } });
    guardados.push(v.midiaArquivo!);
    expect(JSON.parse(String(chamadas.filter((c) => c.url.endsWith("/messages")).at(-1)?.corpo))).toMatchObject({ type: "video", video: { id: "MEDIA123" } });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).ultimaMensagemPrevia).toBe("🎥 Vídeo");
    const i = await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", anexo: { dados: png, tipo: "image/png", nome: "foto.png" } });
    guardados.push(i.midiaArquivo!);
    expect(JSON.parse(String(chamadas.filter((c) => c.url.endsWith("/messages")).at(-1)?.corpo))).toMatchObject({ type: "image" });
  });

  it("se a Meta recusar o upload a mensagem fica 'falhou' (e o arquivo continua visível ao vendedor)", async () => {
    metaConfigurada();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 }));
    const lead = await leadComJanela();
    const m = await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", anexo: { dados: pdf(), tipo: "application/pdf", nome: "a.pdf" } });
    guardados.push(m.midiaArquivo!);
    expect(m.status).toBe("falhou");
  });

  it("fora da janela de 24h, com modelo junto ou com arquivo falso: recusa e não grava nada", async () => {
    const semJanela = await obterOuCriarLead("+5588999995555");
    await expect(enviarMensagemLoja({ leadId: semJanela.id, autor: "consultor", anexo: { dados: pdf(), tipo: "application/pdf", nome: "a.pdf" } })).rejects.toThrow(/24h/);
    const lead = await leadComJanela("+5588999996666");
    await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", modelo: "retomada", anexo: { dados: pdf(), tipo: "application/pdf", nome: "a.pdf" } })).rejects.toThrow(/juntos/);
    await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", anexo: { dados: Buffer.from("não sou pdf"), tipo: "application/pdf", nome: "a.pdf" } })).rejects.toThrow(/não parece/);
    expect(await db.mensagem.count({ where: { leadId: lead.id } })).toBe(0);
  });

  it("tipos que a Meta não aceita no envio (GIF, WEBP) são recusados antes de gravar", async () => {
    const lead = await leadComJanela("+5588999998888");
    await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", anexo: { dados: Buffer.from("GIF89a-conteudo-qualquer"), tipo: "image/gif", nome: "a.gif" } })).rejects.toThrow(/JPG ou PNG/);
    expect(await db.mensagem.count({ where: { leadId: lead.id } })).toBe(0);
  });

  it("se a gravação da mensagem falhar, o arquivo não fica solto no disco", async () => {
    const lead = await leadComJanela("+5588999998899");
    const antes = (await armazenamento({})).arquivos;
    const original = db.mensagem.create;
    // Falha de propósito só na gravação (como se o banco caísse nesse instante).
    (db.mensagem as { create: unknown }).create = async () => {
      throw new Error("banco fora");
    };
    try {
      await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", anexo: { dados: pdf(), tipo: "application/pdf", nome: "a.pdf" } })).rejects.toThrow(/banco fora/);
    } finally {
      (db.mensagem as { create: unknown }).create = original;
    }
    expect((await armazenamento({})).arquivos).toBe(antes);
  });

  it("pelo serviço do vendedor: assume a conversa e envia (simulador: sem chamar a Meta)", async () => {
    const lead = await leadComJanela("+5588999997777");
    const m = await responderComoConsultorComArquivo(lead.id, { nome: "Rafael" }, { dados: pdf(), tipo: "application/pdf", nome: "proposta.pdf" }, "Proposta");
    guardados.push(m.midiaArquivo!);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).modoAtendimento).toBe("humano");
    expect(m.status).toBe("enviado");
  });
});

describe("galeria, apagar e limpeza", () => {
  beforeEach(limparBanco);

  async function montarCenario() {
    const [a, b] = await criarConsultores();
    const leadA = await obterOuCriarLead("+5588999990001", "Do A");
    const leadB = await obterOuCriarLead("+5588999990002", "Do B");
    await db.lead.update({ where: { id: leadA.id }, data: { consultorId: a.id } });
    await db.lead.update({ where: { id: leadB.id }, data: { consultorId: b.id } });
    const n1 = await guardar(pdf(), "application/pdf");
    const n2 = await guardar(png, "image/png");
    const n3 = await guardar(mp4(), "video/mp4");
    const m1 = await registrarMensagemCliente(leadA.id, null, { arquivo: n1, tipo: "application/pdf", nome: "a.pdf", bytes: 1000 });
    const m2 = await registrarMensagemCliente(leadA.id, null, { arquivo: n2, tipo: "image/png", bytes: 500 });
    const m3 = await registrarMensagemCliente(leadB.id, null, { arquivo: n3, tipo: "video/mp4", nome: "b.mp4", bytes: 2000 });
    return { a, b, leadA, leadB, m1, m2, m3, n1, n2, n3 };
  }

  it("cada vendedor vê só a galeria dos leads dele; o admin vê tudo e filtra", async () => {
    const { a, b, leadA } = await montarCenario();
    const daA = await listarGaleria({ id: a.id, perfil: "consultor" });
    expect(daA.itens).toHaveLength(2);
    expect(daA.itens.every((i) => i.leadId === leadA.id)).toBe(true);
    expect(daA.vendedores).toEqual([]); // consultor não escolhe vendedor
    expect(daA.bytes).toBe(1500);
    const daB = await listarGaleria({ id: b.id, perfil: "consultor" });
    expect(daB.itens.map((i) => i.rotulo)).toEqual(["Vídeo"]);
    const admin = await listarGaleria({ id: "x", perfil: "admin" });
    expect(admin.total).toBe(3);
    expect(admin.vendedores).toHaveLength(2);
    expect((await listarGaleria({ id: "x", perfil: "admin" }, { familia: "documento" })).itens.map((i) => i.nome)).toEqual(["a.pdf"]);
    const nDwg = await guardar(dwg(), "application/acad");
    const nXls = await guardar(ole(), "application/vnd.ms-excel");
    await registrarMensagemCliente(leadA.id, null, { arquivo: nDwg, tipo: "application/acad", nome: "casa.dwg", bytes: 70 });
    await registrarMensagemCliente(leadA.id, null, { arquivo: nXls, tipo: "application/vnd.ms-excel", nome: "lista.xls", bytes: 40 });
    const docs = await listarGaleria({ id: "x", perfil: "admin" }, { familia: "documento" });
    expect(docs.itens.map((i) => `${i.nome}:${i.rotulo}`).sort()).toEqual(["a.pdf:PDF", "casa.dwg:DWG", "lista.xls:Excel"]);
    expect((await listarGaleria({ id: "x", perfil: "admin" }, { vendedorId: b.id })).total).toBe(1);
    // Vendedor não consegue ver outro filtrando: o parâmetro de vendedor é ignorado para ele.
    expect((await listarGaleria({ id: a.id, perfil: "consultor" }, { vendedorId: b.id })).itens).toHaveLength(4);
    expect(admin.itens.every((i) => i.apagaEmDias === null)).toBe(true);
  });

  it("apagar um arquivo remove do disco, deixa o aviso na mensagem e registra quem apagou", async () => {
    const { m1, n1, leadA } = await montarCenario();
    expect(await apagarMidiaDaMensagem(m1.id, "pelo administrador", "Mateus")).toBe(true);
    expect(await tamanhoDaMidia(n1)).toBeNull();
    const depois = await db.mensagem.findUniqueOrThrow({ where: { id: m1.id } });
    expect(depois).toMatchObject({ midiaArquivo: null, midiaTipo: null, midiaBytes: null });
    expect(depois.texto).toContain("[arquivo apagado pelo administrador]");
    expect((await db.alteracao.findFirstOrThrow({ where: { leadId: leadA.id, descricao: { contains: "Apagou um arquivo" } } })).autor).toBe("Mateus");
    expect(await apagarMidiaDaMensagem(m1.id, "de novo")).toBe(false);
  });

  it("aviso antes de excluir: conta arquivos e bytes por lead e por coluna", async () => {
    const { leadA, leadB } = await montarCenario();
    expect(await resumoDeMidias({ ids: [leadA.id] })).toEqual({ arquivos: 2, bytes: 1500 });
    expect(await resumoDeMidias({ ids: [leadA.id, leadB.id] })).toEqual({ arquivos: 3, bytes: 3500 });
    expect(await resumoDeMidias({ etapa: "novo" })).toEqual({ arquivos: 3, bytes: 3500 });
    expect(await resumoDeMidias({ etapa: "fechado" })).toEqual({ arquivos: 0, bytes: 0 });
    expect(await resumoDeMidias({})).toEqual({ arquivos: 0, bytes: 0 });
  });

  it("excluir a conversa apaga os arquivos do disco (PDF e vídeo também)", async () => {
    const { leadA, leadB, n1, n2, n3 } = await montarCenario();
    await excluirLeads([leadA.id]);
    expect(await tamanhoDaMidia(n1)).toBeNull();
    expect(await tamanhoDaMidia(n2)).toBeNull();
    expect(await tamanhoDaMidia(n3)).not.toBeNull(); // o do outro lead continua
    await excluirLeads([leadB.id]);
    expect(await tamanhoDaMidia(n3)).toBeNull();
  });

  it("arquivos com mais de 180 dias são apagados sozinhos; os recentes ficam; a galeria avisa quando falta pouco", async () => {
    const { m1, m2, m3, n1, n2, n3 } = await montarCenario();
    const agoraSim = await agora();
    await db.mensagem.update({ where: { id: m1.id }, data: { enviadaEm: new Date(agoraSim.getTime() - (DIAS_MIDIA_ATE_APAGAR + 1) * DIA) } });
    await db.mensagem.update({ where: { id: m2.id }, data: { enviadaEm: new Date(agoraSim.getTime() - (DIAS_MIDIA_ATE_APAGAR - 10) * DIA) } });
    const adm = { id: "x", perfil: "admin" };
    const aviso = (await listarGaleria(adm)).itens.find((i) => i.mensagemId === m2.id);
    expect(aviso?.apagaEmDias).toBeLessThanOrEqual(10);
    expect(aviso?.apagaEmDias).toBeGreaterThanOrEqual(9);
    expect(await apagarMidiasAntigas()).toBe(1);
    expect(await tamanhoDaMidia(n1)).toBeNull();
    expect(await tamanhoDaMidia(n2)).not.toBeNull();
    expect(await tamanhoDaMidia(n3)).not.toBeNull();
    expect((await db.mensagem.findUniqueOrThrow({ where: { id: m1.id } })).texto).toContain("automaticamente após 180 dias");
    expect(await apagarMidiasAntigas()).toBe(0);
    void m3;
  });

  it("limpeza de 180 dias: um erro numa mensagem não impede as outras", async () => {
    const { m1, m2, n2 } = await montarCenario();
    const velho = new Date((await agora()).getTime() - (DIAS_MIDIA_ATE_APAGAR + 5) * DIA);
    await db.mensagem.update({ where: { id: m1.id }, data: { enviadaEm: velho } });
    await db.mensagem.update({ where: { id: m2.id }, data: { enviadaEm: new Date(velho.getTime() + 1000) } });
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = db.mensagem.updateMany;
    let chamadas = 0;
    (db.mensagem as { updateMany: unknown }).updateMany = async (...args: Parameters<typeof original>) => {
      if (chamadas++ === 0) throw new Error("falha numa mensagem");
      return original.apply(db.mensagem, args);
    };
    try {
      expect(await apagarMidiasAntigas()).toBe(1); // a 1ª falhou, a 2ª foi apagada
    } finally {
      (db.mensagem as { updateMany: unknown }).updateMany = original;
      erro.mockRestore();
    }
    expect(await tamanhoDaMidia(n2)).toBeNull();
  });

  it("apagar à mão e a rotina ao mesmo tempo: o aviso na conversa sai uma vez só", async () => {
    const { m1 } = await montarCenario();
    const resultados = await Promise.all([apagarMidiaDaMensagem(m1.id, "pelo administrador"), apagarMidiaDaMensagem(m1.id, "automaticamente")]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
    const texto = (await db.mensagem.findUniqueOrThrow({ where: { id: m1.id } })).texto ?? "";
    expect(texto.match(/\[arquivo apagado/g)).toHaveLength(1);
  });

  it("arquivos soltos (sem mensagem) com mais de 1 dia são apagados; os com mensagem e os novos ficam", async () => {
    const { n1 } = await montarCenario(); // n1 tem mensagem
    const solto = await guardar(pdf(), "application/pdf");
    const novoSolto = await guardar(pdf(), "application/pdf");
    const doisDias = new Date(Date.now() - 2 * DIA);
    await utimes(path.join(PASTA_MIDIAS, solto), doisDias, doisDias);
    await utimes(path.join(PASTA_MIDIAS, n1), doisDias, doisDias);
    expect(await apagarMidiasSoltas()).toBeGreaterThanOrEqual(1);
    expect(await tamanhoDaMidia(solto)).toBeNull();
    expect(await tamanhoDaMidia(n1)).not.toBeNull();
    expect(await tamanhoDaMidia(novoSolto)).not.toBeNull();
  });

  it("indicador de armazenamento: conta a pasta e mostra o limite só se o admin informou", async () => {
    await guardar(pdf(1000), "application/pdf");
    const sem = await armazenamento({});
    expect(sem.arquivos).toBeGreaterThanOrEqual(1);
    expect(sem.bytes).toBeGreaterThanOrEqual(1009);
    expect(sem.limiteBytes).toBeNull();
    expect((await armazenamento({ MIDIAS_LIMITE_MB: "5000" })).limiteBytes).toBe(5000 * 1024 * 1024);
    expect((await armazenamento({ MIDIAS_LIMITE_MB: "abc" })).limiteBytes).toBeNull();
  });
});
