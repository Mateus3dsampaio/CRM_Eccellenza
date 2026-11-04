import { inicioDoDiaLocal } from "./tempo";

/**
 * Decisão pendente do vendedor (pedido do Mateus 04/11/2026): toda data vencida exige uma decisão, para nenhum cliente
 * ficar sem retorno. Vence no dia seguinte ao compromisso (na hora marcada o vendedor ainda está atendendo).
 * - Medição agendada: medição feita (marcar a apresentação), remarcar ou Perdido.
 * - Apresentação agendada: cliente veio (Negociação), fechou (Fechado), não veio (remarcar) ou desistiu (Perdido).
 * - Negociação: retorno vencido → fechou (Fechado), não fechou (Perdido) ou ainda negociando (nova data de retorno).
 * Só regra, sem banco.
 */
export type TipoDecisao = "medicao" | "apresentacao" | "negociacao";

export interface Decisao {
  tipo: TipoDecisao;
  /** Data que venceu (compromisso ou retorno). */
  venceuEm: Date;
}

/** Texto curto da etiqueta piscante do card. */
export const ETIQUETA_DECISAO: Record<TipoDecisao, string> = {
  medicao: "Medição passou – decida o próximo passo",
  apresentacao: "Apresentação passou – cliente veio?",
  negociacao: "Retorno vencido – fechou?",
};

/** A data já venceu: é de um dia anterior a hoje (horário de Fortaleza). */
export function venceu(data: Date | string, agora: Date): boolean {
  return new Date(data).getTime() < inicioDoDiaLocal(agora).getTime();
}

export function decisaoPendente(
  lead: { etapa: string; proximoContatoEm?: Date | string | null },
  compromissosAtivos: { tipo: string; inicio: Date | string }[],
  agora: Date,
): Decisao | null {
  if (lead.etapa === "medicao" || lead.etapa === "apresentacao") {
    // Só o compromisso da própria coluna conta (uma visita à loja não decide nada). Sem compromisso, vale a etiqueta "Sem data".
    const c = compromissosAtivos.find((v) => v.tipo === lead.etapa);
    return c && venceu(c.inicio, agora) ? { tipo: lead.etapa, venceuEm: new Date(c.inicio) } : null;
  }
  if (lead.etapa === "negociacao" && lead.proximoContatoEm && venceu(lead.proximoContatoEm, agora)) {
    return { tipo: "negociacao", venceuEm: new Date(lead.proximoContatoEm) };
  }
  return null;
}
