// Distribuição de leads entre os consultores (etapas H e I).
export type ModoDistribuicao = "menos_leads" | "rodizio";
/** offline = fora do expediente ou ainda não chegou (tarefa 35): não recebe lead. */
export type StatusConsultor = "online" | "almoco" | "offline";

export const MODOS_DISTRIBUICAO: { codigo: ModoDistribuicao; nome: string; descricao: string }[] = [
  { codigo: "rodizio", nome: "Rodízio", descricao: "O primeiro lead vai para o consultor 1, o segundo para o 2, e assim por diante. Com dois consultores, alterna entre eles." },
  { codigo: "menos_leads", nome: "Quem tem menos leads", descricao: "O lead vai para o consultor com menos leads em andamento." },
];

export interface Candidato {
  id: string;
  online: boolean;
  leadsEmAndamento: number;
}

/**
 * Escolhe o consultor do próximo lead.
 * `ordem` é a ordem fixa da equipe (consultor 1, 2, ...). Só quem está online recebe.
 * Rodízio: o próximo depois do último que recebeu, pulando quem está em almoço. Sem ninguém online: null.
 */
export function escolherConsultor(modo: ModoDistribuicao, ordem: Candidato[], ultimoId: string | null): string | null {
  const online = ordem.filter((c) => c.online);
  if (!online.length) return null;
  if (modo === "menos_leads") return online.reduce((a, b) => (b.leadsEmAndamento < a.leadsEmAndamento ? b : a)).id;
  const posicaoUltimo = ordem.findIndex((c) => c.id === ultimoId);
  for (let passo = 1; passo <= ordem.length; passo++) {
    const candidato = ordem[(posicaoUltimo + passo + ordem.length) % ordem.length];
    if (candidato.online) return candidato.id;
  }
  return null;
}
