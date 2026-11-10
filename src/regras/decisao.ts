import { inicioDoDiaLocal } from "./tempo";

/**
 * Decisão pendente do vendedor (pedido do Mateus 04/11/2026): toda data vencida exige uma decisão, para nenhum cliente
 * ficar sem retorno. Vence no dia seguinte ao compromisso (na hora marcada o vendedor ainda está atendendo).
 * - Medição agendada: medição concluída (a apresentação se marca depois, é opcional na hora), remarcar ou Perdido.
 * - Apresentação agendada: concluída (cliente veio → Negociação, ou fechou → Fechado), não veio (remarcar) ou desistiu (Perdido).
 * Compromisso já concluído não pede decisão.
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
  medicao: "Medição passou – foi concluída?",
  apresentacao: "Apresentação passou – foi concluída?",
  negociacao: "Retorno vencido – fechou?",
};

/** A data já venceu: é de um dia anterior a hoje (horário de Fortaleza). */
export function venceu(data: Date | string, agora: Date): boolean {
  return new Date(data).getTime() < inicioDoDiaLocal(agora).getTime();
}

export function decisaoPendente(
  lead: { etapa: string; proximoContatoEm?: Date | string | null },
  compromissosAtivos: { tipo: string; inicio: Date | string; concluidaEm?: Date | string | null }[],
  agora: Date,
): Decisao | null {
  if (lead.etapa === "medicao" || lead.etapa === "apresentacao") {
    // Só o compromisso da própria coluna conta (uma visita à loja não decide nada). Sem compromisso, vale a etiqueta "Sem data".
    const c = compromissosAtivos.find((v) => v.tipo === lead.etapa && !v.concluidaEm);
    return c && venceu(c.inicio, agora) ? { tipo: lead.etapa, venceuEm: new Date(c.inicio) } : null;
  }
  if (lead.etapa === "negociacao" && lead.proximoContatoEm && venceu(lead.proximoContatoEm, agora)) {
    return { tipo: "negociacao", venceuEm: new Date(lead.proximoContatoEm) };
  }
  return null;
}
