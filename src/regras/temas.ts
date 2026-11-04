/**
 * Temas de cor (Configurações > Temas). As cores de cada tema ficam em `src/app/tokens.css` (`:root[data-tema=...]`);
 * aqui ficam o código, o nome e as 6 cores da bolinha de escolha (escura → clara → destaque).
 * "padrao" é o azul-ardósia de sempre (sem `data-tema`). A escolha vale só no aparelho (localStorage).
 */
export const CHAVE_TEMA = "tema";

export interface Tema {
  codigo: string;
  nome: string;
  /** Da mais escura à mais clara, e por último a cor de destaque. */
  cores: [string, string, string, string, string, string];
}

export const TEMAS: readonly Tema[] = [
  { codigo: "padrao", nome: "Padrão (azul-ardósia)", cores: ["#0e131a", "#1a2430", "#273545", "#8aaaf0", "#e6edf4", "#3f74ec"] },
  { codigo: "ametista", nome: "Ametista", cores: ["#0e0b1d", "#2a1e4d", "#5a3b8c", "#8b7cc7", "#c9c2e3", "#3a3a52"] },
  { codigo: "cafe", nome: "Café", cores: ["#1a120e", "#3a2418", "#6b4a2e", "#a88462", "#d5c4ae", "#4a4a46"] },
  { codigo: "floresta", nome: "Floresta", cores: ["#0f1f17", "#1e3a2e", "#3e5a3f", "#6b7f67", "#c7cbb8", "#3d4337"] },
  { codigo: "marinho", nome: "Marinho e laranja", cores: ["#0b132b", "#1c2541", "#3a506b", "#5bc0de", "#f4d6b0", "#d97706"] },
  { codigo: "petroleo", nome: "Petróleo e cobre", cores: ["#0a0f14", "#0f3d3e", "#2e6f73", "#7fb3b8", "#eadcc8", "#c6601f"] },
  { codigo: "rosa", nome: "Ardósia e rosa", cores: ["#121212", "#1f2937", "#334155", "#64748b", "#f1f5f9", "#ec4899"] },
];

/** Código guardado → tema válido (qualquer coisa estranha vira o padrão). */
export function temaValido(codigo: string | null | undefined): string {
  return TEMAS.some((t) => t.codigo === codigo) ? (codigo as string) : "padrao";
}
