// Layout da ficha do lead (grade de 12 colunas). O admin personaliza e salva como padrão de todos.
export const BLOCOS_FICHA = ["conversa", "resumo", "etapa", "visita", "apresentacao", "dados", "medidas", "notas", "historico"] as const;
export type BlocoFicha = (typeof BLOCOS_FICHA)[number];

export interface ItemLayout {
  i: BlocoFicha;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const COLUNAS_FICHA = 12;
export const ALTURA_LINHA_FICHA = 30;

export const NOMES_BLOCOS: Record<BlocoFicha, string> = {
  conversa: "Conversa",
  resumo: "Resumo para o consultor",
  etapa: "Etapa e responsável",
  visita: "Visita",
  apresentacao: "Apresentação na loja",
  dados: "Dados do lead",
  medidas: "Medidas",
  notas: "Notas internas",
  historico: "Histórico de alterações",
};

// Conversa à esquerda e ficha à direita, lado a lado: o campo de resposta fica à vista sem rolar a página
// (13 linhas de 30 px + espaços = ~534 px, cabem em uma tela de 1280x720). Abaixo da conversa vêm dados, notas e histórico.
export const LAYOUT_PADRAO_FICHA: ItemLayout[] = [
  { i: "conversa", x: 0, y: 0, w: 7, h: 13 },
  { i: "dados", x: 0, y: 13, w: 7, h: 12 },
  { i: "notas", x: 0, y: 25, w: 7, h: 6 },
  { i: "historico", x: 0, y: 31, w: 7, h: 6 },
  { i: "resumo", x: 7, y: 0, w: 5, h: 7 },
  { i: "etapa", x: 7, y: 7, w: 5, h: 6 },
  { i: "visita", x: 7, y: 13, w: 5, h: 5 },
  { i: "apresentacao", x: 7, y: 18, w: 5, h: 4 },
  { i: "medidas", x: 7, y: 22, w: 5, h: 8 },
];

/** Aceita um layout salvo só se tiver todos os blocos, sem repetir, e dentro da grade. */
export function layoutValido(entrada: unknown): entrada is ItemLayout[] {
  if (!Array.isArray(entrada) || entrada.length !== BLOCOS_FICHA.length) return false;
  const vistos = new Set<string>();
  for (const item of entrada) {
    if (!item || typeof item !== "object") return false;
    const { i, x, y, w, h } = item as Record<string, unknown>;
    if (typeof i !== "string" || !(BLOCOS_FICHA as readonly string[]).includes(i) || vistos.has(i)) return false;
    vistos.add(i);
    if (![x, y, w, h].every((n) => Number.isInteger(n))) return false;
    const [nx, ny, nw, nh] = [x, y, w, h] as number[];
    if (nx < 0 || ny < 0 || nw < 2 || nh < 2 || nx + nw > COLUNAS_FICHA || nh > 80 || ny > 400) return false;
  }
  return true;
}

/** Guarda só os campos que importam (a biblioteca da grade acrescenta outros). */
export function limparLayout(itens: ItemLayout[]): ItemLayout[] {
  return itens.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}
