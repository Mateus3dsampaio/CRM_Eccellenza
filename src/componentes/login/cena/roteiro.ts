import { gsap } from "gsap";
import { iniciais } from "@/componentes/ui";
import { CLIENTES, CONSULTOR, PASSOS_DO_CLIENTE, cardDoCliente, dadosDoCard, faixaDaColuna, type Cliente } from "./dados";
import { bezier, molaFisica } from "./geometria";
import { CARD_W, cardX } from "./medidas";
import { criarBalao, criarCard, esvaziar, pintarFaixa, posNoMundo, type BalaoCena, type CardCena } from "./montar";
import type { Palco } from "./nucleo";

/**
 * Roteiro da cena do login (tarefa 46, protótipo aprovado em 23/11/2026). Seis atos, ~25 s, e se repete com o
 * próximo cliente: 1) a mensagem chega; 2) o assistente lê; 3) as palavras voam para os campos do card;
 * 4) a câmera se afasta e o card pousa no quadro; 5) passa ao consultor; 6) medição, apresentação e Fechado.
 * Regras do CRM respeitadas: o bot não agenda (passa ao consultor); a agenda move o card; Fechado é arrastado.
 */

export const QUIQUE = molaFisica(0.38, 16);

export function criarRoteiro(p: Palco, marcarAto: (texto: string) => void) {
  const { est, cols, cam, esf, cur, espera, tw, voarAte } = p;
  const agora = () => new Date();
  const heroi = () => est.heroi!;
  const balao = () => est.balao!;
  const some = (e: HTMLElement | undefined, d = 0.22) => e && gsap.to(e, { autoAlpha: 0, duration: d, ease: "power1.out" });

  // ---------- O cliente da vez: card vazio no topo de "IA atendendo" e o balão ao lado (PC) ou em cima (celular) ----------
  function prepararCliente(cli: Cliente) {
    const d = dadosDoCard(cardDoCliente(cli, PASSOS_DO_CLIENTE.ia), agora());
    const c = criarCard(p.el.mundo, d);
    c.heroi = true;
    c.noQuadro = false;
    c.h = c.el.offsetHeight;
    p.porNaColuna(c, 0, 0);
    gsap.set(c.el, { x: cardX(0), y: est.cabH, autoAlpha: 0 });
    p.arrumarColuna(cols[0], { ignorar: c, dur: 0.8 });
    esvaziar(c);
    est.heroi = c;
    const b: BalaoCena = criarBalao(p.el.mundo, cli, d.hora);
    gsap.set(b.el, { autoAlpha: 0 });
    const bw = b.el.offsetWidth, bh = b.el.offsetHeight;
    if (est.celular) { b.x = cardX(0) + CARD_W / 2 - bw / 2; b.y = est.cabH - bh - 74; }
    else { b.x = cardX(0) - 104 - bw; b.y = est.cabH - b.corpo.offsetTop; }
    gsap.set(b.el, { x: b.x, y: b.y });
    est.balao = b;
  }

  // Ato 1 · digitando… → o balão abre → as palavras entram; o card nasce vazio
  async function ato1(g: number) {
    marcarAto("1 · A mensagem chega");
    const b = balao(), c = heroi();
    const bw = b.corpo.offsetWidth, bh = b.corpo.offsetHeight, R = "round 6px 20px 20px 20px";
    gsap.set(b.el, { autoAlpha: 1 });
    gsap.set(b.palavras, { autoAlpha: 0, y: 8 });
    gsap.set([b.pe, b.rabo], { autoAlpha: 0 });
    gsap.set(b.corpo, { clipPath: `inset(0px ${bw - 96}px ${bh - 58}px 0px ${R})` });
    gsap.fromTo(b.rot, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "mola" });
    gsap.fromTo(b.corpo, { autoAlpha: 0, scale: 0.7, transformOrigin: "0% 0%" }, { autoAlpha: 1, scale: 1, duration: 0.55, ease: "salto", delay: 0.08 });
    const pulo = gsap.to(b.pontos, { y: -6, duration: 0.3, ease: "sine.inOut", stagger: { each: 0.13, repeat: -1, yoyo: true } });
    await espera(0.4, g);
    gsap.fromTo(c.el, { autoAlpha: 0, y: est.cabH + 22, scale: 0.97 }, { autoAlpha: 1, y: est.cabH, scale: 1, duration: 0.75, ease: "mola" });
    await espera(0.8, g);
    gsap.to(b.pontosBox, { autoAlpha: 0, duration: 0.14, onComplete: () => { pulo.kill(); } });
    gsap.to(b.corpo, {
      clipPath: `inset(0px 0px 0px 0px ${R})`, duration: 0.62, ease: "mola",
      onComplete: () => { gsap.set(b.corpo, { clipPath: "none" }); gsap.to(b.rabo, { autoAlpha: 1, duration: 0.2 }); },
    });
    gsap.to(b.palavras, { autoAlpha: 1, y: 0, duration: 0.45, ease: "mola", stagger: 0.028, delay: 0.1 });
    await espera(0.1 + b.palavras.length * 0.028 + 0.3, g);
    gsap.fromTo(b.pe, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "mola" });
    await espera(0.4, g);
  }

  // Ato 2 · o assistente sai da marca, lê palavra por palavra e acende o que importa
  async function ato2(g: number) {
    marcarAto("2 · O assistente lê");
    const b = balao(), ws = b.palavras, n = ws.length;
    const ponto = (i: number) => {
      const r = ws[Math.max(0, Math.min(n - 1, i))].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top - r.height * 0.22, r: Math.max(12, Math.min(18, r.height * 0.55)) };
    };
    gsap.to(esf, { brilho: 0.75, giro: 1, duration: 0.6 });
    await voarAte(esf, () => ponto(0), { dur: 1.0, arco: -110 }, g);
    b.checks.classList.add("lido");
    gsap.fromTo(b.checks, { scale: 1.45 }, { scale: 1, duration: 0.45, ease: "salto" });
    const leitura = { u: 0 }, lidas = new Set<number>();
    await tw(leitura, {
      u: n - 1, duration: 0.1 * n, ease: "sine.inOut",
      onUpdate() {
        const i = Math.floor(leitura.u), fr = leitura.u - i, a = ponto(i), z = ponto(i + 1);
        esf.x = a.x + (z.x - a.x) * fr;
        esf.y = a.y + (z.y - a.y) * fr;
        esf.r = a.r + (z.r - a.r) * fr;
        ws.forEach((w, k) => {
          if (k > leitura.u + 0.35 || lidas.has(k)) return;
          lidas.add(k);
          const kw = w.querySelector<HTMLElement>(".kw");
          if (kw) {
            kw.classList.add("acesa");
            gsap.to(kw, { "--k": 1, duration: 0.34, ease: "mola" });
            esf.impulso += 2.5;
          }
        });
      },
    }, g);
    gsap.to(esf, { brilho: 0.5, giro: 0.7, duration: 0.5 });
  }

  // Ato 3 · cada palavra voa até o campo exato do card; o balão vira a prévia; a esfera senta no selo
  async function voarPalavra(kw: HTMLElement, c: CardCena, g: number) {
    const campo = kw.dataset.campo ?? "", q = c.q;
    let alvo: HTMLElement, rotulo: string, grupo: HTMLElement | null = null, esq: HTMLElement | undefined;
    let extra: HTMLElement[] = [];
    if (campo === "nome") { alvo = q.nomeT; rotulo = "NOME"; esq = c.esq.nome; }
    else if (campo === "cidade") { alvo = q.cidT; rotulo = "CIDADE"; grupo = q.cid; esq = c.esq.cid; }
    else {
      const i = Number(campo.split(":")[1]);
      alvo = q.ambItens[i];
      rotulo = "AMBIENTE";
      grupo = q.amb;
      esq = i === 0 ? c.esq.amb : undefined;
      if (i > 0) extra = [q.virg[i - 1]];
    }
    const voo = document.createElement("span");
    voo.className = "voo";
    voo.textContent = kw.textContent;
    p.el.mundo.appendChild(voo);
    const fs0 = parseFloat(getComputedStyle(kw).fontSize), fs1 = parseFloat(getComputedStyle(alvo).fontSize);
    const kN = voo.offsetHeight / fs0; // altura "normal" da linha da Inter: alinha o desenho das letras, não a caixa
    const de = posNoMundo(p.el.mundo, kw), para = posNoMundo(p.el.mundo, alvo);
    const fim = { x: para.x, y: para.y + (para.h - kN * fs1) / 2 }, s1 = fs1 / fs0;
    const ctrl = est.celular ? { x: (de.x + fim.x) / 2 + 110, y: (de.y + fim.y) / 2 } : { x: (de.x + fim.x) / 2, y: Math.min(de.y, fim.y) - 130 };
    gsap.set(voo, { x: de.x, y: de.y, z: 1.5, transformOrigin: "0 0" }); // meio px acima do card: pousa sem erro de perspectiva
    gsap.to(kw, { opacity: 0.32, duration: 0.3 });
    await tw(voo, { scale: 1.1, duration: 0.14, ease: "power2.out" }, g);
    const o = { p: 0 };
    await tw(o, {
      p: 1, duration: 0.72, ease: "power3.inOut",
      onUpdate() {
        const pt = bezier(de, ctrl, fim, o.p);
        gsap.set(voo, { x: pt.x, y: pt.y, scale: 1.1 + (s1 - 1.1) * o.p });
      },
    }, g);
    gsap.to(voo, { opacity: 0, duration: 0.16, onComplete: () => voo.remove() });
    if (grupo) gsap.set(grupo, { autoAlpha: 1 });
    gsap.set([alvo, ...extra], { autoAlpha: 1 });
    gsap.fromTo([alvo, ...extra], { opacity: 0 }, { opacity: 1, duration: 0.16 });
    gsap.fromTo(alvo, { scale: 1.08 }, { scale: 1, duration: 0.5, ease: "salto", transformOrigin: "0% 60%" });
    some(esq);
    p.encaixe(alvo, rotulo, campo.startsWith("amb") ? "amb" : null);
    if (campo === "nome") {
      q.av.classList.remove("vazio");
      gsap.fromTo(q.av, { scale: 0.84 }, { scale: 1, duration: 0.55, ease: "salto" });
      gsap.to(q.avT, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "salto", delay: 0.05 });
    }
  }
  function recolherBalao(b: BalaoCena, c: CardCena) {
    const de = posNoMundo(p.el.mundo, b.corpo), pv = posNoMundo(p.el.mundo, c.q.previa);
    const alvo = { x: pv.x + 17, y: pv.y + 11, w: pv.w - 34 };
    const k = alvo.w / de.w, ox = de.x - b.x, oy = de.y - b.y;
    gsap.to(b.rot, { autoAlpha: 0, y: -8, duration: 0.25 });
    gsap.to(b.el, { x: alvo.x - ox * k, y: alvo.y - oy * k, scale: k, transformOrigin: "0 0", duration: 0.7, ease: "power3.inOut" });
    gsap.to(b.el, { autoAlpha: 0, duration: 0.32, delay: 0.3, ease: "power1.in" });
    gsap.to(c.q.previa, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.6, delay: 0.32, ease: "mola" });
    some(c.esq.p1);
    some(c.esq.p2);
  }
  const pontoDoSelo = (c: CardCena) => () => {
    const r = c.q.selo.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width * 0.5 };
  };
  async function ato3(g: number) {
    marcarAto("3 · O card se preenche");
    const b = balao(), c = heroi();
    const meio = () => {
      const rb = b.corpo.getBoundingClientRect(), rc = c.el.getBoundingClientRect();
      return est.celular ? { x: rc.right - 24, y: (rb.bottom + rc.top) / 2, r: 14 } : { x: (rb.right + rc.left) / 2, y: rc.top + rc.height * 0.28, r: 14 };
    };
    voarAte(esf, meio, { dur: 0.55, arco: -40 }, g).catch(() => {});
    await espera(0.3, g);
    await Promise.all(b.chaves.map((kw, i) => espera(i * 0.3, g).then(() => voarPalavra(kw, c, g))));
    await espera(0.7, g);
    recolherBalao(b, c);
    const ctr = p.centroDoCard(c); // a câmera recentra no card: agora ele é o assunto
    gsap.to(cam, { fx: ctr.x, fy: ctr.y, duration: 1.4, ease: "power2.inOut" });
    await espera(0.35, g);
    some(c.esq.anel, 0.18);
    gsap.set(c.q.anelW, { autoAlpha: 1 });
    gsap.to(c.q.arco, { attr: { "stroke-dashoffset": 0 }, duration: 0.85, ease: "mola" });
    await espera(0.25, g);
    gsap.set(c.q.selo, { autoAlpha: 1 });
    await voarAte(esf, pontoDoSelo(c), { dur: 0.6, arco: -50, ease: "power3.inOut" }, g);
    esf.preso = c.q.selo;
    gsap.to(esf, { brilho: 0.32, giro: 0.6, duration: 0.4 });
    gsap.fromTo(c.q.selo, { scale: 1.35 }, { scale: 1, duration: 0.5, ease: "salto" });
    pintarFaixa(c, faixaDaColuna(0, agora()));
    some(c.esq.faixa);
    gsap.fromTo(c.q.fc, { autoAlpha: 0, x: 8 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: "mola" });
    await espera(0.4, g);
    p.erguer(c);
    gsap.to(c.el, { z: 40, duration: 0.7, ease: "mola" });
    await espera(0.2, g);
  }

  // Ato 4 · a câmera se afasta, o quadro se monta em volta e o card pousa em "IA atendendo"
  async function ato4(g: number) {
    marcarAto("4 · O card entra no quadro");
    const c = heroi();
    est.seguir = null;
    gsap.to(p.el.nevoa, { opacity: 1, duration: 1.6 });
    gsap.killTweensOf(cam);
    const mov = tw(cam, { ...p.camLonge(c), duration: 2.2, ease: "cinema" }, g);
    mov.catch(() => {}); // se o roteiro for interrompido antes do await, o cancelamento não vira erro solto
    await espera(0.35, g);
    p.revelarQuadro();
    await espera(1.05, g);
    await p.pousar(c, g, QUIQUE);
    c.noQuadro = true;
    p.contar(cols[0], cols[0].cards.length);
    p.acenderColuna(cols[0]);
    await mov;
    const ctr = p.centroDoCard(c);
    est.seguir = { card: c, dx: cam.fx - ctr.x, dy: cam.fy - ctr.y };
  }

  // ---------- Atos 5 e 6: o card anda pelo funil ----------
  /** Movimento feito pelo sistema (como no CRM quando a agenda move o card): sobe, atravessa, assenta. */
  async function moverCard(c: CardCena, dest: number, g: number, dur = 1.0) {
    const orig = c.col;
    p.tirarDaColuna(c);
    p.porNaColuna(c, dest, 0);
    p.erguer(c);
    p.arrumarColuna(cols[orig], { dur: 0.6 });
    p.arrumarColuna(cols[dest], { dur: 0.6, ignorar: c });
    gsap.to(c, { incl: 2, duration: 0.3 });
    gsap.timeline()
      .to(c.el, { z: 64, scale: 1.045, duration: 0.32, ease: "power2.out" })
      .to(c.el, { x: cardX(dest), y: est.cabH, duration: dur, ease: "power2.inOut" }, 0.14)
      .add(() => { gsap.to(c, { incl: 0, duration: 0.4 }); }, 0.14 + dur * 0.7);
    await espera(0.14 + dur * 0.8, g);
    await p.pousar(c, g, QUIQUE);
    p.contar(cols[orig], cols[orig].cards.length);
    p.contar(cols[dest], cols[dest].cards.length);
    p.acenderColuna(cols[dest]);
    await espera(0.15, g);
  }
  const pontoDaFaixa = (c: CardCena) => () => p.pontoDe(c.q.faixa, 0.72, 0.55);
  function trazerCursor(c: CardCena, g: number) {
    if (cur.vis > 0.5) return voarAte(cur, pontoDaFaixa(c), { dur: 0.45, arco: -20 }, g);
    cur.x = innerWidth - (est.celular ? 60 : 300);
    cur.y = innerHeight * 0.8;
    cur.s = 1;
    cur.preso = null;
    gsap.to(cur, { vis: 1, duration: 0.45 });
    return voarAte(cur, pontoDaFaixa(c), { dur: 0.9, arco: -70 }, g);
  }
  async function passarAoConsultor(g: number) {
    marcarAto("5 · Passa ao consultor");
    const c = heroi();
    await espera(0.2, g);
    if (esf.preso === c.q.selo) {
      esf.preso = null;
      gsap.to(esf, { brilho: 0.25, giro: 0.45, duration: 0.8 });
      voarAte(esf, p.lugarDaEsfera, { dur: 1.25, arco: -170 }, g).catch(() => {});
    }
    gsap.to(c.q.sHum, { autoAlpha: 1, duration: 0.3, delay: 0.2 });
    gsap.fromTo(c.q.selo, { scale: 1.3 }, { scale: 1, duration: 0.5, ease: "salto", delay: 0.2 });
    await espera(0.25, g);
    p.trocarFaixa(c, faixaDaColuna(1, agora()));
    c.q.ini.textContent = iniciais(CONSULTOR.nome);
    gsap.to(c.q.ini, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "salto", delay: 0.15 });
    await espera(0.4, g);
    await moverCard(c, 1, g);
    await trazerCursor(c, g);
  }
  /** O consultor marca a data (clique) e a agenda move o card sozinha para a coluna do compromisso. */
  async function marcarCompromisso(dest: number, ato: string, g: number) {
    marcarAto(ato);
    const c = heroi();
    await trazerCursor(c, g);
    await p.clicar(g);
    p.trocarFaixa(c, faixaDaColuna(dest, agora()));
    p.brilharCard(c, "var(--color-sucesso)");
    await espera(0.4, g);
    const segue = voarAte(cur, pontoDaFaixa(c), { dur: 1.4, arco: -30 }, g);
    segue.catch(() => {});
    await moverCard(c, dest, g);
    if (dest === 3) p.brilharCard(c, "var(--color-etapa-apresentacao)");
    await segue;
    await espera(0.15, g);
  }
  /** Fechado e Perdido não têm faixa nem anel: a faixa encolhe e o card diminui (como no kanban). */
  function fecharCard(c: CardCena) {
    gsap.to(c.q.anelW, { autoAlpha: 0, duration: 0.3 });
    gsap.to(c.q.faixa, {
      height: 0, paddingTop: 0, paddingBottom: 0, opacity: 0, duration: 0.42, ease: "mola",
      onComplete() {
        pintarFaixa(c, null);
        gsap.set(c.q.faixa, { clearProps: "height,paddingTop,paddingBottom,opacity" });
        c.h = c.el.offsetHeight;
        p.arrumarColuna(cols[c.col], { dur: 0.5 });
      },
    });
  }
  /** Fechar a venda é com a mão do consultor: o cursor pega o card e arrasta até Fechado. */
  async function arrastarAteFechado(g: number) {
    marcarAto("6 · Venda fechada");
    const c = heroi(), pega = { fx: 0.42, fy: 0.15 };
    if (cur.vis < 0.5) {
      cur.x = innerWidth - (est.celular ? 60 : 300);
      cur.y = innerHeight * 0.8;
      gsap.to(cur, { vis: 1, duration: 0.45 });
    }
    await voarAte(cur, () => p.pontoDe(c.el, pega.fx, pega.fy), { dur: 0.55, arco: -30 }, g);
    await tw(cur, { s: 0.86, duration: 0.1 }, g);
    const orig = c.col, dest = 5;
    p.erguer(c);
    gsap.to(c, { incl: 3, duration: 0.25, ease: "power2.out" });
    gsap.to(c.el, { z: 76, scale: 1.05, duration: 0.3, ease: "power2.out" });
    p.esmaecerOutros(c, true);
    cur.preso = { el: c.el, ...pega };
    await espera(0.28, g);
    p.tirarDaColuna(c);
    p.porNaColuna(c, dest, 0);
    p.arrumarColuna(cols[orig], { dur: 0.6 });
    cols[dest].el.classList.add("alvo");
    p.arrumarColuna(cols[dest], { dur: 0.6, ignorar: c });
    const y0 = Number(gsap.getProperty(c.el, "y"));
    gsap.to(c.el, { keyframes: { y: [y0, Math.min(y0, est.cabH) - 46, est.cabH] }, duration: 1.35, ease: "sine.inOut" });
    await tw(c.el, { x: cardX(dest), duration: 1.35, ease: "power2.inOut" }, g);
    cols[dest].el.classList.remove("alvo");
    cur.preso = null;
    gsap.to(cur, { s: 1, duration: 0.3, ease: "salto" });
    gsap.to(c, { incl: 0, duration: 0.35 });
    await p.pousar(c, g, QUIQUE);
    p.esmaecerOutros(c, false);
    p.contar(cols[orig], cols[orig].cards.length);
    p.contar(cols[dest], cols[dest].cards.length);
    p.acenderColuna(cols[dest]);
    fecharCard(c);
  }
  async function finale(g: number) {
    const c = heroi(), col = cols[5];
    gsap.fromTo(col.varre, { autoAlpha: 1, y: -420 }, { y: 1300, duration: 1.5, ease: "power1.inOut", onComplete: () => { gsap.set(col.varre, { autoAlpha: 0 }); } });
    p.brilharCard(c, "var(--color-etapa-fechado)");
    await espera(0.4, g);
    gsap.to(cur, { vis: 0, x: cur.x + 70, y: cur.y + 50, duration: 0.6, ease: "power2.in" });
    await espera(1.0, g);
  }
  /** A história continua de onde o card está (também depois que a pessoa arrasta um card). */
  async function jornada(g: number) {
    for (let guarda = 0; guarda < 8; guarda++) {
      const col = heroi().col;
      if (col === 0) await passarAoConsultor(g);
      else if (col === 1) await marcarCompromisso(2, "6 · A medição é marcada", g);
      else if (col === 2) await marcarCompromisso(3, "6 · A apresentação é marcada", g);
      else if (col === 3 || col === 4) await arrastarAteFechado(g);
      else if (col === 5) { await finale(g); return; }
      else return; // Perdido: a história deste cliente acaba aqui
    }
  }
  /** Fechado não cresce para sempre: o card mais antigo sai de cena. */
  function podar(max: number) {
    const col = cols[5];
    while (col.cards.length > max) {
      const k = col.cards.pop()!;
      gsap.to(k.el, { autoAlpha: 0, duration: 0.4, onComplete: () => k.el.remove() });
    }
  }
  async function voltarAoInicio(g: number) {
    marcarAto("Próximo cliente");
    est.seguir = null;
    heroi().heroi = false;
    podar(4);
    est.balao?.el.remove();
    est.balao = null;
    est.nCliente++;
    gsap.to(p.el.nevoa, { opacity: 0.6, duration: 1.6 });
    prepararCliente(CLIENTES[est.nCliente % CLIENTES.length]);
    gsap.killTweensOf(cam);
    gsap.to(cam, { ...p.camPerto(balao(), heroi()), duration: 2.0, ease: "cinema" });
    await espera(0.45, g);
    p.esconderQuadro();
    await espera(1.2, g);
  }
  async function ciclo(g: number) {
    for (;;) {
      await ato1(g);
      await ato2(g);
      await ato3(g);
      await ato4(g);
      await jornada(g);
      await voltarAoInicio(g);
    }
  }
  /** Card da história solto pela pessoa noutra coluna: faixa, selo e anel daquela coluna. */
  function estadoDaColuna(c: CardCena, col: number) {
    if (col > 0 && esf.preso === c.q.selo) {
      esf.preso = null;
      voarAte(esf, p.lugarDaEsfera, { dur: 1, arco: -120 }, est.geracao).catch(() => {});
      c.q.ini.textContent = iniciais(CONSULTOR.nome);
      gsap.to(c.q.sHum, { autoAlpha: 1, duration: 0.3 });
      gsap.to(c.q.ini, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "salto" });
    }
    if (col >= 5) {
      if (c.q.faixa.style.display !== "none") fecharCard(c);
      return;
    }
    const f = col === 0 && esf.preso !== c.q.selo ? faixaDaColuna(1, agora()) : faixaDaColuna(col, agora());
    if (c.q.faixa.style.display === "none") {
      pintarFaixa(c, f);
      gsap.set(c.q.anelW, { autoAlpha: 1 });
      c.h = c.el.offsetHeight;
      p.arrumarColuna(cols[col], { dur: 0.4 });
    } else p.trocarFaixa(c, f);
  }
  return { prepararCliente, ciclo, jornada, voltarAoInicio, estadoDaColuna };
}

export type Roteiro = ReturnType<typeof criarRoteiro>;
