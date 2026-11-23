/**
 * Medidas da cena do login (tarefa 46). Tudo no "mundo" é desenhado 1,4× maior que no CRM: a câmera só reduz,
 * então o texto fica sempre nítido. As medidas do card copiam `componentes/kanban/card.tsx` × 1,4.
 */
export const ESCALA_MUNDO = 1.4;
export const COL_W = 372;
export const COL_GAP = 22;
export const COL_PAD = 17;
export const CARD_W = 338;
export const CARD_GAP = 14;
export const colX = (i: number) => i * (COL_W + COL_GAP);
export const cardX = (i: number) => colX(i) + COL_PAD;

/** Camadas no 3D: coluna no plano (z 0), sombra a 0,5, card a 1. Planos iguais empatam e o clique do card ia para a coluna. */
export const Z_CARD = 1;
export const Z_SOMBRA = 0.5;
export const Z_TOPO = 3;

/** Anel da janela de 24 h (raio 9 no viewBox 24, igual a `kanban/relogio-janela.tsx`). */
export const CIRC = 2 * Math.PI * 9;

/** Largura da coluna do cartão de login no PC; abaixo de `LARGURA_CELULAR` a tela fica em pé (cena em cima, cartão embaixo). */
export const LARGURA_CARTAO = 460;
export const LARGURA_CELULAR = 900;
export const ehCelular = () => window.innerWidth < LARGURA_CELULAR;
