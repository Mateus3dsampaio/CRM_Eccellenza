// Avisos com o CRM fechado (Web Push): quem recebe e o que vai escrito. Só regra, sem banco nem rede.
import type { AlertaTela, TipoAlerta } from "./alertas";

export interface DestinoPush {
  usuarioId: string;
  perfil: string;
}

/** Quanto do texto da mensagem vai no aviso (como o WhatsApp: um trecho). */
export const TRECHO_MAXIMO_PUSH = 110;

/**
 * Quem recebe: o admin recebe tudo; o consultor só os avisos dos seus leads, e nunca o de prazo vencido
 * (o mesmo que a tela já faz com os avisos de dentro do CRM).
 */
export function quemRecebePush(alerta: { tipo: TipoAlerta; consultorId: string | null }, destinos: DestinoPush[]): string[] {
  const ids = destinos
    .filter((d) => d.perfil === "admin" || (alerta.tipo !== "prazo_vermelho" && alerta.consultorId !== null && alerta.consultorId === d.usuarioId))
    .map((d) => d.usuarioId);
  return [...new Set(ids)];
}

export interface AvisoPush {
  titulo: string;
  corpo: string;
  /** Avisos com a mesma marca se substituem (o do CRM aberto e o do sistema não aparecem em dobro). */
  tag: string;
  /** Para onde o clique leva. */
  url: string;
}

function trecho(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > TRECHO_MAXIMO_PUSH ? `${limpo.slice(0, TRECHO_MAXIMO_PUSH - 1).trimEnd()}…` : limpo;
}

/** Mensagem nova do cliente: nome do cliente no título e o trecho da mensagem embaixo (como no WhatsApp). Os outros avisos usam o texto de sempre. */
export function montarAvisoPush(alerta: Pick<AlertaTela, "id" | "tipo" | "leadId" | "leadNome" | "consultorId" | "consultorNome" | "texto">, usuarioId: string, textoDoAlerta: (a: Pick<AlertaTela, "tipo" | "leadNome" | "consultorId" | "consultorNome" | "texto">, usuarioId: string) => { titulo: string; corpo: string }): AvisoPush {
  const base = { tag: `alerta-${alerta.id}`, url: `/lead/${alerta.leadId}` };
  if (alerta.tipo === "mensagem") return { ...base, titulo: alerta.leadNome, corpo: trecho(alerta.texto ?? "") || "Nova mensagem" };
  const { titulo, corpo } = textoDoAlerta(alerta, usuarioId);
  return { ...base, titulo, corpo: trecho(corpo) };
}
