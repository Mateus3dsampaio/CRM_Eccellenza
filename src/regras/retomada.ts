import { DIA } from "./tempo";

export const DIAS_PARA_RETOMADA = 3; // decisão do Mateus (31/10/2026)
export const DIAS_PARA_SEM_RESPOSTA = 4; // PROVISÓRIO

export interface EstadoRetomada {
  etapa: string;
  modoAtendimento: string;
  aguardandoHumano: boolean;
  temVisitaFutura: boolean;
  arquivadoEm: Date | null;
  ultimaMsgClienteEm: Date | null;
  ultimaMsgLojaEm: Date | null;
  retomadaEnviadaEm: Date | null;
}

export type AcaoRetomada = "enviar_retomada" | "mover_sem_resposta" | null;

/**
 * Decide o que a rotina faz com um lead (RET-01 e RET-03).
 * Só vale para quem está com o bot, no "Novo", devendo resposta ao bot. Lead passado ao consultor, com visita marcada
 * ou esperando a loja nunca recebe retomada nem vai sozinho para Perdido ("Parou de responder", antiga coluna "Sem resposta").
 */
export function avaliarRetomada(lead: EstadoRetomada, agora: Date): AcaoRetomada {
  if (lead.arquivadoEm) return null;
  if (lead.etapa !== "novo") return null;
  if (lead.modoAtendimento !== "bot" || lead.aguardandoHumano || lead.temVisitaFutura) return null;
  if (!lead.ultimaMsgLojaEm) return null;

  const clienteRespondeuDepois = (desde: Date) =>
    lead.ultimaMsgClienteEm !== null && lead.ultimaMsgClienteEm.getTime() > desde.getTime();

  if (lead.retomadaEnviadaEm) {
    // Nunca mais de uma retomada por lead; depois dela, só o "Parou de responder".
    if (clienteRespondeuDepois(lead.retomadaEnviadaEm)) return null;
    const passou = agora.getTime() - lead.retomadaEnviadaEm.getTime();
    return passou >= DIAS_PARA_SEM_RESPOSTA * DIA ? "mover_sem_resposta" : null;
  }

  // A última mensagem precisa ser da loja (o cliente está devendo resposta).
  if (clienteRespondeuDepois(lead.ultimaMsgLojaEm)) return null;
  const passou = agora.getTime() - lead.ultimaMsgLojaEm.getTime();
  return passou >= DIAS_PARA_RETOMADA * DIA ? "enviar_retomada" : null;
}
