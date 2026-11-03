// Modo simulador (tarefa 13): relógio simulado, chat do cliente fictício e simulação de WhatsApp.
// Em produção fica DESLIGADO, a menos que MODO_SIMULADOR=1. Fora de produção (dev e testes) fica ligado, a menos que =0.
export function modoSimulador(env: Record<string, string | undefined> = process.env): boolean {
  if (env.MODO_SIMULADOR === "1") return true;
  if (env.MODO_SIMULADOR === "0") return false;
  return env.NODE_ENV !== "production";
}
