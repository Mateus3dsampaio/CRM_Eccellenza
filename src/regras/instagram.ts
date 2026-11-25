// Regras puras do webhook do Instagram (API de mensagens da Meta, tarefa 47): leitura do payload.
// A assinatura (X-Hub-Signature-256) e a verificação do token são as mesmas do WhatsApp: `regras/whatsapp.ts`.

export interface MensagemInstagram {
  idExterno: string; // "mid" da Meta
  igsid: string; // id do cliente no Instagram (IGSID)
  texto: string | null;
  /** Endereço (https) do arquivo que o cliente mandou: imagem, vídeo ou áudio. */
  midiaUrl: string | null;
  tipoMidia: "image" | "video" | "audio" | null;
  tipo: string;
}

export interface LeituraInstagram {
  idExterno: string;
  igsid: string;
}

export interface EventosInstagram {
  mensagens: MensagemInstagram[];
  /** O cliente abriu a conversa: a mensagem da loja vira "lida". */
  leituras: LeituraInstagram[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

// PROVISÓRIO: o que o bot "lê" quando o cliente manda algo que o sistema não entende (o Mateus pode trocar).
export const INSTAGRAM_NAO_ENTENDIDO: Record<string, string> = {
  share: "[o cliente compartilhou uma publicação do Instagram]",
  ig_post: "[o cliente compartilhou uma publicação do Instagram]",
  story_mention: "[o cliente mencionou a loja em um story]",
  reel: "[o cliente compartilhou um reel]",
  ig_reel: "[o cliente compartilhou um reel]",
  location: "[o cliente enviou uma localização]",
  file: "[o cliente enviou um arquivo, que o sistema não recebe pelo Instagram]",
};
export const INSTAGRAM_NAO_ENTENDIDO_OUTRO = "[o cliente enviou algo que o sistema não entende]";
export const INSTAGRAM_NAO_SUPORTADO = "[o cliente enviou uma mensagem que o Instagram não entregou ao sistema]";
export const INSTAGRAM_MIDIA_NAO_BAIXADA = "[o cliente enviou um arquivo que o sistema não conseguiu baixar ou não aceita]";

/** Só baixa de servidor da Meta/Instagram, por https (evita o webhook ser usado para fazer o servidor visitar outro lugar). */
export function enderecoDeMidiaPermitido(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)(fbcdn\.net|cdninstagram\.com|fbsbx\.com|facebook\.com|instagram\.com)$/.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Lê o payload do Instagram. Ignora o que não conhece, as "echo" (mensagens que a própria loja mandou, inclusive as do CRM)
 * e qualquer mensagem cujo remetente seja a conta da loja (`contaDaLoja`, quando informada).
 */
export function extrairEventosInstagram(payload: unknown, contaDaLoja?: string | null): EventosInstagram {
  const saida: EventosInstagram = { mensagens: [], leituras: [] };
  const raiz = obj(payload);
  if (raiz.object !== "instagram") return saida;
  for (const entrada of lista(raiz.entry)) {
    const idEntrada = texto(obj(entrada).id);
    for (const ev of lista(obj(entrada).messaging)) {
      const e = obj(ev);
      const de = texto(obj(e.sender).id);
      if (!de) continue;
      // A loja falando (ou o CRM, que também aparece como "echo"): nunca vira mensagem de cliente.
      if (de === idEntrada || (contaDaLoja && de === contaDaLoja)) continue;
      const leitura = obj(e.read);
      const midLida = texto(leitura.mid);
      if (midLida) {
        saida.leituras.push({ idExterno: midLida, igsid: de });
        continue;
      }
      const m = obj(e.message);
      const id = texto(m.mid);
      if (!id || m.is_echo === true) continue;
      if (m.is_deleted === true) continue; // o cliente apagou: não há o que mostrar
      let conteudo = texto(m.text);
      let midiaUrl: string | null = null;
      let tipoMidia: MensagemInstagram["tipoMidia"] = null;
      let tipo = conteudo ? "text" : "desconhecido";
      for (const a of lista(m.attachments)) {
        const anexo = obj(a);
        const t = texto(anexo.type) ?? "desconhecido";
        const url = texto(obj(anexo.payload).url);
        if ((t === "image" || t === "video" || t === "audio") && url) {
          if (!midiaUrl) {
            midiaUrl = url;
            tipoMidia = t;
            tipo = t;
          }
        } else if (!conteudo) {
          conteudo = INSTAGRAM_NAO_ENTENDIDO[t] ?? INSTAGRAM_NAO_ENTENDIDO_OUTRO;
          tipo = t;
        }
      }
      if (!conteudo && !midiaUrl) {
        if (m.is_unsupported === true) conteudo = INSTAGRAM_NAO_SUPORTADO;
        else continue;
      }
      saida.mensagens.push({ idExterno: id, igsid: de, texto: conteudo, midiaUrl, tipoMidia, tipo });
    }
  }
  return saida;
}
