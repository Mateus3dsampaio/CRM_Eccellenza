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
  // Tarefa 21: cards nas colunas antigas (Visita agendada, Orçamento apresentado, Sem resposta) vão para as novas, uma vez.
  try {
    const { converterFunilAntigo } = await import("./servicos/conversao-funil");
    const n = await converterFunilAntigo();
    if (n) console.log(`[funil] ${n} card(s) passaram para as colunas novas.`);
  } catch (erro) {
    console.error("[funil] não converti as colunas antigas:", erro instanceof Error ? erro.message : "erro");
  }
  // Apresentações de antes do placar (card que foi de Apresentação para Negociação/Fechado) viram "realizadas", uma vez.
  try {
    const { converterApresentacoesAntigas } = await import("./servicos/apresentacoes");
    const n = await converterApresentacoesAntigas();
    if (n) console.log(`[apresentacoes] ${n} apresentação(ões) antiga(s) marcada(s) como realizada(s) pelo histórico.`);
  } catch (erro) {
    console.error("[apresentacoes] não converti as apresentações antigas:", erro instanceof Error ? erro.message : "erro");
  }
  // Tarefa 11: rotinas de tempo rodam sozinhas, sem ninguém com o kanban aberto.
  const { agendadorDeveLigar, iniciarAgendador } = await import("./servicos/agendador");
  if (agendadorDeveLigar()) iniciarAgendador();
}
