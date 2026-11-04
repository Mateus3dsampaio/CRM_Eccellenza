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
