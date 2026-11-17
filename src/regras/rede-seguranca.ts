// Rede de segurança (tarefa 41): nenhum lead fica para sempre com o bot. Depois de X dias sem mensagem do cliente,
// não importa quem falou por último, o card sai da coluna: vai para Perdido, ou direto para o arquivo se for pós-venda
// (decisões do Mateus 16/11/2026). Substituiu a retomada antiga (modelo após 3 dias), que saiu em 17/11/2026.
// Só regra, sem banco.
import { DIA } from "./tempo";

export interface RegrasRedeDeSeguranca {
  ligado: boolean;
  /** Dias, em relógio corrido, desde a última mensagem do cliente. */
  dias: number;
}

/** Desligada de fábrica; 5 dias é decisão do Mateus (16/11/2026). */
export const REGRAS_REDE_PADRAO: RegrasRedeDeSeguranca = { ligado: false, dias: 5 };

export function completarRegrasRede(r: Partial<RegrasRedeDeSeguranca>): RegrasRedeDeSeguranca {
  return { ...REGRAS_REDE_PADRAO, ...r };
}

export function validarRegrasRede(r: RegrasRedeDeSeguranca): string | null {
  if (typeof r.ligado !== "boolean") return "Opção inválida.";
  if (!Number.isInteger(r.dias) || r.dias < 1 || r.dias > 60) return "Rede de segurança: de 1 a 60 dias.";
  return null;
}

export interface EstadoRede {
  etapa: string;
  arquivadoEm: Date | null;
  classificacao: string | null;
  modoAtendimento: string;
  aguardandoHumano: boolean;
  temVisitaFutura: boolean;
  /** Retorno marcado (pelo bot com a loja fechada, ou por uma pessoa): enquanto estiver no futuro, o lead espera. */
  proximoContatoEm: Date | null;
  ultimaMsgClienteEm: Date | null;
  /** Um consultor já entrou nesta conversa (ver `EstadoRecuperacao.passouPorHumano`): a rotina não mexe. */
  passouPorHumano: boolean;
}

export type AcaoRede = "perdido" | "arquivar" | null;

/**
 * O que a rotina faz com o lead agora. Só vale para quem está com o bot e nunca passou por um consultor: lead passado ao consultor, com visita ou
 * retorno marcado para a frente, em Perdido/Fechado ou arquivado fica como está. Pós-venda não é venda perdida:
 * vai direto para o arquivo, sem passar por Perdido (não distorce as métricas de perda).
 */
export function avaliarRede(lead: EstadoRede, r: RegrasRedeDeSeguranca, agora: Date): AcaoRede {
  if (!r.ligado || lead.arquivadoEm || lead.passouPorHumano) return null;
  if (lead.etapa === "perdido" || lead.etapa === "fechado") return null;
  if (lead.modoAtendimento !== "bot" || lead.aguardandoHumano || lead.temVisitaFutura) return null;
  if (lead.proximoContatoEm && lead.proximoContatoEm.getTime() > agora.getTime()) return null;
  if (!lead.ultimaMsgClienteEm) return null;
  if (agora.getTime() - lead.ultimaMsgClienteEm.getTime() < r.dias * DIA) return null;
  return lead.classificacao === "pos_venda" ? "arquivar" : "perdido";
}
