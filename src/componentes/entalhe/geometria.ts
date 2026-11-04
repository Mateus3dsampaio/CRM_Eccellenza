/**
 * Contas do "entalhe flutuante" (modelo aprovado em docs/referencia/modelos_interacao.html, barra 3).
 * Sem React e sem DOM: só números e caminhos SVG. Duas orientações: abas na horizontal (entalhe na borda de cima)
 * e menu na vertical (entalhe na borda da direita). O entalhe sempre "morde" a barra a partir da borda.
 */

export type Orientacao = "horizontal" | "vertical";

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Rampa suave (0 até `a`, 1 a partir de `b`). */
export function suave(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Quanto a pílula já andou do ponto de saída (`de`) ao de chegada (`para`): 0 a 1. Parada = 1. */
export function progresso(atual: number, de: number, para: number): number {
  return de === para ? 1 : clamp((atual - de) / (para - de), 0, 1);
}

/** Altura do salto: 0 parada, máxima no meio do caminho. */
export function alturaDoSalto(prog: number, salto: number): number {
  return salto * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(prog, 0, 1))), 0.6);
}

/** Quanto o entalhe está aberto (1 parado, 0 quando a pílula está no ar). */
export function aberturaDoEntalhe(salto: number, alturaMaxima: number): number {
  return 1 - suave(0, 0.45 * alturaMaxima, salto);
}

/**
 * Profundidade do entalhe a `d` px do centro: caixa de cantos arredondados.
 * Em `|d| === meia` ainda vale `profundidade - raio` (a parede reta até a borda); além disso, 0.
 */
export function profundidadeDoEntalhe(d: number, meia: number, profundidade: number, raio: number): number {
  const a = Math.abs(d);
  if (profundidade <= 0 || a > meia) return 0;
  const r = Math.min(raio, profundidade, meia);
  const reta = meia - r;
  if (a <= reta) return profundidade;
  const t = a - reta;
  return profundidade - r + Math.sqrt(Math.max(0, r * r - t * t));
}

/** Ponto do desenho: `m` anda ao longo da barra, `u` entra na barra a partir da borda (negativo = fora). */
export function ponto(o: Orientacao, borda: number, m: number, u: number): [number, number] {
  return o === "horizontal" ? [m, borda + u] : [borda - u, m];
}

const texto = ([x, y]: [number, number]) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** Desenha o entalhe: `preencher` cobre a borda da barra (cor do fundo) e `linha` é o contorno novo. Vazios se estiver fechado. */
export function caminhoDoEntalhe(o: Orientacao, borda: number, centro: number, meia: number, profundidade: number, raio: number): { preencher: string; linha: string } {
  if (profundidade < 0.5 || meia <= 0) return { preencher: "", linha: "" };
  const r = Math.min(raio, profundidade, meia);
  const reta = meia - r;
  const pontos: [number, number][] = [];
  for (let a = -meia; a < meia; ) {
    pontos.push(ponto(o, borda, centro + a, profundidadeDoEntalhe(a, meia, profundidade, raio)));
    a += Math.abs(a) > reta - 1 ? 1 : 8;
  }
  pontos.push(ponto(o, borda, centro + meia, profundidadeDoEntalhe(meia, meia, profundidade, raio)));
  const linha = `M${texto(ponto(o, borda, centro - meia, 0))}` + pontos.map((p) => `L${texto(p)}`).join("") + `L${texto(ponto(o, borda, centro + meia, 0))}`;
  // Passa 0,5 px para fora da barra para esconder a linha de borda que passava por aqui.
  const preencher = `M${texto(ponto(o, borda, centro - meia, -0.5))}` + linha.slice(linha.indexOf("L")) + `L${texto(ponto(o, borda, centro + meia, -0.5))}Z`;
  return { preencher, linha };
}

/** Mola: acelera até o alvo e passa um pouco antes de assentar (semi-implícita, estável para quadros de até 1/30 s). */
export function molaPasso(e: { x: number; v: number }, alvo: number, dt: number, rigidez: number, amortecimento: number): void {
  e.v += (rigidez * (alvo - e.x) - amortecimento * e.v) * dt;
  e.x += e.v * dt;
}

/* ---------- Bojo líquido (modelo da referência, barra 2): a barra é colorida e ganha uma cúpula sobre a aba ativa ---------- */

const RD = 20; // raio da cúpula
const DESCE = 4; // o centro da cúpula fica 4 px abaixo da linha de cima da barra
const RC = 9; // arco de concordância entre a cúpula e a barra
/** Quanto a cúpula sobe acima da barra (px). */
export const ALTURA_BOJO = RD - DESCE;
/** Distância do centro até onde o bojo encosta de novo na barra. */
export const MEIA_BASE_BOJO = Math.sqrt((RD + RC) * (RD + RC) - (RC + DESCE) * (RC + DESCE));
const DT = (MEIA_BASE_BOJO * RD) / (RD + RC);

/** Altura da cúpula (px, para cima) a `d` px do centro. Zero além da base. */
export function formaDoBojo(d: number): number {
  const a = Math.abs(d);
  if (a >= MEIA_BASE_BOJO) return 0;
  if (a >= DT) return RC - Math.sqrt(Math.max(0, RC * RC - (a - MEIA_BASE_BOJO) * (a - MEIA_BASE_BOJO)));
  return -DESCE + Math.sqrt(Math.max(0, RD * RD - a * a));
}

/** Estica o bojo conforme a velocidade: mais comprido e mais baixo, com o lado de trás se arrastando. `plato` = meia-largura reta do topo (abas de texto são largas). */
export function esticarBojo(v: number): { sy: number; sxl: number; sxr: number } {
  const s = Math.min(1, Math.abs(v) / 900);
  const sx = 1 + 0.9 * s;
  const dir = Math.sign(v);
  return { sy: 1 - 0.5 * s, sxl: sx * (dir > 0 ? 1 + 0.9 * s : 1), sxr: sx * (dir < 0 ? 1 + 0.9 * s : 1) };
}

/** Altura do bojo no ponto `x` (a forma toda estica junto, então continua encostando na barra sem quina). */
export function alturaDoBojoEm(x: number, centro: number, plato: number, e: { sy: number; sxl: number; sxr: number }): number {
  const d = x - centro;
  const a = Math.max(0, Math.abs(d) - plato);
  return e.sy * formaDoBojo(a / (d < 0 ? e.sxl : e.sxr));
}

/** Contorno da barra inteira (cantos de raio `r`) com o bojo subindo a borda de cima; `fino` = faixa onde amostrar mais (a curva). */
export function contornoDaBarra(largura: number, topo: number, base: number, r: number, perfil: (x: number) => number, fino?: [number, number]): string {
  const canto = (x: number) => (x < r ? r - Math.sqrt(r * r - (r - x) * (r - x)) : x > largura - r ? r - Math.sqrt(r * r - (x - (largura - r)) * (x - (largura - r))) : 0);
  let d = `M0,${base - r}`;
  for (let x = 0; x < largura; x += fino && x >= fino[0] && x <= fino[1] ? 0.5 : 3) d += `L${x.toFixed(1)},${(topo + canto(x) - perfil(x)).toFixed(2)}`;
  d += `L${largura},${(topo + r - perfil(largura)).toFixed(2)}L${largura},${base - r}`;
  return `${d}A${r},${r} 0 0 1 ${largura - r},${base}L${r},${base}A${r},${r} 0 0 1 0,${base - r}Z`;
}
