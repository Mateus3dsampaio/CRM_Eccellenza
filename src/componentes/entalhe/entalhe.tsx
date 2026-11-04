"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { aberturaDoEntalhe, alturaDoSalto, caminhoDoEntalhe, clamp, molaPasso, progresso, suave, type Orientacao } from "./geometria";

/** Medidas de cada orientação (px). `u` = distância a partir da borda onde o entalhe nasce (negativo = fora da barra). */
const AJUSTES = {
  // Abas na horizontal: a pílula (30 px) fica um pouco para fora da borda de cima, dentro do entalhe.
  horizontal: { u0: -9, u1: 21, folga: 5, margem: 12, raio: 14, salto: 9 },
  // Menu na vertical: a pílula ocupa a linha inteira do item; o entalhe abre pela borda da direita.
  vertical: { u0: 0, u1: 0, folga: 5, margem: 6, raio: 12, salto: 10 },
  // Barra de baixo do celular (modelo da referência): bolinha de 40 px que sai de um entalhe redondo.
  bola: { u0: -17, u1: 23, folga: 4, margem: 8, raio: 30, salto: 14, comprimento: 40 },
} as const;

interface Ajuste {
  u0: number;
  u1: number;
  folga: number;
  margem: number;
  raio: number;
  salto: number;
  comprimento?: number;
}

const RIGIDEZ = 210;
const AMORTECIMENTO = 17;

interface Medida {
  c: number; // centro ao longo da barra
  l: number; // comprimento ao longo da barra
  u0: number;
  u1: number;
}

interface Props {
  /** Elemento (position: relative) que contém os itens e este desenho. */
  raiz: RefObject<HTMLElement | null>;
  /** Os itens (botões ou links), na ordem. */
  itens: RefObject<(HTMLElement | null)[]>;
  /** Item selecionado; -1 esconde tudo. */
  indice: number;
  orientacao: Orientacao;
  /** `bola`: pílula redonda só com ícone, entalhe redondo (barra de baixo do celular). Só na horizontal. */
  variante?: "bola";
  /** Quando o item tem `[data-icone]`, só ele some sob a pílula (o texto do item fica). */
  soIcone?: boolean;
  /** Horizontal: px do topo de `raiz` até a borda de cima da barra (espaço para a pílula subir). */
  borda?: number;
  /** O que vai escrito dentro da pílula (o item que ela está carregando). */
  conteudo: (i: number) => ReactNode;
  classePilula?: string;
  /** Cor do que aparece atrás da barra (o que o entalhe revela). */
  fundo?: string;
}

/**
 * Entalhe flutuante: a pílula sai do entalhe, salta por cima da barra e pousa no item novo, onde o entalhe se abre de novo.
 * Desenha por cima dos itens (sem capturar clique) e anima direto no DOM, sem re-renderizar a tela a cada quadro.
 */
export function Entalhe({ raiz, itens, indice, orientacao, variante, soIcone, borda = 0, conteudo, classePilula, fundo = "var(--color-fundo)" }: Props) {
  const vertical = orientacao === "vertical";
  const ajuste: Ajuste = AJUSTES[variante ?? orientacao];
  const svgRef = useRef<SVGSVGElement>(null);
  const preencherRef = useRef<SVGPathElement>(null);
  const linhaRef = useRef<SVGPathElement>(null);
  const pilulaRef = useRef<HTMLDivElement>(null);
  const [naPilula, setNaPilula] = useState(Math.max(indice, 0));

  // Tudo que muda a cada quadro fica aqui, fora do React.
  const e = useRef({
    c: { x: 0, v: 0 },
    l: { x: 0, v: 0 },
    c0: 0,
    c1: 0,
    l1: 0,
    ativo: indice,
    naPilula: Math.max(indice, 0),
    medidas: [] as (Medida | null)[],
    largura: 0,
    altura: 0,
    quadro: 0,
    ultimo: 0,
    pronto: false,
    calmo: false,
  });
  // Sempre a versão mais nova das props, para o laço de animação não ficar com valores velhos.
  const props = useRef({ vertical, ajuste, borda, orientacao });
  const soIconeRef = useRef(!!soIcone);
  const irParaRef = useRef<(i: number) => void>(() => {});
  const medirRef = useRef<() => void>(() => {});

  useEffect(() => {
    const est = e.current;
    const { orientacao: o } = props.current;

    function limparItens() {
      itens.current.forEach((el) => {
        if (!el) return;
        el.style.opacity = "";
        const icone = el.querySelector<HTMLElement>("[data-icone]");
        if (icone) icone.style.opacity = "";
      });
    }

    function desenhar() {
      const { vertical: v, ajuste: aj, borda: b } = props.current;
      const m = est.medidas[est.ativo];
      const pilula = pilulaRef.current;
      if (!pilula || !m || est.ativo < 0) {
        if (pilula) pilula.style.opacity = "0";
        if (preencherRef.current) preencherRef.current.setAttribute("d", "");
        if (linhaRef.current) linhaRef.current.setAttribute("d", "");
        limparItens();
        return;
      }
      const prog = progresso(est.c.x, est.c0, est.c1);
      const salto = alturaDoSalto(prog, aj.salto);
      const abertura = aberturaDoEntalhe(salto, aj.salto);
      if (prog >= 0.5 && est.naPilula !== est.ativo) {
        est.naPilula = est.ativo;
        setNaPilula(est.ativo);
      }
      const borda = v ? est.largura : b;
      const comp = Math.max(aj.comprimento ?? est.l.x, 1);
      const profundidade = (m.u1 + aj.folga) * abertura;
      const { preencher, linha } = caminhoDoEntalhe(o, borda, est.c.x, comp / 2 + aj.margem, profundidade, aj.raio);
      preencherRef.current?.setAttribute("d", preencher);
      linhaRef.current?.setAttribute("d", linha);
      const svg = svgRef.current;
      if (svg) {
        svg.setAttribute("width", String(est.largura));
        svg.setAttribute("height", String(est.altura));
      }
      // Pílula: ao longo da barra vai com a mola; para a borda ela salta.
      const espessura = m.u1 - m.u0;
      const estilo = pilula.style;
      estilo.opacity = "1";
      if (v) {
        estilo.width = `${espessura}px`;
        estilo.height = `${comp}px`;
        estilo.transform = `translate(${(borda - m.u1 + salto).toFixed(2)}px,${(est.c.x - comp / 2).toFixed(2)}px)`;
      } else {
        estilo.width = `${comp}px`;
        estilo.height = `${espessura}px`;
        estilo.transform = `translate(${(est.c.x - comp / 2).toFixed(2)}px,${(borda + m.u0 - salto).toFixed(2)}px)`;
      }
      // Os itens que a pílula cobre somem enquanto ela passa (sem texto duplicado).
      const ini = est.c.x - comp / 2;
      const fim = est.c.x + comp / 2;
      est.medidas.forEach((md, i) => {
        const el = itens.current[i];
        if (!el || !md) return;
        const a = md.c - md.l / 2;
        const sobra = Math.max(0, Math.min(fim, a + md.l) - Math.max(ini, a));
        const alvo = soIconeRef.current ? (el.querySelector<HTMLElement>("[data-icone]") ?? el) : el;
        alvo.style.opacity = (1 - suave(0.1, 0.6, sobra / md.l)).toFixed(3);
      });
    }

    const passo = (agora: number) => {
      const dt = clamp((agora - est.ultimo) / 1000, 0, 1 / 30);
      est.ultimo = agora;
      molaPasso(est.c, est.c1, dt, RIGIDEZ, AMORTECIMENTO);
      molaPasso(est.l, est.l1, dt, 260, 24);
      const fim = Math.abs(est.c.v) < 2 && Math.abs(est.c.x - est.c1) < 0.3 && Math.abs(est.l.v) < 2 && Math.abs(est.l.x - est.l1) < 0.3;
      if (fim) {
        est.c.x = est.c0 = est.c1;
        est.l.x = est.l1;
        est.c.v = est.l.v = 0;
        est.quadro = 0;
      } else {
        est.quadro = requestAnimationFrame(passo);
      }
      desenhar();
    };

    function acordar() {
      if (!est.quadro) {
        est.ultimo = performance.now();
        est.quadro = requestAnimationFrame(passo);
      }
    }

    function medir() {
      const r = raiz.current;
      if (!r) return;
      const { vertical: v, ajuste: aj } = props.current;
      const caixa = r.getBoundingClientRect();
      est.largura = r.clientWidth;
      est.altura = r.clientHeight;
      est.medidas = itens.current.map((el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        if (v) return { c: b.top - caixa.top + b.height / 2, l: b.height, u0: est.largura - (b.right - caixa.left), u1: est.largura - (b.left - caixa.left) };
        return { c: b.left - caixa.left + b.width / 2, l: b.width, u0: aj.u0, u1: aj.u1 };
      });
      const alvo = est.medidas[est.ativo];
      if (!alvo) {
        desenhar();
        return;
      }
      est.c1 = alvo.c;
      est.l1 = alvo.l;
      if (!est.quadro) {
        // Parado: só acompanha o tamanho da tela (sem animar).
        est.c.x = est.c0 = alvo.c;
        est.l.x = alvo.l;
        est.c.v = est.l.v = 0;
      }
      if (!est.pronto) {
        est.pronto = true;
        est.naPilula = est.ativo;
        setNaPilula(est.ativo);
      }
      desenhar();
    }

    est.calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    medir();
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    if (raiz.current) obs?.observe(raiz.current);
    document.fonts?.ready.then(medir);
    window.addEventListener("resize", medir);

    // Troca de item: chamada pelo efeito logo abaixo.
    irParaRef.current = (novo: number) => {
      if (novo === est.ativo) return;
      est.c0 = est.c.x;
      est.ativo = novo;
      const alvo = est.medidas[novo];
      if (!alvo) {
        desenhar();
        return;
      }
      est.c1 = alvo.c;
      est.l1 = alvo.l;
      if (est.calmo || !est.pronto) {
        est.c.x = est.c0 = alvo.c;
        est.l.x = alvo.l;
        est.naPilula = novo;
        setNaPilula(novo);
        desenhar();
      } else {
        acordar();
      }
    };
    medirRef.current = medir;

    return () => {
      obs?.disconnect();
      limparItens();
      window.removeEventListener("resize", medir);
      if (est.quadro) cancelAnimationFrame(est.quadro);
      est.quadro = 0;
    };
    // O desenho é montado uma vez; as props mudam por `props`, `irParaRef` e `medirRef`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Novo item selecionado: a pílula viaja até ele.
  useEffect(() => {
    irParaRef.current(indice);
  }, [indice]);

  // Texto, contagem ou largura dos itens mudaram: mede de novo (só acompanha, não anima).
  useLayoutEffect(() => {
    props.current = { vertical, ajuste, borda, orientacao };
    soIconeRef.current = !!soIcone;
    medirRef.current();
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      <svg ref={svgRef} className="absolute left-0 top-0 overflow-visible">
        <path ref={preencherRef} fill={fundo} />
        <path ref={linhaRef} fill="none" stroke="var(--color-borda)" strokeWidth={1} />
      </svg>
      <div
        ref={pilulaRef}
        className={classePilula}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          opacity: 0,
          overflow: "hidden",
          borderRadius: variante === "bola" ? "50%" : "var(--radius-controle)",
          background: "linear-gradient(180deg, var(--color-marca-forte), var(--color-marca))",
          boxShadow: "0 3px 0 var(--color-marca-lado), 0 8px 14px rgb(63 116 236 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.3)",
          color: "var(--color-sobre-marca)",
          willChange: "transform",
        }}
      >
        {conteudo(naPilula)}
      </div>
    </div>
  );
}
