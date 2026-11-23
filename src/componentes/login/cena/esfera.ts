/**
 * A esfera do assistente na cena do login: a mesma família da esfera do menu lateral (`componentes/menu-esfera.tsx`),
 * em canvas 2D. Mora na marca do topo, sai para ler a mensagem e senta no selo do card enquanto a IA atende.
 * Posição e tamanho em px da tela; quem anima é o roteiro (`esf.x`, `esf.y`, `esf.r`, `esf.brilho`...).
 */
export interface Esfera {
  x: number;
  y: number;
  r: number;
  ang: number;
  giro: number;
  impulso: number;
  brilho: number;
  vis: number;
  /** Elemento que a esfera acompanha a cada quadro (o selo do card), ou nulo quando voa livre. */
  preso: HTMLElement | null;
}

const TAM = 220;
const OURO = Math.PI * (3 - Math.sqrt(5));
const PONTOS = Array.from({ length: 150 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 150, r = Math.sqrt(1 - y * y), a = i * OURO;
  return { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
});

export function criarEsfera(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = TAM * dpr;
  canvas.height = TAM * dpr;
  canvas.style.width = canvas.style.height = TAM + "px";
  const esf: Esfera = { x: -200, y: -200, r: 10, ang: 0.9, giro: 0.45, impulso: 0, brilho: 0.25, vis: 1, preso: null };
  let cor = [138, 170, 240];
  const rgba = (a: number) => `rgba(${cor[0]},${cor[1]},${cor[2]},${a})`;

  /** A cor vem do tema do aparelho (`--color-marca-texto`). */
  function lerCor() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--color-marca-texto").trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(v);
    if (m) {
      const n = parseInt(m[1], 16);
      cor = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
  }

  function desenhar(dt: number) {
    esf.ang += dt * (esf.giro + esf.impulso);
    esf.impulso *= Math.exp(-dt * 2.5);
    if (esf.preso) {
      const r = esf.preso.getBoundingClientRect();
      esf.x = r.left + r.width / 2;
      esf.y = r.top + r.height / 2;
      esf.r = r.width * 0.5;
    }
    const T = TAM / 2, R = Math.min(esf.r, T * 0.4);
    canvas.style.transform = `translate3d(${(esf.x - T).toFixed(2)}px,${(esf.y - T).toFixed(2)}px,0)`;
    canvas.style.opacity = String(esf.vis);
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, TAM, TAM);
    if (esf.vis < 0.01) return;
    if (esf.brilho > 0.01) {
      const g = ctx.createRadialGradient(T, T, 0, T, T, R * 3);
      g.addColorStop(0, rgba(0.5 * esf.brilho));
      g.addColorStop(0.45, rgba(0.16 * esf.brilho));
      g.addColorStop(1, rgba(0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(T, T, R * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const cs = Math.cos(esf.ang), sn = Math.sin(esf.ang), ci = Math.cos(0.32), si = Math.sin(0.32);
    const tam = Math.max(0.35, Math.min(1.5, R / 17));
    const proj = PONTOS.map((p) => {
      const x = p.x * cs + p.z * sn, z0 = -p.x * sn + p.z * cs;
      return { x, y: p.y * ci - z0 * si, z: p.y * si + z0 * ci };
    }).sort((a, b) => a.z - b.z); // os de trás primeiro
    for (const p of proj) {
      const t = (p.z + 1) / 2;
      ctx.fillStyle = rgba(0.22 + 0.78 * t);
      ctx.beginPath();
      ctx.arc(T + p.x * R, T + p.y * R, (0.5 + 1.3 * t) * tam, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  lerCor();
  return { esf, desenhar, lerCor };
}
