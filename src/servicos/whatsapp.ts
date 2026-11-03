import { db } from "@/lib/db";
import { motivoDeRecusaDaMidia, TAMANHO_MAXIMO, tipoImagemValido } from "@/lib/midias";
import { familiaDoTipo, limiteDoTipo, tipoDoArquivo, tipoMidiaAceito } from "@/regras/midia";
import { LIMITE_AUDIO_BYTES, tipoAudioAceito, transcreverAudio, transcricaoConfigurada } from "./transcricao";
import { lerConfigWhatsapp } from "@/lib/whatsapp-config";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { extrairEventos, PREFIXO_AUDIO, type MensagemRecebida, type StatusRecebido } from "@/regras/whatsapp";
import { ErroConversa, receberMensagemCliente } from "./conversa";

// Integração com a API oficial do WhatsApp (Meta). Nada aqui roda sem as variáveis de ambiente.

const TEMPO_LIMITE_MS = 15_000;

export async function registrarLogWebhook(tipo: "verificacao" | "mensagem" | "status" | "invalido" | "erro" | "envio", resumo: string, ok = true) {
  try {
    await db.logWebhook.create({ data: { tipo, resumo: resumo.slice(0, 300), ok } });
  } catch {
    console.error("[whatsapp] não consegui gravar o log");
  }
}

const fim = (tel: string) => tel.replace(/\D/g, "").slice(-4);

export interface ResultadoEnvio {
  ok: boolean;
  id?: string;
  /** wa_id que a Meta devolveu (o número como ela o conhece). */
  waId?: string;
  erro?: string;
}

/** Envia texto livre (dentro da janela de 24h) ou um modelo aprovado. O nome do modelo na Meta é o código do modelo no CRM. */
export async function enviarPelaMeta(params: { para: string; texto?: string; modelo?: string; anexo?: { dados: Buffer; tipo: string; nome: string } }): Promise<ResultadoEnvio> {
  const cfg = lerConfigWhatsapp();
  if (!cfg) return { ok: false, erro: "WhatsApp não configurado" };
  const para = params.para.replace(/\D/g, "");
  let corpo: object;
  if (params.anexo) {
    // Arquivo: primeiro sobe para a Meta (recebe um id), depois manda a mensagem apontando para esse id.
    const idArquivo = await subirArquivoParaMeta(cfg, params.anexo);
    if (!idArquivo) {
      await registrarLogWebhook("envio", `Envio de arquivo para …${fim(para)}: a Meta não aceitou o upload`, false);
      return { ok: false, erro: "a Meta não aceitou o arquivo" };
    }
    const familia = familiaDoTipo(params.anexo.tipo);
    const chave = familia === "imagem" ? "image" : familia === "video" ? "video" : "document";
    const conteudo: Record<string, string> = { id: idArquivo };
    if (params.texto?.trim()) conteudo.caption = params.texto.trim().slice(0, 1024);
    if (chave === "document") conteudo.filename = params.anexo.nome;
    corpo = { messaging_product: "whatsapp", to: para, type: chave, [chave]: conteudo };
  } else
  corpo = params.modelo
    ? { messaging_product: "whatsapp", to: para, type: "template", template: { name: params.modelo, language: { code: cfg.idiomaModelos } } }
    : { messaging_product: "whatsapp", to: para, type: "text", text: { body: params.texto ?? "", preview_url: false } };
  try {
    const resposta = await fetch(`https://graph.facebook.com/${cfg.versaoApi}/${cfg.numeroId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    const json = (await resposta.json().catch(() => ({}))) as { messages?: { id?: string }[]; contacts?: { wa_id?: string }[]; error?: { code?: number; message?: string } };
    if (!resposta.ok || !json.messages?.[0]?.id) {
      // Só o código do erro vai para o log: a mensagem da Meta pode trazer dados do cliente.
      const erro = `a Meta recusou o envio (HTTP ${resposta.status}, código ${json.error?.code ?? "?"})`;
      await registrarLogWebhook("envio", `Envio para …${fim(para)}: ${erro}`, false);
      return { ok: false, erro };
    }
    return { ok: true, id: json.messages[0].id, waId: json.contacts?.[0]?.wa_id };
  } catch {
    await registrarLogWebhook("envio", `Envio para …${fim(para)}: sem resposta da Meta`, false);
    return { ok: false, erro: "sem resposta da Meta" };
  }
}

/** Sobe um arquivo para a Meta e devolve o id dele (ou null). Nunca lança. */
async function subirArquivoParaMeta(cfg: NonNullable<ReturnType<typeof lerConfigWhatsapp>>, anexo: { dados: Buffer; tipo: string; nome: string }): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", anexo.tipo);
    form.append("file", new Blob([new Uint8Array(anexo.dados)], { type: anexo.tipo }), anexo.nome);
    const resposta = await fetch(`https://graph.facebook.com/${cfg.versaoApi}/${cfg.numeroId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    const json = (await resposta.json().catch(() => ({}))) as { id?: string };
    return resposta.ok && json.id ? json.id : null;
  } catch {
    return null;
  }
}

/** Baixa a imagem ou o áudio que o cliente mandou (2 passos: pede o endereço, depois baixa com o token). */
export async function baixarMidiaDaMeta(midiaId: string, tipoMidia: "imagem" | "audio" | "arquivo" = "imagem", nomeArquivo?: string | null): Promise<{ dados: Buffer; tipo: string } | null> {
  const cfg = lerConfigWhatsapp();
  if (!cfg) return null;
  // "arquivo" = imagem, vídeo MP4 ou PDF (o limite de tamanho depende do tipo).
  const aceito = tipoMidia === "audio" ? tipoAudioAceito : tipoMidia === "arquivo" ? tipoMidiaAceito : tipoImagemValido;
  const limiteDe = (tipo: string) => (tipoMidia === "audio" ? LIMITE_AUDIO_BYTES : tipoMidia === "arquivo" ? limiteDoTipo(tipo) : TAMANHO_MAXIMO);
  try {
    const cabecalho = { Authorization: `Bearer ${cfg.token}` };
    const info = await fetch(`https://graph.facebook.com/${cfg.versaoApi}/${encodeURIComponent(midiaId)}`, { headers: cabecalho, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    const meta = (await info.json()) as { url?: string; mime_type?: string };
    if (!info.ok || !meta.url || !meta.mime_type) return null;
    // Só baixa de servidor da Meta/Facebook, por https (evita o webhook ser usado para fazer o servidor visitar outro lugar).
    const destino = new URL(meta.url);
    if (destino.protocol !== "https:" || !/(^|\.)(facebook\.com|fbcdn\.net|fbsbx\.com|whatsapp\.net|facebook\.net)$/.test(destino.hostname)) return null;
    const mimeDaMeta = meta.mime_type.split(";")[0];
    // Documento (Word, Excel, DWG...) costuma chegar com tipo genérico: usa a extensão do nome. O conteúdo é conferido ao guardar.
    const tipo = tipoMidia === "arquivo" ? (tipoDoArquivo(nomeArquivo, mimeDaMeta) ?? mimeDaMeta) : mimeDaMeta;
    if (!aceito(tipo)) return null;
    // "manual": se a Meta redirecionar para outro lugar, o token NÃO vai junto (seria vazamento).
    const arquivo = await fetch(destino, { headers: cabecalho, redirect: "manual", signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (!arquivo.ok) return null;
    const declarado = Number(arquivo.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > limiteDe(tipo)) return null;
    const dados = Buffer.from(await arquivo.arrayBuffer());
    if (dados.length > limiteDe(tipo)) return null;
    return { dados, tipo };
  } catch {
    return null;
  }
}

const STATUS: Record<StatusRecebido["status"], "enviado" | "entregue" | "lido" | "falhou"> = { sent: "enviado", delivered: "entregue", read: "lido", failed: "falhou" };

async function aplicarStatus(s: StatusRecebido) {
  const quando = await agora();
  const novo = STATUS[s.status];
  const atual = await db.mensagem.findUnique({ where: { idExterno: s.idExterno } });
  if (!atual) {
    await registrarLogWebhook("status", `Status "${s.status}" de uma mensagem que não está no CRM`);
    return;
  }
  // A Meta pode entregar fora de ordem: nunca volta de "lido" para "entregue".
  const ordem = { enviado: 0, entregue: 1, lido: 2, falhou: 3 } as const;
  if (ordem[atual.status as keyof typeof ordem] >= ordem[novo]) return;
  await db.mensagem.update({
    where: { id: atual.id },
    data: { status: novo, ...(novo === "entregue" ? { entregueEm: quando } : {}), ...(novo === "lido" ? { lidaEm: quando, entregueEm: atual.entregueEm ?? quando } : {}) },
  });
  await registrarLogWebhook("status", `Mensagem …${atual.id.slice(-4)}: ${novo}${s.codigoErro ? ` (código ${s.codigoErro})` : ""}`, novo !== "falhou");
  await marcarMudanca();
}

/** Áudio do cliente: vira texto (Whisper) quando a transcrição está ligada; senão o texto avisa que não deu para ouvir. */
async function textoDoAudio(m: MensagemRecebida): Promise<string | null> {
  if (!m.midiaId || !transcricaoConfigurada()) return m.texto; // mensagem padrão de "não consigo ouvir"
  const audio = await baixarMidiaDaMeta(m.midiaId, "audio");
  if (!audio) return "[o cliente enviou um áudio que o sistema não conseguiu processar]";
  const falado = await transcreverAudio(audio.dados, audio.tipo);
  if (!falado) {
    await registrarLogWebhook("mensagem", `Áudio de …${fim(m.telefone)} não pôde ser transcrito`, false);
    return "[o cliente enviou um áudio que o sistema não conseguiu transcrever]";
  }
  // Só o tamanho vai para o log, nunca o que o cliente disse.
  await registrarLogWebhook("mensagem", `Áudio de …${fim(m.telefone)} transcrito (${Math.ceil(audio.dados.length / 1024)} KB)`);
  return `${PREFIXO_AUDIO}${falado}`;
}

/** Grava uma mensagem recebida. Lança só em erro inesperado (banco fora do ar...): aí o evento fica para ser reprocessado. */
async function aplicarMensagem(m: MensagemRecebida) {
  // A Meta reenvia quando não recebe 200 a tempo: a mesma mensagem nunca é processada duas vezes.
  if (await db.mensagem.findUnique({ where: { idExterno: m.idExterno }, select: { id: true } })) {
    await registrarLogWebhook("mensagem", `Mensagem repetida de …${fim(m.telefone)} ignorada`);
    return;
  }
  let midia: { dados: Buffer; tipo: string; nome: string | null } | null = null;
  let texto = m.texto;
  if (m.tipo === "audio") {
    texto = await textoDoAudio(m);
  } else if (m.midiaId) {
    // Imagem, vídeo ou PDF: fica guardado e aparece na conversa e na galeria.
    const arquivo = await baixarMidiaDaMeta(m.midiaId, "arquivo", m.nomeArquivo);
    // Se o conteúdo não confere com o tipo (ex.: executável disfarçado de DWG), não guarda, mas a mensagem do cliente não se perde.
    if (arquivo && !motivoDeRecusaDaMidia(arquivo.dados, arquivo.tipo)) midia = { ...arquivo, nome: m.nomeArquivo };
    else texto = [texto, "[o cliente enviou um arquivo que o sistema não conseguiu baixar ou não aceita (só imagem, vídeo MP4, PDF, Word, Excel e DWG, com tamanho limitado)]"].filter(Boolean).join(" ");
  }
  // Duas tentativas: a primeira pode esbarrar numa corrida (cliente novo mandando 2 mensagens quase juntas, ou a Meta reenviando).
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      await receberMensagemCliente({ telefone: `+${m.telefone}`, nomePerfil: m.nomePerfil, texto, midia, idExterno: m.idExterno, waId: m.telefone });
      await registrarLogWebhook("mensagem", `Mensagem (${m.tipo}) de …${fim(m.telefone)} recebida`);
      return;
    } catch (erro) {
      const conflito = typeof erro === "object" && erro !== null && (erro as { code?: string }).code === "P2002";
      // Só é "repetida" se essa mensagem da Meta realmente já está gravada.
      if (conflito && (await db.mensagem.findUnique({ where: { idExterno: m.idExterno }, select: { id: true } }))) return;
      if (conflito && tentativa === 1) continue;
      if (erro instanceof ErroConversa) {
        await registrarLogWebhook("erro", `Mensagem de …${fim(m.telefone)} não processada: ${erro.message}`, false);
        return; // problema da própria mensagem (ex.: telefone inválido): tentar de novo não resolve
      }
      throw erro;
    }
  }
}

/** Lê e aplica um payload da Meta. Lança em erro inesperado (quem chama decide se tenta de novo). */
async function processarCorpo(payload: unknown): Promise<void> {
  const eventos = extrairEventos(payload);
  for (const s of eventos.statuses) await aplicarStatus(s);
  for (const m of eventos.mensagens) await aplicarMensagem(m);
}

/** Processa um payload sem lançar (erro vai para o log). Usado em testes e onde não há caixa de entrada. */
export async function processarWebhook(payload: unknown): Promise<void> {
  try {
    await processarCorpo(payload);
  } catch {
    await registrarLogWebhook("erro", "Falha ao processar um webhook", false);
  }
}

const MAX_TENTATIVAS_EVENTO = 5;

/** O webhook grava o evento ANTES de responder 200. Se o servidor reiniciar depois, a rotina reprocessa. */
export async function guardarEvento(corpo: string): Promise<number> {
  const e = await db.eventoWebhook.create({ data: { corpo, criadoEm: await agora() } });
  return e.id;
}

/** Processa um evento guardado. Marca como feito se deu certo; senão conta a tentativa (no máximo 5, depois desiste e avisa no log). */
// Eventos que este processo está processando agora: a rotina não os pega de novo (áudio pode demorar, e ele iria 2 vezes à OpenAI).
// Vale para uma instância só (o caso do Railway com 1 réplica); a mensagem em si nunca duplica porque o id da Meta é único.
const emProcessamento = new Set<number>();

export async function processarEventoGuardado(id: number): Promise<void> {
  if (emProcessamento.has(id)) return;
  emProcessamento.add(id);
  try {
    const evento = await db.eventoWebhook.findUnique({ where: { id } });
    if (!evento || evento.processadoEm) return;
    try {
      await processarCorpo(JSON.parse(evento.corpo));
      // O corpo traz o texto do cliente: depois de processado não precisa mais ficar guardado (LGPD).
      await db.eventoWebhook.update({ where: { id }, data: { processadoEm: await agora(), corpo: "" } });
    } catch {
      const tentativas = evento.tentativas + 1;
      const desistiu = tentativas >= MAX_TENTATIVAS_EVENTO;
      await db.eventoWebhook.update({ where: { id }, data: { tentativas, ...(desistiu ? { processadoEm: await agora(), corpo: "" } : {}) } });
      await registrarLogWebhook("erro", desistiu ? "Evento da Meta descartado depois de 5 tentativas" : `Evento da Meta falhou (tentativa ${tentativas}); vai tentar de novo`, false);
    }
  } finally {
    emProcessamento.delete(id);
  }
}

/** Rotina (a cada minuto): reprocessa eventos que ficaram pendentes (mais de 5 minutos sem terminar) e apaga os antigos. */
export async function reprocessarEventosPendentes(): Promise<number> {
  const quando = await agora();
  const pendentes = await db.eventoWebhook.findMany({
    where: { processadoEm: null, criadoEm: { lt: new Date(quando.getTime() - 5 * 60_000) } },
    orderBy: { id: "asc" },
    take: 50,
  });
  for (const e of pendentes) await processarEventoGuardado(e.id);
  // As linhas já processadas só guardam o registro (sem corpo); somem em 2 dias.
  await db.eventoWebhook.deleteMany({ where: { processadoEm: { lt: new Date(quando.getTime() - 2 * 24 * 3600_000) } } });
  return pendentes.length;
}

export async function ultimosLogs(limite = 30) {
  return db.logWebhook.findMany({ orderBy: { id: "desc" }, take: limite });
}

/** Logs de webhook só servem para depurar: apaga os de mais de 14 dias. */
export async function limparLogsAntigos(): Promise<number> {
  const corte = new Date((await agora()).getTime() - 14 * 24 * 3600_000);
  return (await db.logWebhook.deleteMany({ where: { criadoEm: { lt: corte } } })).count;
}
