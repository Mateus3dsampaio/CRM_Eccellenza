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
