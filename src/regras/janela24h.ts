import { HORA } from "./tempo";

// Regra da Meta (MSG-02): texto livre só até 24h depois da última mensagem do cliente.
export const JANELA_MS = 24 * HORA;

export function janelaAberta(ultimaMsgClienteEm: Date | null | undefined, agora: Date): boolean {
  if (!ultimaMsgClienteEm) return false;
  const passou = agora.getTime() - ultimaMsgClienteEm.getTime();
  return passou >= 0 && passou < JANELA_MS;
}

export function janelaFechaEm(ultimaMsgClienteEm: Date | null | undefined): Date | null {
  return ultimaMsgClienteEm ? new Date(ultimaMsgClienteEm.getTime() + JANELA_MS) : null;
}

// Relógio da janela no card (tarefa 37). Limites PROVISÓRIOS (decisão do Mateus 07/11/2026: 6 h e 2 h).
export const LIMITE_JANELA_AMARELO_MS = 6 * HORA;
export const LIMITE_JANELA_VERMELHO_MS = 2 * HORA;

export type FaixaJanela = "verde" | "amarelo" | "vermelho" | "fechada";

export interface SituacaoJanela {
  faixa: FaixaJanela;
  /** Quanto falta para fechar, em ms (0 se fechada). */
  restanteMs: number;
  /** Fração das 24h que ainda sobra, de 0 a 1 (para o anel). */
  fracao: number;
  /** "5 h", "1 h 40 min", "35 min", "menos de 1 min"; vazio se fechada. */
  texto: string;
}

type Instante = Date | string | null | undefined;

/** "5 h", "1 h 40 min", "35 min". Arredonda para baixo, em minutos. */
export function textoDeRestante(restanteMs: number): string {
  const minutos = Math.floor(restanteMs / 60_000);
  if (minutos < 1) return "menos de 1 min";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

/** Faixa e tempo restante da janela de 24h. Sem mensagem do cliente (ou data inválida), a janela está fechada. */
export function situacaoDaJanela(ultimaMsgClienteEm: Instante, agora: Date): SituacaoJanela {
  const ms = ultimaMsgClienteEm ? new Date(ultimaMsgClienteEm).getTime() : NaN;
  const fechada: SituacaoJanela = { faixa: "fechada", restanteMs: 0, fracao: 0, texto: "" };
  if (Number.isNaN(ms) || !janelaAberta(new Date(ms), agora)) return fechada;
  const restanteMs = ms + JANELA_MS - agora.getTime();
  const faixa: FaixaJanela = restanteMs <= LIMITE_JANELA_VERMELHO_MS ? "vermelho" : restanteMs <= LIMITE_JANELA_AMARELO_MS ? "amarelo" : "verde";
  return { faixa, restanteMs, fracao: restanteMs / JANELA_MS, texto: textoDeRestante(restanteMs) };
}
