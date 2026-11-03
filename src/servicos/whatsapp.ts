import { db } from "@/lib/db";
import { TAMANHO_MAXIMO, tipoImagemValido } from "@/lib/midias";
import { lerConfigWhatsapp } from "@/lib/whatsapp-config";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { extrairEventos, type MensagemRecebida, type StatusRecebido } from "@/regras/whatsapp";
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
  erro?: string;
}

/** Envia texto livre (dentro da janela de 24h) ou um modelo aprovado. O nome do modelo na Meta é o código do modelo no CRM. */
export async function enviarPelaMeta(params: { para: string; texto?: string; modelo?: string }): Promise<ResultadoEnvio> {
  const cfg = lerConfigWhatsapp();
  if (!cfg) return { ok: false, erro: "WhatsApp não configurado" };
  const para = params.para.replace(/\D/g, "");
  const corpo = params.modelo
    ? { messaging_product: "whatsapp", to: para, type: "template", template: { name: params.modelo, language: { code: cfg.idiomaModelos } } }
    : { messaging_product: "whatsapp", to: para, type: "text", text: { body: params.texto ?? "", preview_url: false } };
  try {
    const resposta = await fetch(`https://graph.facebook.com/${cfg.versaoApi}/${cfg.numeroId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    const json = (await resposta.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { code?: number; message?: string } };
    if (!resposta.ok || !json.messages?.[0]?.id) {
      // Só o código do erro vai para o log: a mensagem da Meta pode trazer dados do cliente.
      const erro = `a Meta recusou o envio (HTTP ${resposta.status}, código ${json.error?.code ?? "?"})`;
      await registrarLogWebhook("envio", `Envio para …${fim(para)}: ${erro}`, false);
      return { ok: false, erro };
    }
    return { ok: true, id: json.messages[0].id };
  } catch {
    await registrarLogWebhook("envio", `Envio para …${fim(para)}: sem resposta da Meta`, false);
    return { ok: false, erro: "sem resposta da Meta" };
  }
}

/** Baixa a imagem que o cliente mandou (2 passos: pede o endereço, depois baixa com o token). */
export async function baixarMidiaDaMeta(midiaId: string): Promise<{ dados: Buffer; tipo: string } | null> {
  const cfg = lerConfigWhatsapp();
  if (!cfg) return null;
  try {
    const cabecalho = { Authorization: `Bearer ${cfg.token}` };
    const info = await fetch(`https://graph.facebook.com/${cfg.versaoApi}/${encodeURIComponent(midiaId)}`, { headers: cabecalho, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    const meta = (await info.json()) as { url?: string; mime_type?: string };
    if (!info.ok || !meta.url || !meta.mime_type) return null;
    // Só baixa de servidor da Meta/Facebook (evita o webhook ser usado para fazer o servidor visitar outro lugar).
    const destino = new URL(meta.url);
    if (destino.protocol !== "https:" || !/(^|\.)(facebook\.com|fbcdn\.net|fbsbx\.com|whatsapp\.net|facebook\.net)$/.test(destino.hostname)) return null;
    const tipo = meta.mime_type.split(";")[0];
    if (!tipoImagemValido(tipo)) return null;
    // "manual": se a Meta redirecionar para outro lugar, o token NÃO vai junto (seria vazamento).
    const arquivo = await fetch(destino, { headers: cabecalho, redirect: "manual", signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (!arquivo.ok) return null;
    const declarado = Number(arquivo.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > TAMANHO_MAXIMO) return null;
    const dados = Buffer.from(await arquivo.arrayBuffer());
    if (dados.length > TAMANHO_MAXIMO) return null;
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

async function aplicarMensagem(m: MensagemRecebida) {
  // A Meta reenvia quando não recebe 200 a tempo: a mesma mensagem nunca é processada duas vezes.
  if (await db.mensagem.findUnique({ where: { idExterno: m.idExterno }, select: { id: true } })) {
    await registrarLogWebhook("mensagem", `Mensagem repetida de …${fim(m.telefone)} ignorada`);
    return;
  }
  let imagem: { dados: Buffer; tipo: string } | null = null;
  let texto = m.texto;
  if (m.midiaId) {
    imagem = await baixarMidiaDaMeta(m.midiaId);
    if (!imagem) texto = [texto, "[o cliente enviou uma imagem que o sistema não conseguiu baixar]"].filter(Boolean).join(" ");
  }
  // Duas tentativas: a primeira pode esbarrar numa corrida (cliente novo mandando 2 mensagens quase juntas, ou a Meta reenviando).
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      await receberMensagemCliente({ telefone: `+${m.telefone}`, nomePerfil: m.nomePerfil, texto, imagem, idExterno: m.idExterno });
      await registrarLogWebhook("mensagem", `Mensagem (${m.tipo}) de …${fim(m.telefone)} recebida`);
      return;
    } catch (erro) {
      const conflito = typeof erro === "object" && erro !== null && (erro as { code?: string }).code === "P2002";
      // Só é "repetida" se essa mensagem da Meta realmente já está gravada.
      if (conflito && (await db.mensagem.findUnique({ where: { idExterno: m.idExterno }, select: { id: true } }))) return;
      if (conflito && tentativa === 1) continue;
      const motivo = erro instanceof ErroConversa ? erro.message : "erro inesperado";
      await registrarLogWebhook("erro", `Mensagem de …${fim(m.telefone)} não processada: ${motivo}`, false);
      return;
    }
  }
}

/** Processa o que a Meta mandou. Nunca lança: o webhook já respondeu 200 e erro vai para o log. */
export async function processarWebhook(payload: unknown): Promise<void> {
  try {
    const eventos = extrairEventos(payload);
    for (const s of eventos.statuses) await aplicarStatus(s);
    for (const m of eventos.mensagens) await aplicarMensagem(m);
  } catch {
    await registrarLogWebhook("erro", "Falha ao processar um webhook", false);
  }
}

export async function ultimosLogs(limite = 30) {
  return db.logWebhook.findMany({ orderBy: { id: "desc" }, take: limite });
}

/** Logs de webhook só servem para depurar: apaga os de mais de 14 dias. */
export async function limparLogsAntigos(): Promise<number> {
  const corte = new Date((await agora()).getTime() - 14 * 24 * 3600_000);
  return (await db.logWebhook.deleteMany({ where: { criadoEm: { lt: corte } } })).count;
}
