/** Contas da cena do login: homografia (tela ↔ plano do quadro em perspectiva), curva de Bézier e mola física. */

export interface Ponto {
  x: number;
  y: number;
}

export interface Homografia {
  paraTela(x: number, y: number): Ponto;
  paraMundo(x: number, y: number): Ponto;
}

/**
 * Homografia a partir de 4 cantos: `tela` são os cantos do retângulo `mundo` vistos na tela, na ordem
 * (x0,y0), (x1,y0), (x1,y1), (x0,y1). Exata para qualquer perspectiva de um plano. Serve para o card ficar
 * embaixo do ponteiro ao arrastar e para enquadrar a câmera num ponto da tela.
 */
export function homografia(tela: readonly [Ponto, Ponto, Ponto, Ponto], mundo: { x0: number; y0: number; x1: number; y1: number }): Homografia {
  const [{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }] = tela;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / det;
    h = (dx1 * sy - sx * dy1) / det;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  // Inversa pela adjunta (o determinante some na divisão por w).
  const A = e - f * h, B = f * g - d, C = d * h - e * g;
  const D = c * h - b, E = a - c * g, F = b * g - a * h;
  const G = b * f - c * e, H = c * d - a * f, I = a * e - b * d;
  const W = mundo.x1 - mundo.x0, Hm = mundo.y1 - mundo.y0;
  return {
    paraTela(wx, wy) {
      const u = (wx - mundo.x0) / W, v = (wy - mundo.y0) / Hm, w = g * u + h * v + 1;
      return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
    },
    paraMundo(X, Y) {
      const u = A * X + D * Y + G, v = B * X + E * Y + H, w = C * X + F * Y + I;
      return { x: mundo.x0 + (u / w) * W, y: mundo.y0 + (v / w) * Hm };
    },
  };
}

/** Ponto da curva de Bézier quadrática (a → b, puxada por c) em p ∈ [0, 1]. */
export function bezier(a: Ponto, c: Ponto, b: Ponto, p: number): Ponto {
  const q = 1 - p;
  return { x: q * q * a.x + 2 * q * p * c.x + p * p * b.x, y: q * q * a.y + 2 * q * p * c.y + p * p * b.y };
}

/** Mola de verdade (oscilador amortecido) como curva de animação: zeta = amortecimento, omega = rigidez. Termina em 1. */
export function molaFisica(zeta: number, omega: number): (t: number) => number {
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return (t) => (t >= 1 ? 1 : 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t)));
}
