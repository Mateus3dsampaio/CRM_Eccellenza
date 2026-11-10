import { faixaDeEspera, minutosEsperando, textoDeEspera, type PrazosEspera } from "./espera";
import { situacaoDaJanela } from "./janela24h";
import { ETAPAS_COM_RETORNO, situacaoDoRetorno, textoDoRetorno } from "./vendas";
import { inicioDoDiaLocal, DIA } from "./tempo";
import type { TipoDecisao } from "./decisao";
import type { CodigoEtapa } from "./etapas";

/**
 * Faixa de ação do card do kanban (tarefa 39, aprovada pelo Mateus em 10/11/2026): o card mostra UMA pendência, a mais
 * grave, sempre no mesmo lugar. As outras aparecem ao abrir o lead. Só regra, sem banco e sem tela.
 *
 * Código de cores (uma cor, um significado):
 * - vermelho: cliente sem resposta além do prazo, ou a IA travou;
 * - ambar: pendência do vendedor (cliente perto do prazo, fila sem consultor, data vencida, falta marcar);
 * - azul: é para hoje;
 * - verde: combinado e em dia;
 * - cinza: nada a fazer agora.
 */
export type CorAcao = "vermelho" | "ambar" | "azul" | "verde" | "cinza";

export type CodigoAcao =
  | "responder_atrasado"
  | "ia_travou"
  | "responder_atencao"
  | "na_fila"
  | "decidir"
  | "marcar_data"
  | "retorno_atrasado"
  | "definir_retorno"
  | "responder"
  | "retorno_hoje"
  | "compromisso"
  | "retorno_futuro"
  | "ia_atendendo"
  | "aguardando_cliente";

export interface AcaoCard {
  codigo: CodigoAcao;
  cor: CorAcao;
  texto: string;
  /** O vendedor precisa agir (entra em "Precisa de você"); falso = a bola está com o cliente ou com a IA. */
  precisaDeVoce: boolean;
  /** Detalhe para a dica (passar o mouse). */
  dica?: string;
}

/** Ordem de gravidade: o primeiro que existir vira a faixa do card. */
export const ORDEM_ACAO: CodigoAcao[] = [
  "responder_atrasado",
  "ia_travou",
  "responder_atencao",
  "na_fila",
  "decidir",
  "marcar_data",
  "retorno_atrasado",
  "definir_retorno",
  "responder",
  "retorno_hoje",
  "compromisso",
  "retorno_futuro",
  "ia_atendendo",
  "aguardando_cliente",
];

/** Texto da faixa quando há data vencida (a janela de decisão continua a mesma, regras/decisao.ts). */
export const FAIXA_DECISAO: Record<TipoDecisao, string> = {
  medicao: "Decidir: a medição aconteceu?",
  apresentacao: "Decidir: o cliente veio?",
  negociacao: "Decidir: fechou?",
};

type Instante = Date | string | null | undefined;

export interface LeadParaAcao {
  etapa: string;
  modo: string;
  consultor: unknown | null;
  esperandoDesde: Instante;
  ultimaMsgClienteEm: Instante;
  erroBot: string | null;
  decisao: { tipo: TipoDecisao; venceuEm: Date | string } | null;
  semData: boolean;
  proximoContatoEm: Instante;
  lembreteNota: string | null;
  /** Próximo compromisso já escrito, ex.: "Medição qui 12/11 8h". */
  visita: string | null;
  /** Início do próximo compromisso (para saber se é hoje). */
  visitaEm?: Instante;
}

export interface ContextoDaAcao {
  agora: Date;
  prazos: PrazosEspera;
  /** O retorno é obrigatório nessa etapa? (Configurações > Vendas) */
  retornoObrigatorio: (etapa: string) => boolean;
}

const ETAPAS_ENCERRADAS = ["fechado", "perdido"];

function ehHoje(quando: Instante, agora: Date): boolean {
  if (!quando) return false;
  const ms = new Date(quando).getTime();
  const inicio = inicioDoDiaLocal(agora).getTime();
  return ms >= inicio && ms < inicio + DIA;
}

/** Todas as pendências do lead, da mais grave para a menos grave. Lista vazia só em Fechado e Perdido sem nada pendente. */
export function acoesDoCard(lead: LeadParaAcao, ctx: ContextoDaAcao): AcaoCard[] {
  const acoes: AcaoCard[] = [];
  const encerrada = ETAPAS_ENCERRADAS.includes(lead.etapa);

  if (lead.esperandoDesde) {
    const faixa = faixaDeEspera(lead.esperandoDesde, ctx.agora, ctx.prazos);
    // Janela de 24h fechada: texto livre não vai, só modelo de mensagem.
    const janelaFechada = !encerrada && situacaoDaJanela(lead.ultimaMsgClienteEm, ctx.agora).faixa === "fechada";
    const texto = `${janelaFechada ? "Responder com modelo" : "Responder"} · há ${textoDeEspera(minutosEsperando(lead.esperandoDesde, ctx.agora))}`;
    const dica = janelaFechada ? "Cliente esperando resposta. A janela de 24h fechou: só modelo de mensagem." : "Cliente esperando resposta.";
    if (faixa === "vermelho") acoes.push({ codigo: "responder_atrasado", cor: "vermelho", texto, precisaDeVoce: true, dica });
    else if (faixa === "amarelo") acoes.push({ codigo: "responder_atencao", cor: "ambar", texto, precisaDeVoce: true, dica });
    else acoes.push({ codigo: "responder", cor: "cinza", texto, precisaDeVoce: true, dica });
  }
  if (lead.erroBot) acoes.push({ codigo: "ia_travou", cor: "vermelho", texto: "IA sem resposta · assuma a conversa", precisaDeVoce: true, dica: lead.erroBot });
  if (!lead.consultor && lead.modo !== "bot" && !encerrada) {
    acoes.push({ codigo: "na_fila", cor: "ambar", texto: "Na fila · sem consultor", precisaDeVoce: true, dica: "O bot repassou e nenhum consultor estava disponível." });
  }
  if (lead.decisao) acoes.push({ codigo: "decidir", cor: "ambar", texto: FAIXA_DECISAO[lead.decisao.tipo], precisaDeVoce: true });
  if (lead.semData) acoes.push({ codigo: "marcar_data", cor: "ambar", texto: "Marcar data na agenda", precisaDeVoce: true, dica: "Este card está numa coluna de compromisso, mas não há data marcada na agenda." });

  if ((ETAPAS_COM_RETORNO as string[]).includes(lead.etapa)) {
    const situacao = situacaoDoRetorno(lead.proximoContatoEm, ctx.agora);
    const dica = lead.lembreteNota ?? undefined;
    const quando = lead.proximoContatoEm ? new Date(lead.proximoContatoEm).toISOString() : null;
    // Retorno vencido na Negociação já é a decisão "fechou?": não repete.
    if (situacao === "atrasado" && !lead.decisao) acoes.push({ codigo: "retorno_atrasado", cor: "ambar", texto: `Retorno ${textoDoRetorno(situacao, quando)}`, precisaDeVoce: true, dica });
    if (situacao === "sem_data" && ctx.retornoObrigatorio(lead.etapa)) acoes.push({ codigo: "definir_retorno", cor: "ambar", texto: "Definir o próximo contato", precisaDeVoce: true });
    if (situacao === "hoje") acoes.push({ codigo: "retorno_hoje", cor: "azul", texto: `Retorno ${textoDoRetorno(situacao, quando)}`, precisaDeVoce: true, dica });
    if (situacao === "futuro") acoes.push({ codigo: "retorno_futuro", cor: "cinza", texto: `Retorno ${textoDoRetorno(situacao, quando)}`, precisaDeVoce: false, dica });
  }
  // Compromisso vencido já virou "decidir": não aparece como combinado.
  if (lead.visita && !lead.decisao && !encerrada) {
    acoes.push({ codigo: "compromisso", cor: ehHoje(lead.visitaEm, ctx.agora) ? "azul" : "verde", texto: lead.visita, precisaDeVoce: false });
  }
  if (!acoes.length && !encerrada) {
    acoes.push(lead.modo === "bot" ? { codigo: "ia_atendendo", cor: "cinza", texto: "IA atendendo", precisaDeVoce: false } : { codigo: "aguardando_cliente", cor: "cinza", texto: "Aguardando o cliente", precisaDeVoce: false });
  }
  return acoes.sort((a, b) => ORDEM_ACAO.indexOf(a.codigo) - ORDEM_ACAO.indexOf(b.codigo));
}

/** Quantas outras pendências do vendedor existem além da que está na faixa (o "+1" do card). */
export function outrasPendencias(acoes: AcaoCard[]): number {
  return acoes.slice(1).filter((a) => a.precisaDeVoce).length;
}

/**
 * Ordem da coluna: primeiro o que precisa do vendedor (do mais grave ao menos grave), depois o que aguarda o cliente.
 * Dentro de cada gravidade vale a ordem em que os cards chegaram (quem espera há mais tempo primeiro, regras/espera.ts).
 */
export function separarColuna<T>(cards: T[], acoesDe: (card: T) => AcaoCard[]): { precisaDeVoce: T[]; aguardando: T[] } {
  const comAcao = cards.map((card, i) => ({ card, i, acao: acoesDe(card)[0] as AcaoCard | undefined }));
  const precisa = comAcao.filter((c) => c.acao?.precisaDeVoce).sort((a, b) => ORDEM_ACAO.indexOf(a.acao!.codigo) - ORDEM_ACAO.indexOf(b.acao!.codigo) || a.i - b.i);
  return { precisaDeVoce: precisa.map((c) => c.card), aguardando: comAcao.filter((c) => !c.acao?.precisaDeVoce).map((c) => c.card) };
}

/** Etapas em que o cabeçalho da coluna soma os orçamentos em aberto. */
export const ETAPAS_COM_SOMA: CodigoEtapa[] = ["apresentacao", "negociacao"];
