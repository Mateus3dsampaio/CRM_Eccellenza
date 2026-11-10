// Acompanhamento de vendas: o que cada etapa exige, motivos de perda e dinheiro.
// Dinheiro é sempre guardado em centavos (inteiro) para não ter erro de arredondamento.
import type { CodigoEtapa } from "./etapas";
import { DIA, dataLocal, formatarHora, formatarVisitaCurta, inicioDoDiaLocal, partesLocais } from "./tempo";

/** Motivos de perda de fábrica: só a carga inicial. Depois o admin edita em Configurações > Vendas. */
export const MOTIVOS_PADRAO: { codigo: string; nome: string; pergunta: string | null }[] = [
  { codigo: "preco", nome: "Preço", pergunta: null },
  { codigo: "prazo", nome: "Prazo", pergunta: null },
  { codigo: "concorrente", nome: "Concorrente", pergunta: "Qual concorrente?" },
  { codigo: "desistiu", nome: "Desistiu", pergunta: null },
  { codigo: "parou_de_responder", nome: "Parou de responder", pergunta: null },
  { codigo: "outro", nome: "Outro", pergunta: null },
];

/** Motivo que a rotina usa quando o cliente some no atendimento do bot (substitui a antiga coluna "Sem resposta"). */
export const MOTIVO_PAROU_DE_RESPONDER = "parou_de_responder";

export interface MotivoDePerda {
  codigo: string;
  nome: string;
  pergunta: string | null;
  ativo: boolean;
}

/** Regras que o admin configura e que o servidor confere ao mover o card. */
export interface RegrasDeVendas {
  /** Negociação exige "Próximo contato em" (interruptor em Configurações > Vendas). */
  exigirContatoNegociacao: boolean;
  /** Motivos que podem ser escolhidos agora. */
  motivos: { codigo: string; pergunta: string | null }[];
}

export const REGRAS_PADRAO: RegrasDeVendas = { exigirContatoNegociacao: true, motivos: MOTIVOS_PADRAO };

export function nomeMotivo(codigo: string | null | undefined, motivos: { codigo: string; nome: string }[]): string {
  return motivos.find((m) => m.codigo === codigo)?.nome ?? "Sem motivo registrado";
}

/** Essa etapa exige o próximo contato (com as regras de agora)? */
export function exigeRetorno(etapa: CodigoEtapa, regras: Pick<RegrasDeVendas, "exigirContatoNegociacao"> = REGRAS_PADRAO): boolean {
  return etapa === "negociacao" && regras.exigirContatoNegociacao;
}

/**
 * Etapas em que o lead pode ter um lembrete/retorno ("Próximo contato em", com nota opcional): todas as abertas.
 * Só Negociação pode exigir; nas outras é o lembrete que o vendedor anota na ficha (tarefa 22). Fechado e Perdido apagam.
 */
export const ETAPAS_COM_RETORNO: CodigoEtapa[] = ["novo", "qualificacao", "medicao", "apresentacao", "negociacao"];

/** Tamanho máximo da nota do lembrete. */
export const NOTA_LEMBRETE_MAX = 200;

/** Valor máximo aceito: R$ 100 milhões (evita número absurdo por engano). */
export const VALOR_MAXIMO_CENTAVOS = 100_000_000 * 100;

/** 162100 → "R$ 1.621,00". */
export function formatarReais(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return "";
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = (abs % 100).toString().padStart(2, "0");
  return `${negativo ? "-" : ""}R$ ${reais},${cents}`;
}

/** 162100 → "R$ 1.621" (sem os centavos quando são zero). Para o card do kanban, onde o espaço é curto. */
export function formatarReaisCurto(centavos: number | null | undefined): string {
  return formatarReais(centavos).replace(/,00$/, "");
}

/** 5121000 → "R$ 51,2 mil"; 120000000 → "R$ 1,2 mi". Para a soma no cabeçalho da coluna. */
export function resumirReais(centavos: number): string {
  const reais = Math.round(centavos / 100);
  const curto = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (reais >= 1_000_000) return `R$ ${curto(reais / 1_000_000)} mi`;
  if (reais >= 1_000) return `R$ ${curto(reais / 1_000)} mil`;
  return `R$ ${reais.toLocaleString("pt-BR")}`;
}

/**
 * Texto digitado → centavos. Aceita "1621", "1.621,00", "R$ 1.621,50", "1621,5". Vazio ou inválido: null.
 * Com ponto e sem vírgula ("1.621") o ponto é separador de milhar, como no Brasil.
 */
export function lerReais(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const limpo = texto.replace(/R\$|\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, decimal = ""] = limpo.replace(/\./g, "").split(",");
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) && centavos <= VALOR_MAXIMO_CENTAVOS ? centavos : null;
}

export interface DadosDeVenda {
  proximoContatoEm?: Date | null;
  /** Nota do lembrete (ex.: "pediu para chamar depois do dia 15"). Some junto com a data. */
  lembreteNota?: string | null;
  valorOrcamento?: number | null;
  valorFechado?: number | null;
  motivoPerda?: string | null;
  concorrente?: string | null;
}

/**
 * Confere se o lead pode ir para a etapa, juntando o que veio agora com o que já está gravado.
 * Devolve a mensagem de erro (em português) ou null se está tudo certo.
 */
export function faltaParaMover(etapa: CodigoEtapa, final: DadosDeVenda, regras: RegrasDeVendas = REGRAS_PADRAO): string | null {
  if (exigeRetorno(etapa, regras) && !final.proximoContatoEm) return "Informe a data e a hora do próximo contato.";
  if (etapa === "fechado" && !final.valorFechado) return "Informe o valor fechado.";
  if (etapa === "perdido") {
    const motivo = regras.motivos.find((m) => m.codigo === final.motivoPerda);
    if (!motivo) return "Informe o motivo da perda.";
    if (motivo.pergunta && !final.concorrente?.trim()) return `Responda: ${motivo.pergunta}`;
  }
  return null;
}

/** Etapas que pedem dados ao receber o card (a tela abre a janela). Medição e Apresentação abrem a janela de agendar. */
export const ETAPAS_QUE_PEDEM_DADOS: CodigoEtapa[] = ["negociacao", "fechado", "perdido"];

/** "2026-11-10" + "14:30" (horário de Fortaleza) → instante. Inválido: null. */
export function lerDataHoraLocal(data: string, hora: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  const h = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!d || !h) return null;
  const [ano, mes, dia, hh, mm] = [d[1], d[2], d[3], h[1], h[2]].map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hh > 23 || mm > 59) return null;
  const resultado = dataLocal(ano, mes, dia, hh, mm);
  // 31/02 viraria 03/03: confere se o dia continuou o mesmo.
  return partesLocais(resultado).dia === dia ? resultado : null;
}

/** Instante → { data: "2026-11-10", hora: "14:30" } no horário de Fortaleza, para os campos da tela. */
export function partirDataHoraLocal(quando: Date | string | null | undefined): { data: string; hora: string } {
  if (!quando) return { data: "", hora: "" };
  const p = partesLocais(new Date(quando));
  const dois = (n: number) => String(n).padStart(2, "0");
  return { data: `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`, hora: `${dois(p.hora)}:${dois(p.minuto)}` };
}

export type SituacaoRetorno = "sem_data" | "futuro" | "hoje" | "atrasado";

/**
 * Onde o retorno marcado está em relação a hoje (dia de Fortaleza): "hoje" vale o dia todo, mesmo antes da hora;
 * "atrasado" é de um dia anterior que ninguém cumpriu; "sem_data" são os leads antigos sem retorno marcado.
 */
export function situacaoDoRetorno(proximoContatoEm: Date | string | null | undefined, agora: Date): SituacaoRetorno {
  if (!proximoContatoEm) return "sem_data";
  const inicioHoje = inicioDoDiaLocal(agora).getTime();
  const quando = new Date(proximoContatoEm).getTime();
  if (quando < inicioHoje) return "atrasado";
  return quando < inicioHoje + DIA ? "hoje" : "futuro";
}

/** "hoje 14:30", "atrasado desde 03/11", "10/11 14:30" ou "defina o próximo contato". */
export function textoDoRetorno(situacao: SituacaoRetorno, proximoContatoEm: string | null): string {
  if (situacao === "sem_data" || !proximoContatoEm) return "defina o próximo contato";
  const d = new Date(proximoContatoEm);
  const p = partesLocais(d);
  const dois = (n: number) => String(n).padStart(2, "0");
  if (situacao === "hoje") return `hoje ${formatarHora(d)}`;
  if (situacao === "atrasado") return `atrasado desde ${dois(p.dia)}/${dois(p.mes)}`;
  return formatarVisitaCurta(d);
}
