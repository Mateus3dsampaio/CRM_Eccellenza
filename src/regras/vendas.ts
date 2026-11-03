// Acompanhamento de vendas: o que cada etapa exige, motivos de perda e dinheiro.
// Dinheiro é sempre guardado em centavos (inteiro) para não ter erro de arredondamento.
import type { CodigoEtapa } from "./etapas";

export const MOTIVOS_PERDA = [
  { codigo: "preco", nome: "Preço" },
  { codigo: "prazo", nome: "Prazo" },
  { codigo: "concorrente", nome: "Concorrente" },
  { codigo: "desistiu", nome: "Desistiu" },
  { codigo: "outro", nome: "Outro" },
] as const;

export type MotivoPerda = (typeof MOTIVOS_PERDA)[number]["codigo"];
export const CODIGOS_MOTIVO = MOTIVOS_PERDA.map((m) => m.codigo) as MotivoPerda[];

export function nomeMotivo(codigo: string | null | undefined): string {
  return MOTIVOS_PERDA.find((m) => m.codigo === codigo)?.nome ?? (codigo || "Sem motivo");
}

/** Etapas em que o lead tem um retorno marcado ("Próximo contato em"). */
export const ETAPAS_COM_RETORNO: CodigoEtapa[] = ["orcamento", "negociacao"];

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
  valorOrcamento?: number | null;
  valorFechado?: number | null;
  motivoPerda?: string | null;
  concorrente?: string | null;
}

/**
 * Confere se o lead pode ir para a etapa, juntando o que veio agora com o que já está gravado.
 * Devolve a mensagem de erro (em português) ou null se está tudo certo.
 */
export function faltaParaMover(etapa: CodigoEtapa, final: DadosDeVenda): string | null {
  if (ETAPAS_COM_RETORNO.includes(etapa) && !final.proximoContatoEm) return "Informe a data e a hora do próximo contato.";
  if (etapa === "fechado" && !final.valorFechado) return "Informe o valor fechado.";
  if (etapa === "perdido") {
    if (!final.motivoPerda || !CODIGOS_MOTIVO.includes(final.motivoPerda as MotivoPerda)) return "Informe o motivo da perda.";
    if (final.motivoPerda === "concorrente" && !final.concorrente?.trim()) return "Informe qual foi o concorrente.";
  }
  return null;
}
