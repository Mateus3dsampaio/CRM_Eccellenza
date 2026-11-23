import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ETAPAS } from "@/regras/etapas";
import { criarEsfera } from "./esfera";
import { homografia, type Ponto } from "./geometria";
import { CARD_GAP, CARD_W, LARGURA_CARTAO, Z_CARD, Z_SOMBRA, cardX, colX, ehCelular } from "./medidas";
import { criarColuna, pintarFaixa, posNoMundo, type BalaoCena, type CardCena, type ColunaCena } from "./montar";
import type { Faixa } from "./dados";

/**
 * Núcleo da cena do login (tarefa 46): câmera 3D, mapa tela ↔ quadro, esfera, cursor do consultor e os efeitos do
 * quadro. O roteiro dos atos fica em `roteiro.ts`; o início, arrastar e entrar em `cena.ts`.
 * Tempo: tudo passa pelo GSAP (`espera`, `tw`), então cancelar o roteiro é só trocar a `geracao`.
 */

gsap.registerPlugin(CustomEase);
// As curvas do CRM (`--ease-mola`, `--ease-salto` em tokens.css), exatas: o login fala a mesma língua de movimento.
CustomEase.create("mola", "0.22,1,0.36,1");
CustomEase.create("salto", "0.34,1.56,0.64,1");
CustomEase.create("cinema", "0.66,0,0.2,1");

export interface Elementos {
  /** Raiz da cena (fixa, atrás do cartão). */
  raiz: HTMLElement;
  palco: HTMLElement;
  mundo: HTMLElement;
  nevoa: HTMLElement;
  esfera: HTMLCanvasElement;
  cursor: HTMLElement;
  /** Lugar da esfera na marca do topo (onde ela mora). */
  lugarEsfera: HTMLElement;
}

export const CANCELADO = Symbol("cancelado");
export interface Camera {
  fx: number;
  fy: number;
  s: number;
  rx: number;
  rz: number;
  /** 0 desliga paralaxe e respiração (movimento reduzido, mergulho). */
  par: number;
}
type Alvo = () => Ponto & { r?: number };

export function criarPalco(el: Elementos) {
  const est = {
    geracao: 0,
    heroi: null as CardCena | null,
    balao: null as BalaoCena | null,
    nCliente: 0,
    quadroVisivel: false,
    mergulhando: false,
    seguir: null as { card: CardCena; dx: number; dy: number } | null,
    celular: ehCelular(),
    cabH: 124,
    tempo: 0,
    /** Velocidade (1 normal; 0 parado). */
    vel: 1,
  };
  const cols: ColunaCena[] = [];

  // ---------- Tempo ----------
  const vivo = (g: number) => g === est.geracao;
  const espera = (s: number, g: number) => new Promise<void>((res, rej) => gsap.delayedCall(s, () => (vivo(g) ? res() : rej(CANCELADO))));
  function tw(alvo: gsap.TweenTarget, vars: gsap.TweenVars, g: number) {
    return new Promise<void>((res, rej) => {
      const fim = vars.onComplete;
      gsap.to(alvo, {
        ...vars,
        onComplete() {
          if (fim) fim();
          if (vivo(g)) res();
          else rej(CANCELADO);
        },
        onInterrupt() {
          if (vivo(g)) res();
          else rej(CANCELADO);
        },
      });
    });
  }

  // ---------- Câmera: foco (ponto do mundo no centro do palco), escala e inclinação ----------
  const cam: Camera = { fx: 0, fy: 0, s: 1, rx: 0, rz: 0, par: 1 };
  const par = { x: 0, y: 0, ax: 0, ay: 0, congelado: false };
  let CX = 0, CY = 0;
  function medir() {
    est.celular = ehCelular();
    if (est.celular) { CX = innerWidth / 2; CY = innerHeight * 0.28; }
    else { CX = (innerWidth - LARGURA_CARTAO) / 2 + 8; CY = innerHeight / 2 + 4; }
    el.palco.style.perspectiveOrigin = `${CX}px ${CY}px`;
    el.raiz.style.setProperty("--cx", CX + "px");
    el.raiz.style.setProperty("--cy", CY + "px");
  }
  const area = () => (est.celular ? { w: innerWidth - 24, h: innerHeight * 0.52 - 96 } : { w: innerWidth - LARGURA_CARTAO - 80, h: innerHeight - 200 });
  function aplicarCamera() {
    const rx = cam.rx - par.y * 2.2 * cam.par, ry = par.x * 3.2 * cam.par;
    const s = cam.s * (1 + 0.005 * Math.sin(est.tempo * 0.55) * cam.par);
    el.mundo.style.transform = `translate3d(${CX}px,${CY}px,0) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${cam.rz}deg) scale(${s}) translate3d(${-cam.fx}px,${-cam.fy}px,0)`;
  }
  const aoMover = (e: PointerEvent) => {
    par.ax = (e.clientX / innerWidth - 0.5) * 2;
    par.ay = (e.clientY / innerHeight - 0.5) * 2;
  };
  addEventListener("pointermove", aoMover);

  // Tela ↔ mundo: 4 marcos no plano do quadro dão a homografia exata (perspectiva incluída).
  const RET = { x0: -600, y0: -200, x1: 3000, y1: 1500 };
  const marcos = [[RET.x0, RET.y0], [RET.x1, RET.y0], [RET.x1, RET.y1], [RET.x0, RET.y1]].map(([x, y]) => {
    const m = document.createElement("span");
    m.className = "marco";
    el.mundo.appendChild(m);
    gsap.set(m, { x: x - 1, y: y - 1 });
    return m;
  });
  function mapa() {
    const p = marcos.map((m) => {
      const r = m.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }) as [Ponto, Ponto, Ponto, Ponto];
    return homografia(p, RET);
  }
  /** A câmera `alvo` com o foco ajustado para o ponto `mundoP` aparecer em `telaP`. */
  function enquadrar(alvo: Omit<Camera, "par">, mundoP: Ponto, telaP: Ponto): Omit<Camera, "par"> {
    const salvo = { ...cam }, sx = par.x, sy = par.y;
    Object.assign(cam, alvo);
    par.x = par.y = 0;
    aplicarCamera();
    const w = mapa().paraMundo(telaP.x, telaP.y);
    Object.assign(cam, salvo);
    par.x = sx;
    par.y = sy;
    aplicarCamera();
    return { ...alvo, fx: alvo.fx + (mundoP.x - w.x), fy: alvo.fy + (mundoP.y - w.y) };
  }
  const centroDoCard = (c: CardCena) => ({ x: Number(gsap.getProperty(c.el, "x")) + CARD_W / 2, y: Number(gsap.getProperty(c.el, "y")) + c.h / 2 });
  /** Close no balão e no card que está nascendo. */
  function camPerto(b: BalaoCena, h: CardCena): Omit<Camera, "par"> {
    const bw = b.el.offsetWidth, bh = b.el.offsetHeight;
    const hx = Number(gsap.getProperty(h.el, "x")), hy = Number(gsap.getProperty(h.el, "y"));
    const x0 = Math.min(b.x, hx) - 12, x1 = Math.max(b.x + bw, hx + CARD_W) + 12;
    const y0 = Math.min(b.y, hy) - 34, y1 = Math.max(b.y + bh, hy + h.h) + 12; // 34: rótulo da caixa de encaixe acima do nome
    const a = area();
    return { fx: (x0 + x1) / 2, fy: (y0 + y1) / 2, s: Math.min(1, a.w / (x1 - x0), a.h / (y1 - y0)), rx: 0, rz: 0 };
  }
  /** O quadro inclinado, com o card no ponto certo da tela (PC: à esquerda do cartão; celular: no meio do palco). */
  function camLonge(c: CardCena): Omit<Camera, "par"> {
    const a = area(), ctr = centroDoCard(c);
    if (est.celular) {
      const s = Math.min(0.62, 0.62 * (a.w / 366));
      return enquadrar({ fx: ctr.x, fy: ctr.y, s, rx: 40, rz: -9 }, ctr, { x: innerWidth * 0.5, y: innerHeight * 0.3 });
    }
    const s = Math.min(0.7, 0.7 * Math.min(a.w / 900, a.h / 700));
    return enquadrar({ fx: ctr.x, fy: ctr.y, s, rx: 42, rz: -12 }, ctr, { x: (innerWidth - LARGURA_CARTAO) * 0.36, y: innerHeight * 0.46 });
  }

  // ---------- Esfera e cursor do consultor ----------
  const esfera = criarEsfera(el.esfera);
  const esf = esfera.esf;
  const lugarDaEsfera: Alvo = () => {
    const r = el.lugarEsfera.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: 10 };
  };
  const cur = { x: innerWidth + 40, y: innerHeight * 0.4, vis: 0, s: 1, preso: null as { el: HTMLElement; fx: number; fy: number } | null };
  const onda = el.cursor.querySelector(".onda");
  function desenharCursor() {
    if (cur.preso) {
      const r = cur.preso.el.getBoundingClientRect();
      cur.x = r.left + r.width * cur.preso.fx;
      cur.y = r.top + r.height * cur.preso.fy;
    }
    el.cursor.style.transform = `translate3d(${cur.x.toFixed(2)}px,${cur.y.toFixed(2)}px,0) scale(${cur.s})`;
    el.cursor.style.opacity = String(cur.vis);
  }
  const pontoDe = (e: Element, fx = 0.5, fy = 0.5): Ponto => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width * fx, y: r.top + r.height * fy };
  };
  /** Voo em arco até um alvo que pode estar andando (lido a cada quadro). */
  function voarAte(obj: { x: number; y: number; r?: number }, alvo: Alvo, { dur, arco = -80, ease = "power2.inOut" }: { dur: number; arco?: number; ease?: string }, g: number) {
    const x0 = obj.x, y0 = obj.y, r0 = obj.r, o = { p: 0 };
    return tw(o, {
      p: 1, duration: dur, ease,
      onUpdate() {
        const t = alvo(), p = o.p, q = 1 - p, mx = (x0 + t.x) / 2, my = (y0 + t.y) / 2 + arco;
        obj.x = q * q * x0 + 2 * q * p * mx + p * p * t.x;
        obj.y = q * q * y0 + 2 * q * p * my + p * p * t.y;
        if (r0 != null && t.r != null) obj.r = r0 + (t.r - r0) * p;
      },
    }, g);
  }
  async function clicar(g: number) {
    await tw(cur, { s: 0.84, duration: 0.09, ease: "power2.out" }, g);
    if (onda) gsap.fromTo(onda, { scale: 0.4, opacity: 1 }, { scale: 2.2, opacity: 0, duration: 0.55, ease: "mola" });
    await tw(cur, { s: 1, duration: 0.3, ease: "salto" }, g);
  }

  // ---------- Quadro: colunas, posições e efeitos ----------
  for (let i = 0; i < ETAPAS.length; i++) cols.push(criarColuna(el.mundo, i, colX(i)));
  const yDoSlot = (col: ColunaCena, idx: number) => {
    let y = est.cabH;
    for (let k = 0; k < idx; k++) y += col.cards[k].h + CARD_GAP;
    return y;
  };
  function arrumarColuna(col: ColunaCena, { dur = 0.55, ignorar = null as CardCena | null, buraco = null as { indice: number; h: number } | null, instante = false } = {}) {
    let y = est.cabH;
    col.cards.forEach((c, k) => {
      if (buraco && k === buraco.indice) y += buraco.h + CARD_GAP;
      if (c !== ignorar) {
        if (instante) gsap.set(c.el, { x: cardX(col.i), y });
        else gsap.to(c.el, { x: cardX(col.i), y, duration: dur, ease: "mola", overwrite: "auto" });
      }
      y += c.h + CARD_GAP;
    });
  }
  function tirarDaColuna(c: CardCena) {
    const col = cols[c.col], i = col.cards.indexOf(c);
    if (i >= 0) col.cards.splice(i, 1);
    return i;
  }
  function porNaColuna(c: CardCena, i: number, idx = 0) {
    c.col = i;
    cols[i].cards.splice(idx, 0, c);
  }
  function contar(col: ColunaCena, n: number, animar = true) {
    if (n === col.n && animar) return;
    col.n = n;
    col.pal.textContent = n === 1 ? "conversa" : "conversas";
    const velho = col.num.firstElementChild, novo = document.createElement("span");
    novo.textContent = n.toLocaleString("pt-BR");
    col.num.appendChild(novo);
    if (!animar || cam.par === 0) {
      velho?.remove();
      return;
    }
    const sobe = !velho || n > Number(velho.textContent);
    gsap.fromTo(novo, { yPercent: sobe ? 100 : -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.42, ease: "mola" });
    if (velho) gsap.to(velho, { yPercent: sobe ? -100 : 100, opacity: 0, duration: 0.34, ease: "mola", onComplete: () => velho.remove() });
  }
  /** Confere todas as colunas (o card da história que ainda não pousou não conta). */
  const recontar = () => cols.forEach((col) => contar(col, col.cards.filter((k) => !k.heroi || k.noQuadro).length));
  const acenderColuna = (col: ColunaCena) => gsap.fromTo(col.luz, { opacity: 1 }, { opacity: 0, duration: 1.2, ease: "power2.out" });
  function brilharCard(c: CardCena, cor: string) {
    c.q.brilho.style.setProperty("--cor-brilho", cor);
    gsap.fromTo(c.q.brilho, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power1.out", yoyo: true, repeat: 1, repeatDelay: 0.3 });
  }
  function trocarFaixa(c: CardCena, f: Faixa | null) {
    gsap.timeline()
      .to(c.q.fc, { opacity: 0, x: -6, duration: 0.16, ease: "power1.in" })
      .add(() => pintarFaixa(c, f))
      .fromTo(c.q.fc, { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: 0.38, ease: "mola" });
  }
  /**
   * Caixa de encaixe: fecha em volta do campo em que o dado caiu e mostra o nome do campo. Itens do mesmo grupo
   * (vários ambientes) esticam a caixa que já está aberta: "AMBIENTE" vira "AMBIENTES".
   */
  const caixas: Record<string, { e: HTMLElement; x0: number; saida: gsap.core.Timeline }> = {};
  function encaixe(alvoEl: HTMLElement, rotulo: string, grupo: string | null) {
    const p = posNoMundo(el.mundo, alvoEl);
    const sumir = (cx: { e: HTMLElement }) => gsap.timeline({ onComplete: () => { cx.e.remove(); if (grupo && caixas[grupo] === cx) delete caixas[grupo]; } });
    const aberta = grupo ? caixas[grupo] : undefined;
    if (aberta) {
      aberta.saida.kill();
      const b = aberta.e.querySelector("b");
      if (b) b.textContent = rotulo + "S";
      gsap.to(aberta.e, { width: p.x + p.w + 7 - aberta.x0, opacity: 1, duration: 0.3, ease: "mola" });
      aberta.saida = sumir(aberta).to(aberta.e, { opacity: 0, duration: 0.35, ease: "power1.in" }, 0.7);
      return;
    }
    const e = document.createElement("span");
    e.className = "encaixe";
    e.innerHTML = `<b>${rotulo}</b>`;
    el.mundo.appendChild(e);
    const cx = { e, x0: p.x - 7, saida: gsap.timeline() };
    gsap.set(e, { x: cx.x0, y: p.y - 4, z: Z_CARD + 0.5, width: p.w + 14, height: p.h + 8 });
    cx.saida = sumir(cx)
      .fromTo(e, { opacity: 0, scale: 1.2 }, { opacity: 1, scale: 1, duration: 0.3, ease: "mola" })
      .to(e, { opacity: 0, duration: 0.35, ease: "power1.in" }, "+=0.4");
    if (grupo) caixas[grupo] = cx;
  }
  /** Sombra no chão do quadro para o card que sobe: fica no plano, o card sobe em z (paralaxe de verdade). */
  const voando = new Set<CardCena>();
  function erguer(c: CardCena) {
    if (!c.sombra) {
      c.sombra = document.createElement("span");
      c.sombra.className = "sombra";
      el.mundo.insertBefore(c.sombra, c.el);
      gsap.set(c.sombra, { z: Z_SOMBRA });
    }
    c.sombra.style.height = c.h + "px";
    c.xAnt = Number(gsap.getProperty(c.el, "x"));
    voando.add(c);
  }
  function pousou(c: CardCena) {
    voando.delete(c);
    c.vx = 0;
    gsap.to(c.el, { rotation: 0, duration: 0.4, ease: "mola" });
    const s = c.sombra;
    if (s) gsap.to(s, { opacity: 0, duration: 0.3, onComplete: () => { s.remove(); if (c.sombra === s) c.sombra = null; } });
  }
  function atualizarVoo(c: CardCena, dt: number) {
    const x = Number(gsap.getProperty(c.el, "x")), y = Number(gsap.getProperty(c.el, "y")), z = Number(gsap.getProperty(c.el, "z"));
    if (dt > 0) c.vx += ((x - c.xAnt) / dt - c.vx) * (1 - Math.exp(-dt * 9));
    c.xAnt = x;
    // Balanço proporcional à velocidade (docs/design.md, coreografia do card).
    gsap.set(c.el, { rotation: c.incl + gsap.utils.clamp(-7, 7, c.vx * 0.0045) });
    if (c.sombra) gsap.set(c.sombra, { x: x + z * 0.2, y: y + z * 0.45, opacity: Math.min(1, z / 55) * 0.8, scale: 1 + z * 0.0012 });
  }
  /** O card cai no quadro: acelera, amassa um tico e assenta com mola. */
  function pousar(c: CardCena, g: number, quique: (t: number) => number) {
    gsap.timeline()
      .to(c.el, { z: Z_CARD, scale: 1, duration: 0.32, ease: "power2.in" })
      .to(c.el, { scale: 0.985, duration: 0.07, ease: "power1.out" })
      .to(c.el, { scale: 1, duration: 0.55, ease: quique });
    return espera(0.32, g).then(() => pousou(c));
  }
  function esmaecerOutros(c: CardCena, sim: boolean) {
    if (!est.quadroVisivel) return;
    cols.forEach((col) => col.cards.forEach((k) => { if (k !== c) gsap.to(k.el, { opacity: sim ? 0.78 : 1, duration: 0.25, overwrite: "auto" }); }));
  }
  function revelarQuadro(rapido = false) {
    est.quadroVisivel = true;
    const d = rapido ? 0.3 : 1;
    cols.forEach((col) => {
      gsap.fromTo(col.el, { autoAlpha: 0, z: -70 }, { autoAlpha: 1, z: 0, duration: 0.9 * d, ease: "mola", delay: col.i * 0.08 * d });
      col.cards.forEach((k, j) => {
        if (k.heroi) return;
        gsap.fromTo(k.el, { autoAlpha: 0, z: 110 }, { autoAlpha: 1, z: Z_CARD, duration: 0.85 * d, ease: "mola", delay: (0.15 + col.i * 0.07 + j * 0.06) * d });
      });
      contar(col, col.cards.filter((k) => !k.heroi || k.noQuadro).length, false);
    });
  }
  function esconderQuadro() {
    est.quadroVisivel = false;
    cols.forEach((col) => {
      const atraso = cols.length - 1 - col.i;
      gsap.to(col.el, { autoAlpha: 0, z: -50, duration: 0.7, ease: "power2.in", delay: atraso * 0.05 });
      col.cards.forEach((k) => { if (!k.heroi) gsap.to(k.el, { autoAlpha: 0, z: 60, duration: 0.55, ease: "power2.in", delay: atraso * 0.04 }); });
    });
  }

  // ---------- Um quadro por vez ----------
  function quadro(_t: number, dtMs: number) {
    const dt = (Math.min(dtMs, 64) / 1000) * est.vel;
    est.tempo += dt;
    if (!par.congelado) {
      const k = 1 - Math.exp(-dt * 2.6);
      par.x += (par.ax - par.x) * k;
      par.y += (par.ay - par.y) * k;
    }
    if (est.seguir && !par.congelado) {
      const ctr = centroDoCard(est.seguir.card), k = 1 - Math.exp(-dt * 2.2);
      cam.fx += (ctr.x + est.seguir.dx - cam.fx) * k;
      cam.fy += (ctr.y + est.seguir.dy - cam.fy) * k;
    }
    aplicarCamera();
    voando.forEach((c) => atualizarVoo(c, dt));
    esfera.desenhar(dt);
    desenharCursor();
  }
  gsap.ticker.add(quadro);

  /** Para só as animações desta cena (nunca o GSAP inteiro: no modo de desenvolvimento o React monta a tela duas vezes). */
  function pararAnimacoes() {
    est.geracao++;
    const cards = cols.flatMap((c) => c.cards);
    gsap.killTweensOf([cam, esf, cur, el.mundo, el.nevoa, ...el.mundo.querySelectorAll("*"), ...cards]);
  }
  function desmontar() {
    pararAnimacoes();
    gsap.ticker.remove(quadro);
    removeEventListener("pointermove", aoMover);
    el.mundo.replaceChildren();
  }

  medir();
  return {
    el, est, cols, cam, par, esf, cur, voando, CX: () => CX, CY: () => CY,
    espera, tw, vivo, medir, area, aplicarCamera, mapa, enquadrar, centroDoCard, camPerto, camLonge,
    lerCorEsfera: esfera.lerCor, lugarDaEsfera, pontoDe, voarAte, clicar,
    yDoSlot, arrumarColuna, tirarDaColuna, porNaColuna, contar, recontar, acenderColuna, brilharCard, trocarFaixa, encaixe,
    erguer, pousou, pousar, esmaecerOutros, revelarQuadro, esconderQuadro, pararAnimacoes, desmontar,
  };
}

export type Palco = ReturnType<typeof criarPalco>;
