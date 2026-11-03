import { HORA } from "./tempo";

// Proteção do bot (tarefa 14): cliente que manda mensagem demais não gera chamada à API do Claude.
// PROVISÓRIO: valores propostos, o Mateus aprova ou muda.
export const LIMITE_POR_MINUTO = 8;
export const LIMITE_POR_DIA = 150;
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
