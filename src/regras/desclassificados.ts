// Desclassificados (tarefa 40): cliente que a loja não atende (outra cidade, curioso ou sem perfil) não recebe
// mensagem de recuperação e sai sozinho da coluna do bot para Perdido. Só regra, sem banco.
import { HORA } from "./tempo";

/** Classificação do bot → motivo de perda que a rotina grava (cadastrado sozinho em `servicos/vendas.ts`). */
export const MOTIVOS_DESCLASSIFICADO: Record<string, { codigo: string; nome: string }> = {
  outra_cidade: { codigo: "outra_cidade_automatico", nome: "Outra cidade (automático)" },
  // "Sem perfil" usa a classificação `curioso` (decisão do Mateus 16/11/2026): só um pedaço do móvel, só as portas, aproveitar móvel existente.
  curioso: { codigo: "sem_perfil_automatico", nome: "Curioso / sem perfil (automático)" },
};

export function classificacaoDesclassificada(classificacao: string | null | undefined): boolean {
  return !!classificacao && classificacao in MOTIVOS_DESCLASSIFICADO;
}

export interface RegrasDesclassificados {
  ligado: boolean;
  /** Horas, em relógio corrido, desde a última mensagem do cliente até o card ir para Perdido. */
  horas: number;
}

/** Desligado de fábrica; 24 horas é decisão do Mateus (16/11/2026). */
export const REGRAS_DESCLASSIFICADOS_PADRAO: RegrasDesclassificados = { ligado: false, horas: 24 };

export function completarRegrasDesclassificados(r: Partial<RegrasDesclassificados>): RegrasDesclassificados {
  return { ...REGRAS_DESCLASSIFICADOS_PADRAO, ...r };
}

export function validarRegrasDesclassificados(r: RegrasDesclassificados): string | null {
  if (typeof r.ligado !== "boolean") return "Opção inválida.";
  if (!Number.isInteger(r.horas) || r.horas < 1 || r.horas > 168) return "Desclassificados: de 1 a 168 horas.";
  return null;
}

export interface EstadoDesclassificado {
  etapa: string;
  arquivadoEm: Date | null;
  classificacao: string | null;
  modoAtendimento: string;
  aguardandoHumano: boolean;
  temVisitaFutura: boolean;
  ultimaMsgClienteEm: Date | null;
}

/**
 * Motivo de perda com que o lead deve ir para Perdido agora, ou null. Só vale para quem está com o bot: lead passado
 * ao consultor, com visita marcada, já em Perdido/Fechado ou arquivado fica como está. Se o cliente escrever, o prazo
 * recomeça (e, depois de movido, o card volta para a coluna em que estava: `servicos/mensagens.ts`).
 */
export function avaliarDesclassificado(lead: EstadoDesclassificado, r: RegrasDesclassificados, agora: Date): string | null {
  if (!r.ligado || lead.arquivadoEm) return null;
  if (lead.etapa === "perdido" || lead.etapa === "fechado") return null;
  if (lead.modoAtendimento !== "bot" || lead.aguardandoHumano || lead.temVisitaFutura) return null;
  const motivo = lead.classificacao ? MOTIVOS_DESCLASSIFICADO[lead.classificacao] : undefined;
  if (!motivo || !lead.ultimaMsgClienteEm) return null;
  return agora.getTime() - lead.ultimaMsgClienteEm.getTime() >= r.horas * HORA ? motivo.codigo : null;
}
