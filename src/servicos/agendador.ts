import { rodarRotinas } from "./rotinas";

// Agendador das rotinas de tempo (tarefa 11): em produção ninguém precisa estar com o kanban aberto.
// Roda a cada minuto: retomada, "Parou de responder" (Perdido), limpeza de arquivados e avisos de retorno/prazo vermelho.
export const INTERVALO_ROTINAS_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

/** Liga o agendador uma única vez por processo. Devolve false se já estava ligado. */
export function iniciarAgendador(opcoes: { intervaloMs?: number; executar?: () => Promise<unknown> } = {}): boolean {
  if (timer) return false;
  const executar = opcoes.executar ?? rodarRotinas;
  timer = setInterval(() => {
    // rodarRotinas já impede duas execuções ao mesmo tempo. Erro não derruba o servidor.
    executar().catch((erro) => console.error("[rotinas] falhou:", erro instanceof Error ? erro.message : "desconhecido"));
  }, opcoes.intervaloMs ?? INTERVALO_ROTINAS_MS);
  // Não impede o processo de encerrar (testes, reinício do Railway).
  timer.unref?.();
  return true;
}

export function pararAgendador() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Em produção liga sozinho; em desenvolvimento só com ROTINAS_AUTO=1 (as rotinas rodam ao abrir telas). */
export function agendadorDeveLigar(env: Record<string, string | undefined> = process.env): boolean {
  if (env.ROTINAS_AUTO === "0") return false;
  return env.NODE_ENV === "production" || env.ROTINAS_AUTO === "1";
}
