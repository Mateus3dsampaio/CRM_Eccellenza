"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { ALTURA_BOJO, MEIA_BASE_BOJO, alturaDoBojoEm, clamp, contornoDaBarra, esticarBojo, molaPasso } from "./geometria";

interface Props {
  /** Elemento (position: relative) que contém os itens e este desenho. */
  raiz: RefObject<HTMLElement | null>;
  /** As abas, na ordem. */
  itens: RefObject<(HTMLElement | null)[]>;
  /** Aba escolhida; -1 deixa a barra reta, sem bojo. */
  indice: number;
  /** px do topo de `raiz` até a borda de cima da barra (espaço onde o bojo sobe). */
  topo: number;
  raioBarra?: number;
}

/**
 * Bojo líquido: a barra é colorida e tem uma cúpula sobre a aba ativa. Ao trocar de aba a cúpula estica, escorre pelo topo
 * levantando os textos do caminho e se junta na aba nova. Anima direto no DOM (sem re-renderizar a tela a cada quadro).
 * Desenha a barra inteira por trás dos itens; os itens precisam ter fundo transparente e texto claro.
 */
export function Bojo({ raiz, itens, indice, topo, raioBarra = 12 }: Props) {
  const idGrad = `bojo-${useId().replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const caminhoRef = useRef<SVGPathElement>(null);
  const gradienteRef = useRef<SVGLinearGradientElement>(null);
  const irParaRef = useRef<(i: number) => void>(() => {});
  const medirRef = useRef<() => void>(() => {});
  const props = useRef({ topo, raioBarra });

  useEffect(() => {
    const est = {
      c: { x: 0, v: 0 },
      l: { x: 0, v: 0 },
      c1: 0,
      l1: 0,
      ativo: indice,
      medidas: [] as ({ c: number; l: number } | null)[],
      largura: 0,
      altura: 0,
      quadro: 0,
      ultimo: 0,
      calmo: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };

    function limpar() {
      itens.current.forEach((el) => {
        if (!el) return;
        el.style.transform = "";
        el.style.opacity = "";
      });
    }

    function desenhar() {
      const { topo: t, raioBarra: r } = props.current;
      const svg = svgRef.current;
      const caminho = caminhoRef.current;
      if (!svg || !caminho) return;
      svg.setAttribute("width", String(est.largura));
      svg.setAttribute("height", String(est.altura));
      gradienteRef.current?.setAttribute("x2", String(est.largura));
      const tem = est.ativo >= 0 && !!est.medidas[est.ativo];
      const plato = Math.max(0, est.l.x / 2 - 20);
      const forma = esticarBojo(est.c.v);
      const bojo = (x: number) => (tem ? alturaDoBojoEm(x, est.c.x, plato, forma) : 0);
      const meiaE = plato + MEIA_BASE_BOJO * forma.sxl + 2;
      const meiaD = plato + MEIA_BASE_BOJO * forma.sxr + 2;
      caminho.setAttribute("d", contornoDaBarra(est.largura, t, est.altura, r, bojo, tem ? [est.c.x - meiaE, est.c.x + meiaD] : undefined));
      // Os textos sob o bojo sobem e crescem um pouco; os outros ficam mais apagados.
      est.medidas.forEach((m, i) => {
        const el = itens.current[i];
        if (!el || !m) return;
        const p = bojo(m.c) / ALTURA_BOJO;
        const q = Math.min(1, p);
        el.style.transform = `translateY(${(-p * 13).toFixed(2)}px) scale(${(1 + 0.12 * q).toFixed(3)})`;
        el.style.opacity = (0.72 + 0.28 * q).toFixed(3);
      });
    }

    const passo = (agora: number) => {
      const dt = clamp((agora - est.ultimo) / 1000, 0, 1 / 30);
      est.ultimo = agora;
      molaPasso(est.c, est.c1, dt, 170, 19);
      molaPasso(est.l, est.l1, dt, 260, 24);
      const fim = Math.abs(est.c.v) < 2 && Math.abs(est.c.x - est.c1) < 0.3 && Math.abs(est.l.v) < 2 && Math.abs(est.l.x - est.l1) < 0.3;
      if (fim) {
        est.c.x = est.c1;
        est.l.x = est.l1;
        est.c.v = est.l.v = 0;
        est.quadro = 0;
      } else {
        est.quadro = requestAnimationFrame(passo);
      }
      desenhar();
    };

    function medir() {
      const r = raiz.current;
      if (!r) return;
      const caixa = r.getBoundingClientRect();
      est.largura = r.clientWidth;
      est.altura = r.clientHeight;
      est.medidas = itens.current.map((el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { c: b.left - caixa.left + b.width / 2, l: b.width };
      });
      const alvo = est.medidas[est.ativo];
      if (alvo) {
        est.c1 = alvo.c;
        est.l1 = alvo.l;
        if (!est.quadro) {
          est.c.x = alvo.c;
          est.l.x = alvo.l;
          est.c.v = est.l.v = 0;
        }
      }
      desenhar();
    }

    irParaRef.current = (novo) => {
      if (novo === est.ativo) return;
      const antes = est.ativo;
      est.ativo = novo;
      const alvo = est.medidas[novo];
      if (!alvo) {
        desenhar();
        return;
      }
      est.c1 = alvo.c;
      est.l1 = alvo.l;
      if (est.calmo || antes < 0) {
        est.c.x = alvo.c;
        est.l.x = alvo.l;
        est.c.v = est.l.v = 0;
        desenhar();
      } else if (!est.quadro) {
        est.ultimo = performance.now();
        est.quadro = requestAnimationFrame(passo);
      }
    };
    medirRef.current = medir;

    medir();
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    if (raiz.current) obs?.observe(raiz.current);
    document.fonts?.ready.then(medir);
    return () => {
      obs?.disconnect();
      if (est.quadro) cancelAnimationFrame(est.quadro);
      limpar();
    };
    // Montado uma vez; o que muda entra por `props`, `irParaRef` e `medirRef`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    irParaRef.current(indice);
  }, [indice]);

  // Texto ou largura das abas mudou: mede de novo (só acompanha, sem animar). Passivo de propósito: os itens vêm depois deste
  // componente e só têm as referências prontas ao fim da montagem.
  useEffect(() => {
    props.current = { topo, raioBarra };
    medirRef.current();
  });

  return (
    <svg ref={svgRef} aria-hidden className="pointer-events-none absolute left-0 top-0 overflow-visible" style={{ filter: "drop-shadow(0 6px 14px rgb(63 116 236 / 0.4))" }}>
      <defs>
        <linearGradient ref={gradienteRef} id={idGrad} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0">
          <stop offset="0" stopColor="var(--color-marca)" />
          <stop offset="1" stopColor="var(--color-marca-forte)" />
        </linearGradient>
      </defs>
      <path ref={caminhoRef} fill={`url(#${idGrad})`} />
    </svg>
  );
}
