import { DIA, dataLocal, inicioDoDiaLocal, inicioDoMesLocal, partesLocais } from "./tempo";

/**
 * Apresentação: o que o vendedor precisa marcar e realizar (teste "coluna Apresentação", Mateus 10/11/2026).
 * 100% dos clientes que compram passam pela apresentação. Só regra, sem banco e sem tela.
 *
 * - REALIZADA = apresentação marcada como concluída ("cliente veio" ou "fechou"), contada no mês da DATA da apresentação,
 *   para o consultor responsável por ela.
 * - AGENDADA = apresentações do mês com data de hoje em diante, mais as vencidas ainda sem decisão.
 * - PRONTO PARA MARCAR = lead que já pode ter a apresentação marcada e ainda não tem (medição concluída, ou cliente que
 *   já tem projeto e pulou a medição).
 */

export type OrigemDoPronto = "medicao" | "projeto";

export interface LeadParaPronto {
  etapa: string;
  arquivado?: boolean;
  pulouMedicaoEm?: Date | string | null;
  /** Compromissos de medição e apresentação ativos do lead (a medição pode estar concluída). */
  compromissos: { tipo: string; concluidaEm?: Date | string | null }[];
}

/**
 * Pronto para marcar a apresentação (c: sai quando a apresentação é marcada, ou se o lead for para Perdido/arquivado).
 * - Medição concluída e sem apresentação marcada: o card fica em Medição agendada.
 * - Cliente que já tem projeto (vendedor pulou a medição) e sem apresentação marcada: o card fica em Em qualificação.
 */
export function prontoParaMarcar(lead: LeadParaPronto): OrigemDoPronto | null {
  if (lead.arquivado) return null;
  if (lead.compromissos.some((c) => c.tipo === "apresentacao" && !c.concluidaEm)) return null;
  const medicoes = lead.compromissos.filter((c) => c.tipo === "medicao");
  if (lead.etapa === "medicao") {
    // Medição concluída e nenhuma medição nova pendente (remarcar a medição desfaz o "pronto").
    return medicoes.some((c) => c.concluidaEm) && !medicoes.some((c) => !c.concluidaEm) ? "medicao" : null;
  }
  if (lead.etapa === "qualificacao" && lead.pulouMedicaoEm && !medicoes.length) return "projeto";
  return null;
}

/** Aviso interno antes de abrir a agenda da apresentação de quem pulou a medição (texto proposto; o Mateus aprova nos prints). */
export const TEXTO_ESTIMATIVA = {
  titulo: "Estimativa de valores",
  pergunta: "A estimativa de valores já foi alinhada com o cliente?",
  regra: "Regra da loja: não marcamos apresentação sem o cliente ter uma estimativa. Se ele não souber dizer quanto pretende investir, analise o projeto ou as fotos e passe uma estimativa antes.",
  sim: "Sim, já alinhei",
  nao: "Ainda não",
  historico: "Confirmou que a estimativa de valores foi alinhada com o cliente (antes de marcar a apresentação)",
} as const;

/** Antes de marcar a apresentação, pergunta da estimativa: só para quem pulou a medição e ainda não confirmou. */
export function precisaConfirmarEstimativa(lead: { pulouMedicaoEm?: Date | string | null; estimativaAlinhadaEm?: Date | string | null }): boolean {
  return !!lead.pulouMedicaoEm && !lead.estimativaAlinhadaEm;
}

// ---------- Placar do mês ----------

export interface PeriodoDoPlacar {
  inicio: Date;
  /** Primeiro instante do mês seguinte. */
  fim: Date;
  /** Dias que restam no mês, contando hoje. */
  diasRestantes: number;
  /** Ex.: "novembro". */
  nomeDoMes: string;
}

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Mês do placar no fuso de Fortaleza. */
export function periodoDoPlacar(agora: Date): PeriodoDoPlacar {
  const p = partesLocais(agora);
  const inicio = inicioDoMesLocal(agora);
  const fim = dataLocal(p.ano, p.mes + 1, 1);
  return { inicio, fim, diasRestantes: Math.max(1, Math.round((fim.getTime() - inicioDoDiaLocal(agora).getTime()) / DIA)), nomeDoMes: NOMES_MES[p.mes - 1] };
}

export interface Ritmo {
  faltam: number;
  /** Meta batida (ou superada). */
  batida: boolean;
  /** Apresentações por semana que ainda precisa fazer (arredondado para cima). */
  porSemana: number;
  texto: string;
}

/** "faltam 8, precisa de 3 por semana" pelos dias que restam no mês. Na última semana do mês, fala em dias. */
export function ritmoDaMeta(realizadas: number, meta: number, diasRestantes: number): Ritmo {
  const faltam = Math.max(0, meta - realizadas);
  if (faltam === 0) return { faltam, batida: true, porSemana: 0, texto: realizadas > meta ? `Meta batida (+${realizadas - meta})` : "Meta batida" };
  const dias = Math.max(1, diasRestantes);
  const porSemana = Math.ceil((faltam * 7) / dias);
  const texto = dias < 7 ? `faltam ${faltam}, restam ${dias} ${dias === 1 ? "dia" : "dias"}` : `faltam ${faltam}, precisa de ${porSemana} por semana`;
  return { faltam, batida: false, porSemana, texto };
}

/** Parte do anel/barra preenchida (0 a 1). */
export function progressoDaMeta(realizadas: number, meta: number): number {
  return meta > 0 ? Math.min(1, Math.max(0, realizadas / meta)) : 0;
}

// ---------- Meta por vendedor (guardada em Configuracao, chave metas_apresentacao) ----------

export const META_MAXIMA = 999;
export type MetasApresentacao = Record<string, number>;

/** Lê o JSON guardado. Ignora o que não for número inteiro de 1 a 999 (sem meta = não está no mapa). */
export function lerMetas(bruto: string | null): MetasApresentacao {
  try {
    const obj = bruto ? JSON.parse(bruto) : null;
    if (!obj || typeof obj !== "object") return {};
    return Object.fromEntries(Object.entries(obj as Record<string, unknown>).filter(([, v]) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= META_MAXIMA)) as MetasApresentacao;
  } catch {
    return {};
  }
}

/** Valida o que o admin digitou: cada meta é um inteiro de 1 a 999; zero ou vazio (null) tira a meta. */
export function validarMeta(valor: unknown): string | null {
  if (valor === null) return null;
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 0 || valor > META_MAXIMA) return `A meta é um número inteiro de 1 a ${META_MAXIMA} (deixe vazio para tirar a meta).`;
  return null;
}

export interface ContagemDoVendedor {
  realizadas: number;
  agendadas: number;
}

export interface PlacarVisto {
  realizadas: number;
  agendadas: number;
  /** Sem meta definida: só a contagem, sem barra. */
  meta: number | null;
}

/**
 * O que a pessoa enxerga. Consultor: só o dele. Admin: a soma da loja ou, com um vendedor escolhido no quadro, o dele.
 * A meta da loja é a soma das metas definidas; sem nenhuma meta definida, não há meta.
 */
export function placarVisto(contagens: Record<string, ContagemDoVendedor>, metas: MetasApresentacao, vendedorIds: string[], escolhido?: string | null): PlacarVisto {
  const ids = escolhido ? [escolhido] : vendedorIds;
  const soma = (f: (c: ContagemDoVendedor) => number) => ids.reduce((s, id) => s + f(contagens[id] ?? { realizadas: 0, agendadas: 0 }), 0);
  const definidas = ids.map((id) => metas[id]).filter((m): m is number => !!m);
  return { realizadas: soma((c) => c.realizadas), agendadas: soma((c) => c.agendadas), meta: definidas.length ? definidas.reduce((s, m) => s + m, 0) : null };
}
