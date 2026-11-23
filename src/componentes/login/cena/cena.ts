import { gsap } from "gsap";
import { CLIENTES, PASSOS_DO_CLIENTE, QUADRO, cardDoCliente, dadosDoCard } from "./dados";
import { COL_GAP, COL_W, ESCALA_MUNDO, Z_CARD, cardX } from "./medidas";
import { criarCard, type CardCena } from "./montar";
import { CANCELADO, criarPalco, type Elementos } from "./nucleo";
import { QUIQUE, criarRoteiro } from "./roteiro";

/**
 * Cena do login "Da conversa ao card" (tarefa 46). A página chama `iniciarCena` depois de montar e `parar` ao sair.
 * - "Reduzir movimento" ligado, ou um computador que não passa de ~24 quadros por segundo no começo: imagem parada.
 * - PC: dá para pegar qualquer card do quadro e arrastar (a história continua sozinha 2,6 s depois).
 * - `mergulhar()`: ao entrar, o quadro fica reto, do tamanho do kanban real; a página navega quando termina.
 * Em `raiz.dataset.ato` fica o ato atual (os testes de tela leem).
 */
export interface Cena {
  mergulhar(): Promise<void>;
  parar(): void;
}

const QPS_MINIMO = 24;

export async function iniciarCena(el: Elementos): Promise<Cena> {
  const p = criarPalco(el);
  const { est, cols, cam, esf, cur, par } = p;
  const marcarAto = (t: string) => { el.raiz.dataset.ato = t; };
  const roteiro = criarRoteiro(p, marcarAto);
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let parado = false;

  async function rodar(passos: (g: number) => Promise<void>) {
    const g = ++est.geracao;
    try {
      await passos(g);
    } catch (e) {
      if (e !== CANCELADO) console.error(e);
    }
  }

  // ---------- Montagem: fonte carregada antes de medir (o layout dos cards depende dela) ----------
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    /* sem a fonte, mede com a do sistema */
  }
  est.cabH = Math.round(cols[0].cab.offsetTop + cols[0].cab.offsetHeight + 17);
  const agora = new Date();
  QUADRO.forEach((lista, i) =>
    lista.forEach((fic) => {
      const c = criarCard(el.mundo, dadosDoCard(fic, agora));
      c.h = c.el.offsetHeight;
      p.porNaColuna(c, i, cols[i].cards.length);
    }),
  );
  cols.forEach((col) => {
    p.arrumarColuna(col, { instante: true });
    gsap.set(col.el, { autoAlpha: 0 });
    col.cards.forEach((k) => gsap.set(k.el, { autoAlpha: 0 }));
  });
  const casa = p.lugarDaEsfera();
  Object.assign(esf, { x: casa.x, y: casa.y, r: 10 });

  /** A mesma história numa imagem: o quadro inclinado com o card da Larissa já com o consultor. */
  function cenaParada() {
    parado = true;
    p.pararAnimacoes();
    cam.par = 0;
    esf.giro = 0;
    esf.preso = null;
    Object.assign(esf, p.lugarDaEsfera(), { brilho: 0.25, vis: 1 });
    cur.vis = 0;
    est.balao?.el.remove();
    est.balao = null;
    if (est.heroi) {
      p.tirarDaColuna(est.heroi);
      est.heroi.el.remove();
      est.heroi.sombra?.remove();
    }
    p.voando.clear();
    el.mundo.querySelectorAll(".voo, .encaixe, .sombra").forEach((e) => e.remove());
    const c = criarCard(el.mundo, dadosDoCard(cardDoCliente(CLIENTES[0], PASSOS_DO_CLIENTE.responder), new Date()));
    c.h = c.el.offsetHeight;
    c.heroi = true;
    est.heroi = c;
    p.porNaColuna(c, 1, 0);
    cols.forEach((col) => {
      p.arrumarColuna(col, { instante: true });
      gsap.set(col.el, { autoAlpha: 1, z: 0 });
      col.cards.forEach((k) => gsap.set(k.el, { autoAlpha: 1, z: Z_CARD, scale: 1, rotation: 0, opacity: 1 }));
      p.contar(col, col.cards.length, false);
    });
    est.quadroVisivel = true;
    est.seguir = null;
    Object.assign(cam, p.camLonge(c));
    gsap.set(el.nevoa, { opacity: 1 });
    marcarAto("Imagem parada");
  }

  // ---------- Arrastar um card (só no PC: no celular o dedo rola a página) ----------
  let arrasto: { c: CardCena; origCol: number; origIdx: number; dest: number | null; idx: number | null; offX: number; offY: number } | null = null;
  let retomada: gsap.core.Tween | null = null;
  function interromper() {
    est.geracao++;
    retomada?.kill();
    const h = est.heroi;
    if (h) {
      gsap.killTweensOf(h.el);
      gsap.killTweensOf(h);
    }
    gsap.to(cur, { vis: 0, duration: 0.3 });
    cur.preso = null;
    est.seguir = null;
  }
  function aoApertar(e: PointerEvent) {
    if (parado || est.mergulhando || !est.quadroVisivel || est.celular || e.button !== 0 || arrasto) return;
    const alvo = (e.target as Element).closest<HTMLElement>(".card");
    const c = [...cols.flatMap((col) => col.cards)].find((k) => k.el === alvo);
    if (!c) return;
    e.preventDefault();
    interromper();
    marcarAto("Arrastando um card");
    p.voando.forEach((k) => { if (k !== c) { gsap.set(k.el, { z: Z_CARD, scale: 1 }); p.pousou(k); } });
    par.congelado = true;
    const w = p.mapa().paraMundo(e.clientX, e.clientY);
    const origCol = c.col, origIdx = p.tirarDaColuna(c);
    arrasto = { c, origCol, origIdx, dest: null, idx: null, offX: w.x - Number(gsap.getProperty(c.el, "x")), offY: w.y - Number(gsap.getProperty(c.el, "y")) };
    p.arrumarColuna(cols[origCol], { dur: 0.45 });
    p.erguer(c);
    el.palco.classList.add("arrastando");
    gsap.to(c, { incl: 3, duration: 0.25, ease: "power2.out" });
    gsap.to(c.el, { z: 76, scale: 1.05, duration: 0.28, ease: "power2.out" });
    p.esmaecerOutros(c, true);
  }
  function aoArrastar(e: PointerEvent) {
    if (!arrasto) return;
    const a = arrasto, w = p.mapa().paraMundo(e.clientX, e.clientY);
    gsap.set(a.c.el, { x: w.x - a.offX, y: w.y - a.offY });
    const i = Math.floor((w.x + COL_GAP / 2) / (COL_W + COL_GAP));
    const dest = i >= 0 && i < cols.length && w.y > -80 && w.y < 1700 ? i : null;
    let idx: number | null = null;
    if (dest != null) {
      const meio = w.y - a.offY + a.c.h / 2, lista = cols[dest].cards;
      idx = lista.findIndex((k, j) => meio < p.yDoSlot(cols[dest], j) + k.h / 2);
      if (idx < 0) idx = lista.length;
    }
    if (dest === a.dest && idx === a.idx) return;
    if (a.dest != null && a.dest !== dest) {
      cols[a.dest].el.classList.remove("alvo");
      p.arrumarColuna(cols[a.dest], { dur: 0.45 });
    }
    a.dest = dest;
    a.idx = idx;
    if (dest != null && idx != null) {
      cols[dest].el.classList.add("alvo");
      p.arrumarColuna(cols[dest], { dur: 0.45, buraco: { indice: idx, h: a.c.h } });
    }
  }
  function aoSoltar() {
    if (!arrasto) return;
    const { c, origCol, origIdx } = arrasto;
    let dest = arrasto.dest, idx = arrasto.idx;
    if (dest == null || idx == null) { dest = origCol; idx = origIdx; } // fora do quadro: volta com mola (sem teletransporte)
    arrasto = null;
    el.palco.classList.remove("arrastando");
    cols.forEach((col) => col.el.classList.remove("alvo"));
    p.porNaColuna(c, dest, Math.min(idx, cols[dest].cards.length));
    p.arrumarColuna(cols[dest], { dur: 0.5, ignorar: c });
    if (origCol !== dest) p.arrumarColuna(cols[origCol], { dur: 0.5 });
    gsap.to(c, { incl: 0, duration: 0.35 });
    gsap.to(c.el, { x: cardX(dest), y: p.yDoSlot(cols[dest], cols[dest].cards.indexOf(c)), duration: 0.5, ease: "mola" });
    p.pousar(c, est.geracao, QUIQUE).catch(() => {});
    p.esmaecerOutros(c, false);
    if (c === est.heroi) {
      c.noQuadro = true;
      roteiro.estadoDaColuna(c, dest);
    }
    p.recontar();
    if (dest !== origCol) p.acenderColuna(cols[dest]);
    par.congelado = false;
    marcarAto("A história continua em instantes");
    retomada = gsap.delayedCall(2.6, () => {
      retomada = null;
      if (!arrasto && !est.mergulhando && !parado) void rodar(continuar);
    });
  }
  async function continuar(g: number) {
    const c = est.heroi!;
    p.voando.forEach((k) => { gsap.set(k.el, { z: Z_CARD, scale: 1 }); p.pousou(k); });
    if (!c.noQuadro) { c.noQuadro = true; gsap.set(c.el, { z: Z_CARD }); }
    p.recontar();
    gsap.killTweensOf(cam);
    await p.tw(cam, { ...p.camLonge(c), duration: 1.2, ease: "cinema" }, g);
    const ctr = p.centroDoCard(c);
    est.seguir = { card: c, dx: cam.fx - ctr.x, dy: cam.fy - ctr.y };
    await roteiro.jornada(g);
    await roteiro.voltarAoInicio(g);
    await roteiro.ciclo(g);
  }
  el.mundo.addEventListener("pointerdown", aoApertar);
  addEventListener("pointermove", aoArrastar);
  addEventListener("pointerup", aoSoltar);
  addEventListener("pointercancel", aoSoltar);

  // ---------- Computador fraco: mede os quadros do 1º ao 3º segundo e, abaixo de 24 por segundo, congela ----------
  let medindo = { desde: 0, quadros: 0, fim: false };
  function medirQps(t: number) {
    if (medindo.fim || parado) return;
    if (t < 1) return;
    if (!medindo.desde) medindo = { desde: t, quadros: 0, fim: false };
    medindo.quadros++;
    if (t - medindo.desde >= 2) {
      medindo.fim = true;
      gsap.ticker.remove(medirQps);
      if (medindo.quadros / (t - medindo.desde) < QPS_MINIMO) cenaParada();
    }
  }

  const aoRedimensionar = () => {
    const antes = est.celular;
    p.medir();
    if (antes !== est.celular && !parado) cenaParada(); // virou de tela: fica a imagem parada, sem montar tudo de novo
    else if (!est.quadroVisivel && est.heroi && est.balao && !est.mergulhando) Object.assign(cam, p.camPerto(est.balao, est.heroi));
  };
  addEventListener("resize", aoRedimensionar);

  if (reduzir) cenaParada();
  else {
    roteiro.prepararCliente(CLIENTES[0]);
    Object.assign(cam, p.camPerto(est.balao!, est.heroi!));
    gsap.set(el.nevoa, { opacity: 0.6 });
    gsap.ticker.add(medirQps);
    void rodar(roteiro.ciclo);
  }

  /** Entrar: a câmera mergulha e o quadro fica reto, no tamanho do kanban real (1 px do CRM = 1 px da tela). */
  async function mergulhar() {
    est.mergulhando = true;
    est.geracao++;
    retomada?.kill();
    est.seguir = null;
    par.congelado = false;
    cam.par = 0;
    par.x = par.y = par.ax = par.ay = 0;
    gsap.killTweensOf(cam);
    const dur = reduzir ? 0.2 : 0.6;
    gsap.to(cur, { vis: 0, duration: 0.2 });
    if (est.balao) gsap.to(est.balao.el, { autoAlpha: 0, duration: 0.2 });
    esf.preso = null;
    gsap.to(esf, { vis: 0, duration: 0.3 });
    if (!est.quadroVisivel) p.revelarQuadro(true);
    gsap.to(el.nevoa, { opacity: 0, duration: dur * 0.8 });
    const s = 1 / ESCALA_MUNDO, esq = est.celular ? 12 : 88, topo = est.celular ? 64 : 84;
    await new Promise<void>((r) => {
      gsap.to(cam, { rx: 0, rz: 0, s, fx: (p.CX() - esq) / s, fy: (p.CY() - topo) / s, duration: dur, ease: reduzir ? "none" : "cinema", onComplete: r });
    });
  }

  function parar() {
    removeEventListener("pointermove", aoArrastar);
    removeEventListener("pointerup", aoSoltar);
    removeEventListener("pointercancel", aoSoltar);
    removeEventListener("resize", aoRedimensionar);
    el.mundo.removeEventListener("pointerdown", aoApertar);
    gsap.ticker.remove(medirQps);
    p.desmontar();
  }

  return { mergulhar, parar };
}
