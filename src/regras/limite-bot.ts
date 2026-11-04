import { HORA } from "./tempo";

// Proteção do bot (tarefa 14): cliente que manda mensagem demais não gera chamada à API do Claude.
// Valores aprovados pelo Mateus em 05/11/2026 (mudam aqui se o uso real pedir).
export const LIMITE_POR_MINUTO = 8;
export const LIMITE_POR_DIA = 150;
/**
 * PDF que o bot lê (PROVISÓRIO, o Mateus aprova ou muda): até 5 MB. O PDF entra inteiro no histórico da conversa e é reenviado
 * (pelo cache) a cada volta; cada página custa alguns milhares de tokens. Acima disso o PDF fica só para o consultor.
 */
export const PDF_MAX_BYTES_PARA_BOT = 5 * 1024 * 1024;

export function pdfCabeParaOBot(bytes: number): boolean {
  return bytes > 0 && bytes <= PDF_MAX_BYTES_PARA_BOT;
}
const MINUTO = 60_000;

export interface ResultadoLimite {
  excedeu: boolean;
  motivo?: string;
}

/** Recebe a hora de cada mensagem do cliente e confere os dois limites. Função pura. */
export function avaliarLimiteDoBot(horasDasMensagens: Date[], agora: Date): ResultadoLimite {
  const t = agora.getTime();
  const noUltimoMinuto = horasDasMensagens.filter((h) => t - h.getTime() <= MINUTO).length;
  if (noUltimoMinuto > LIMITE_POR_MINUTO) {
    return { excedeu: true, motivo: `o cliente mandou mais de ${LIMITE_POR_MINUTO} mensagens em 1 minuto` };
  }
  const noUltimoDia = horasDasMensagens.filter((h) => t - h.getTime() <= 24 * HORA).length;
  if (noUltimoDia > LIMITE_POR_DIA) {
    return { excedeu: true, motivo: `o cliente passou de ${LIMITE_POR_DIA} mensagens em 24 horas` };
  }
  return { excedeu: false };
}
