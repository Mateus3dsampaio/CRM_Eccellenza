// O Next chama isto uma vez quando o servidor sobe.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Primeiro uso em produção: cria o administrador a partir das variáveis ADMIN_* (se o banco estiver vazio).
  try {
    const { garantirPrimeiroAdmin } = await import("./servicos/usuarios");
    await garantirPrimeiroAdmin();
  } catch (erro) {
    console.error("[usuarios] não criei o administrador inicial:", erro instanceof Error ? erro.message : "erro");
  }
  // Tarefa 11: rotinas de tempo rodam sozinhas, sem ninguém com o kanban aberto.
  const { agendadorDeveLigar, iniciarAgendador } = await import("./servicos/agendador");
  if (agendadorDeveLigar()) iniciarAgendador();
}
