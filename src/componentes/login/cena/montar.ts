import { gsap } from "gsap";
import { iniciais } from "@/componentes/ui";
import { ETAPAS } from "@/regras/etapas";
import type { Cliente, DadosCard, Faixa } from "./dados";
import { ICONE_DA_ACAO, icone } from "./icones";
import { CIRC, Z_CARD, Z_TOPO } from "./medidas";
import { escaparHtml as esc, palavrasDoTexto } from "./texto";

/**
 * Montagem do DOM da cena do login: card de vitrine, coluna e balão. O card é uma cópia do VISUAL do card do
 * kanban (`componentes/kanban/card.tsx`, medidas × 1,4): o card real depende de dados de quem está logado.
 * Mudou o card do kanban? Mude aqui e em `app/login/login.css`.
 */

export interface CardCena {
  el: HTMLDivElement;
  d: DadosCard;
  /** Índice da coluna em `ETAPAS`. */
  col: number;
  h: number;
  heroi: boolean;
  /** O card da história já pousou no quadro (conta na coluna). */
  noQuadro: boolean;
  /** Inclinação de base ao ser erguido; a do balanço vem da velocidade. */
  incl: number;
  vx: number;
  xAnt: number;
  sombra: HTMLElement | null;
  /** Esqueleto do card que está nascendo. */
  esq: Record<string, HTMLElement>;
  q: {
    av: HTMLElement; avT: HTMLElement; selo: HTMLElement; sBot: Element; sHum: Element; nomeT: HTMLElement;
    faixa: HTMLElement; fc: HTMLElement; previa: HTMLElement; cid: HTMLElement; cidT: HTMLElement; amb: HTMLElement;
    ambItens: HTMLElement[]; virg: HTMLElement[]; anelW: HTMLElement; anel: Element; arco: Element; ini: HTMLElement; brilho: HTMLElement;
  };
}

export interface ColunaCena {
  i: number;
  el: HTMLDivElement;
  cab: HTMLElement;
  num: HTMLElement;
  pal: HTMLElement;
  luz: HTMLElement;
  varre: HTMLElement;
  cards: CardCena[];
  n: number;
}

export interface BalaoCena {
  el: HTMLDivElement;
  x: number;
  y: number;
  rot: HTMLElement;
  corpo: HTMLElement;
  rabo: HTMLElement;
  pontos: HTMLElement[];
  pontosBox: HTMLElement;
  pe: HTMLElement;
  checks: HTMLElement;
  palavras: HTMLElement[];
  chaves: HTMLElement[];
}

const sel = <T extends Element = HTMLElement>(raiz: ParentNode, s: string) => raiz.querySelector(s) as T;
const CLASSE_ANEL = { verde: "a-verde", amarelo: "a-amarelo", vermelho: "a-vermelho", fechada: "a-fechada" } as const;
const ambientesHtml = (lista: string[]) => lista.map((a, i) => (i ? '<span class="virg">,&nbsp;</span>' : "") + `<span data-i="${i}">${esc(a)}</span>`).join("");

export function criarCard(mundo: HTMLElement, d: DadosCard): CardCena {
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML =
    `<div class="c1"><span class="av-wrap"><span class="av" style="--av:var(--color-avatar-${d.cor % 6})"><span class="av-t">${esc(iniciais(d.nome))}</span></span>` +
    `<span class="selo">${icone("bot", "s-bot")}${icone("headset", "s-hum")}</span></span>` +
    `<p class="nome"><span class="nome-t">${esc(d.nome)}</span></p><span class="hora">${esc(d.hora)}</span></div>` +
    `<p class="faixa"><span class="fc"></span></p>` +
    `<p class="previa">${esc(d.previa)}</p>` +
    `<p class="det"><span class="cid">${icone("mapPin")}<span class="cid-t">${esc(d.cidade)}</span></span><span class="amb">${icone("layoutGrid")}<span class="amb-t">${ambientesHtml(d.ambientes)}</span></span></p>` +
    `<div class="rod"><span class="anel-w"><svg class="anel" viewBox="0 0 24 24"><circle class="trilho" cx="12" cy="12" r="9"/><circle class="arco" cx="12" cy="12" r="9" stroke-dasharray="${CIRC.toFixed(2)}" stroke-dashoffset="0"/></svg></span>` +
    `<span class="ini">${d.consultor ? esc(iniciais(d.consultor)) : ""}</span></div><span class="brilho"></span>`;
  const c: CardCena = {
    el, d, col: 0, h: 0, heroi: false, noQuadro: true, incl: 0, vx: 0, xAnt: 0, sombra: null, esq: {},
    q: {
      av: sel(el, ".av"), avT: sel(el, ".av-t"), selo: sel(el, ".selo"), sBot: sel(el, ".s-bot"), sHum: sel(el, ".s-hum"), nomeT: sel(el, ".nome-t"),
      faixa: sel(el, ".faixa"), fc: sel(el, ".fc"), previa: sel(el, ".previa"), cid: sel(el, ".cid"), cidT: sel(el, ".cid-t"), amb: sel(el, ".amb"),
      ambItens: [...el.querySelectorAll<HTMLElement>(".amb-t [data-i]")], virg: [...el.querySelectorAll<HTMLElement>(".virg")],
      anelW: sel(el, ".anel-w"), anel: sel(el, ".anel"), arco: sel(el, ".arco"), ini: sel(el, ".ini"), brilho: sel(el, ".brilho"),
    },
  };
  pintarFaixa(c, d.faixa);
  pintarAnel(c, d.anel);
  gsap.set(d.modo === "bot" ? c.q.sHum : c.q.sBot, { autoAlpha: 0 });
  if (!d.consultor) gsap.set(c.q.ini, { autoAlpha: 0 });
  mundo.appendChild(el);
  gsap.set(el, { z: Z_CARD });
  return c;
}

/** A faixa de ação (uma por card, sempre no mesmo lugar). Nula some, como em Fechado e Perdido. */
export function pintarFaixa(c: CardCena, f: Faixa | null) {
  c.q.faixa.className = "faixa" + (f ? " f-" + f.cor : "");
  c.q.fc.innerHTML = f ? icone(ICONE_DA_ACAO[f.codigo]) + `<span>${esc(f.texto)}</span>` : "";
  c.q.faixa.style.display = f ? "" : "none";
}

export function pintarAnel(c: CardCena, anel: DadosCard["anel"]) {
  if (!anel) {
    gsap.set(c.q.anelW, { autoAlpha: 0 });
    return;
  }
  c.q.anel.setAttribute("class", "anel " + CLASSE_ANEL[anel.faixa]);
  c.q.arco.setAttribute("stroke-dashoffset", (CIRC * (1 - anel.fracao)).toFixed(2));
}

export function criarColuna(mundo: HTMLElement, i: number, x: number): ColunaCena {
  const e = ETAPAS[i];
  const el = document.createElement("div");
  el.className = "coluna" + (e.codigo === "apresentacao" ? " destaque" : "");
  el.style.setProperty("--cor", `var(--color-etapa-${e.codigo})`);
  el.innerHTML =
    `<span class="luz"></span><span class="varre"></span><div class="cab"><p class="tit">${esc(e.nome)}</p>` +
    `<p class="qtd"><span class="num"><span>0</span></span><span class="pal">conversas</span></p><div class="barra"></div></div>`;
  mundo.appendChild(el);
  gsap.set(el, { x, y: 0 });
  return { i, el, cab: sel(el, ".cab"), num: sel(el, ".num"), pal: sel(el, ".pal"), luz: sel(el, ".luz"), varre: sel(el, ".varre"), cards: [], n: 0 };
}

/** O balão da mensagem do cliente: cada palavra num `.w` (entra uma a uma); o que o assistente extrai vira `.kw`. */
export function criarBalao(mundo: HTMLElement, cli: Cliente, hora: string): BalaoCena {
  const texto = palavrasDoTexto(cli.texto)
    .map((w) => '<span class="w">' + w.map((s) => (s.campo ? `<span class="kw" data-campo="${esc(s.campo)}">${esc(s.txt)}</span>` : esc(s.txt))).join("") + "</span>")
    .join(" ");
  const el = document.createElement("div");
  el.className = "balao";
  el.innerHTML =
    `<p class="rot"><i></i>WhatsApp · agora</p><div class="corpo"><span class="rabo"></span>` +
    `<div class="pontos"><span></span><span></span><span></span></div><p class="texto">${texto}</p>` +
    `<div class="pe"><span>${esc(hora)}</span><span class="checks">${icone("checkCheck")}</span></div></div>`;
  mundo.appendChild(el);
  gsap.set(el, { z: Z_TOPO });
  return {
    el, x: 0, y: 0, rot: sel(el, ".rot"), corpo: sel(el, ".corpo"), rabo: sel(el, ".rabo"),
    pontos: [...el.querySelectorAll<HTMLElement>(".pontos span")], pontosBox: sel(el, ".pontos"), pe: sel(el, ".pe"), checks: sel(el, ".checks"),
    palavras: [...el.querySelectorAll<HTMLElement>(".w")], chaves: [...el.querySelectorAll<HTMLElement>(".kw")],
  };
}

/** Posição de layout de `el` dentro de `ate` (soma dos offsets; não depende da câmera). */
export function posEm(el: HTMLElement, ate: Element) {
  let x = 0, y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== ate) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** Posição de `el` no mundo da cena: layout dentro do card/balão + a posição dele no mundo. */
export function posNoMundo(mundo: HTMLElement, el: HTMLElement) {
  let raiz: HTMLElement = el;
  while (raiz.parentElement && raiz.parentElement !== mundo) raiz = raiz.parentElement;
  const p = posEm(el, raiz);
  return { x: p.x + Number(gsap.getProperty(raiz, "x")), y: p.y + Number(gsap.getProperty(raiz, "y")), w: p.w, h: p.h };
}

/** Card nascendo vazio: tudo o que o assistente vai preencher fica escondido, com o esqueleto por cima (layout já final). */
export function esvaziar(c: CardCena) {
  const q = c.q;
  const barra = (el: HTMLElement, { w, h, raio }: { w?: number; h?: number; raio?: string } = {}) => {
    const p = posEm(el, c.el), hh = h ?? Math.max(10, Math.round(p.h * 0.56));
    const e = document.createElement("span");
    e.className = "esq";
    Object.assign(e.style, { left: p.x + "px", top: p.y + (p.h - hh) / 2 + "px", width: (w ?? p.w) + "px", height: hh + "px" });
    if (raio) e.style.borderRadius = raio;
    c.el.appendChild(e);
    return e;
  };
  q.av.classList.add("vazio");
  gsap.set(q.avT, { autoAlpha: 0, scale: 0.5 });
  gsap.set([q.selo, q.sBot, q.sHum], { autoAlpha: 0 });
  c.esq.nome = barra(q.nomeT, { w: 150 });
  gsap.set(q.nomeT, { autoAlpha: 0 });
  q.faixa.classList.add("vazia");
  gsap.set(q.fc, { autoAlpha: 0 });
  c.esq.faixa = barra(q.fc, { w: 132 });
  const pv = posEm(q.previa, c.el), lh = 19.5 * 1.43;
  ([["p1", 300, 0], ["p2", 170, lh]] as const).forEach(([nome, w, dy]) => {
    const e = document.createElement("span");
    e.className = "esq";
    Object.assign(e.style, { left: pv.x + 17 + "px", top: pv.y + 11 + dy + (lh - 12) / 2 + "px", width: w + "px", height: "12px" });
    c.el.appendChild(e);
    c.esq[nome] = e;
  });
  gsap.set(q.previa, { clipPath: "inset(0% 100% 0% 0%)" });
  c.esq.cid = barra(q.cid);
  c.esq.amb = barra(q.amb, { w: Math.min(posEm(q.amb, c.el).w, 160) });
  gsap.set([q.cid, q.amb, ...q.ambItens, ...q.virg], { autoAlpha: 0 });
  gsap.set(q.arco, { attr: { "stroke-dashoffset": CIRC } });
  gsap.set([q.anelW, q.ini], { autoAlpha: 0 });
  gsap.set(q.ini, { scale: 0.4 });
  c.esq.anel = barra(q.anelW, { raio: "50%", h: 22, w: 22 });
}
