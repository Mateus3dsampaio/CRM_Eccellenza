import { createHmac, timingSafeEqual } from "node:crypto";

// Regras puras do webhook do WhatsApp (API oficial da Meta): assinatura, verificação e leitura do payload.

/** Confere o cabeçalho X-Hub-Signature-256 ("sha256=<hex>") contra o corpo EXATO recebido. */
export function assinaturaValida(corpo: string, cabecalho: string | null, segredoApp: string): boolean {
  if (!cabecalho || !cabecalho.startsWith("sha256=")) return false;
  const esperado = createHmac("sha256", segredoApp).update(corpo, "utf8").digest();
  const recebido = Buffer.from(cabecalho.slice("sha256=".length), "hex");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/** Verificação inicial do webhook (GET): devolve o "challenge" se o token bate, senão null. */
export function responderVerificacao(params: URLSearchParams, tokenEsperado: string): string | null {
  if (params.get("hub.mode") !== "subscribe") return null;
  const token = params.get("hub.verify_token") ?? "";
  const a = Buffer.from(token);
  const b = Buffer.from(tokenEsperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return params.get("hub.challenge") ?? "";
}

export interface MensagemRecebida {
  idExterno: string;
  telefone: string; // só dígitos, como a Meta manda (ex.: 5588999990000)
  nomePerfil: string | null;
  texto: string | null;
  midiaId: string | null; // imagem, vídeo, documento ou áudio: id para baixar
  nomeArquivo: string | null; // documento: nome original do arquivo
  tipo: string;
}

export interface StatusRecebido {
  idExterno: string;
  status: "sent" | "delivered" | "read" | "failed";
  codigoErro: number | null;
}

export interface EventosWebhook {
  mensagens: MensagemRecebida[];
  statuses: StatusRecebido[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Começo do texto de um áudio transcrito. Quem lê o texto (ex.: pedido de PARAR) tira este prefixo antes de comparar. */
export const PREFIXO_AUDIO = "[áudio transcrito automaticamente] ";

// PROVISÓRIO: texto que o bot "lê" quando o cliente manda algo que o sistema ainda não entende. O Mateus pode trocar.
export const NAO_ENTENDIDO: Record<string, string> = {
  audio: "[o cliente enviou um áudio, que o sistema ainda não consegue ouvir]",
  sticker: "[o cliente enviou uma figurinha]",
  location: "[o cliente enviou uma localização]",
  contacts: "[o cliente enviou um contato]",
};
export const NAO_ENTENDIDO_OUTRO = "[o cliente enviou algo que o sistema não entende]";
/** Áudio com a transcrição ligada, mas que falhou. */
export const AUDIO_NAO_PROCESSADO = "[o cliente enviou um áudio que o sistema não conseguiu processar]";
export const AUDIO_NAO_TRANSCRITO = "[o cliente enviou um áudio que o sistema não conseguiu transcrever]";

/** Lê o payload da Meta e separa mensagens recebidas e atualizações de status. Ignora o que não conhece. */
export function extrairEventos(payload: unknown): EventosWebhook {
  const saida: EventosWebhook = { mensagens: [], statuses: [] };
  for (const entrada of lista(obj(payload).entry)) {
    for (const mudanca of lista(obj(entrada).changes)) {
      const valor = obj(obj(mudanca).value);
      const nomes = new Map<string, string>();
      for (const c of lista(valor.contacts)) {
        const ct = obj(c);
        const nome = texto(obj(ct.profile).name);
        if (typeof ct.wa_id === "string" && nome) nomes.set(ct.wa_id, nome);
      }
      for (const m of lista(valor.messages)) {
        const msg = obj(m);
        const id = texto(msg.id);
        const de = texto(msg.from);
        const tipo = texto(msg.type) ?? "desconhecido";
        if (!id || !de) continue;
        let conteudo: string | null = null;
        let midiaId: string | null = null;
        let nomeArquivo: string | null = null;
        if (tipo === "text") conteudo = texto(obj(msg.text).body);
        else if (tipo === "image") {
          midiaId = texto(obj(msg.image).id);
          conteudo = texto(obj(msg.image).caption);
        } else if (tipo === "video") {
          midiaId = texto(obj(msg.video).id);
          conteudo = texto(obj(msg.video).caption);
        } else if (tipo === "document") {
          midiaId = texto(obj(msg.document).id);
          nomeArquivo = texto(obj(msg.document).filename);
          conteudo = texto(obj(msg.document).caption);
        } else if (tipo === "audio") {
          // O texto abaixo é o que vale se a transcrição estiver desligada ou falhar (servicos/whatsapp.ts).
          midiaId = texto(obj(msg.audio).id);
          conteudo = NAO_ENTENDIDO.audio;
        } else if (tipo === "button") conteudo = texto(obj(msg.button).text);
        else if (tipo === "interactive") {
          const i = obj(msg.interactive);
          conteudo = texto(obj(i.button_reply).title) ?? texto(obj(i.list_reply).title);
        } else conteudo = NAO_ENTENDIDO[tipo] ?? NAO_ENTENDIDO_OUTRO;
        if (!conteudo && !midiaId) continue;
        saida.mensagens.push({ idExterno: id, telefone: de, nomePerfil: nomes.get(de) ?? null, texto: conteudo, midiaId, nomeArquivo, tipo });
      }
      for (const s of lista(valor.statuses)) {
        const st = obj(s);
        const id = texto(st.id);
        const status = texto(st.status);
        if (!id || !status || !["sent", "delivered", "read", "failed"].includes(status)) continue;
        const erro = Number(obj(lista(st.errors)[0]).code);
        saida.statuses.push({ idExterno: id, status: status as StatusRecebido["status"], codigoErro: Number.isFinite(erro) ? erro : null });
      }
    }
  }
  return saida;
}
