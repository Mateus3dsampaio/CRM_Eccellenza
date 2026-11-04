// Layout da ficha do lead (grade de 12 colunas). O admin personaliza e salva como padrão de todos.
// Tarefa 28: "compromissos" reúne visita à loja, medição e apresentação; notas e histórico viraram abas do painel da conversa.
export const BLOCOS_FICHA = ["conversa", "resumo", "etapa", "compromissos", "dados", "medidas"] as const;
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
  conversa: "Conversa, notas e histórico",
  resumo: "Resumo para o consultor",
  etapa: "Etapa e responsável",
  compromissos: "Compromissos",
  dados: "Dados do lead",
  medidas: "Medidas",
};

// Conversa à esquerda e ficha à direita, lado a lado: o campo de resposta fica à vista sem rolar a página
// (13 linhas de 30 px + espaços = ~534 px, cabem em uma tela de 1280x720). Abaixo da conversa vêm dados, notas e histórico.
export const LAYOUT_PADRAO_FICHA: ItemLayout[] = [
  { i: "conversa", x: 0, y: 0, w: 7, h: 16 },
  { i: "dados", x: 0, y: 16, w: 7, h: 10 },
  { i: "resumo", x: 7, y: 0, w: 5, h: 7 },
  { i: "etapa", x: 7, y: 7, w: 5, h: 9 }, // com o lembrete (tarefa 22)
  { i: "compromissos", x: 7, y: 16, w: 5, h: 7 }, // visita à loja, medição e apresentação (tarefa 28)
  { i: "medidas", x: 7, y: 23, w: 5, h: 3 },
];

/**
 * Layout salvo antes de os blocos mudarem (tarefa 28): tira os blocos que não existem mais e acrescenta os novos
 * (no lugar do padrão). Devolve `ajustado: true` quando mexeu em algo, para a tela avisar uma vez.
 */
export function ajustarLayoutSalvo(entrada: unknown): { layout: ItemLayout[]; ajustado: boolean } | null {
  if (!Array.isArray(entrada)) return null;
  const conhecidos = entrada.filter((item): item is ItemLayout => !!item && typeof item === "object" && (BLOCOS_FICHA as readonly string[]).includes((item as ItemLayout).i));
  const vistos = new Set<string>();
  const semRepetir = conhecidos.filter((item) => (vistos.has(item.i) ? false : (vistos.add(item.i), true)));
  const faltando = LAYOUT_PADRAO_FICHA.filter((padrao) => !vistos.has(padrao.i));
  const layout = [...semRepetir, ...faltando];
  if (!layoutValido(layout)) return null;
  return { layout, ajustado: layout.length !== entrada.length || faltando.length > 0 };
}

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
