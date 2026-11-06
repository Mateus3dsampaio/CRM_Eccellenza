"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { clamp, molaPasso } from "./geometria";

interface Props {
  /** A barra (position: relative) que contém as abas. A pílula é desenhada dentro dela, por trás das abas. */
  raiz: RefObject<HTMLElement | null>;
  /** As abas, na ordem. */
  itens: RefObject<(HTMLElement | null)[]>;
  /** Aba escolhida; -1 esconde a pílula. */
  indice: number;
  /** `vidro` (abas): pílula de vidro escuro entre as abas. `anel` (temas): anel fino em volta do item, que estica ao andar. */
  variante?: "vidro" | "anel" | "marca";
  /** `y`: abas empilhadas (menu vertical); a pílula anda para cima e para baixo. */
  eixo?: "x" | "y";
}

/** Borda da frente chega rápido; a de trás sai um instante depois e passa um pouco do ponto antes de assentar (efeito de mola). */
const FRENTE = { k: 330, c: 28 };
const TRAS = { k: 190, c: 15 };
const ATRASO_TRAS = 0.05; // s

/**
 * Pílula elástica: uma pílula de vidro escuro desliza para a aba escolhida esticando. As duas bordas são molas
 * separadas: ao ir para a direita a borda direita chega primeiro e a esquerda a alcança com um leve estalo.
 * Anima direto no DOM (sem re-renderizar a tela a cada quadro).
 */
export function Pilula({ raiz, itens, indice, variante = "vidro", eixo = "x" }: Props) {
  const vertical = eixo === "y";
  const margem = variante === "anel" ? 5 : 0;
  const pilulaRef = useRef<HTMLDivElement>(null);
  const irParaRef = useRef<(i: number) => void>(() => {});
  const medirRef = useRef<() => void>(() => {});

  useEffect(() => {
    const est = {
      e: { x: 0, v: 0 }, // borda esquerda
      d: { x: 0, v: 0 }, // borda direita
      alvoE: 0,
      alvoD: 0,
      molaE: FRENTE,
      molaD: FRENTE,
      atrasoE: 0,
      atrasoD: 0,
      ativo: indice,
      medidas: [] as ({ e: number; d: number } | null)[],
      quadro: 0,
      ultimo: 0,
      pronto: false,
      calmo: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };

    function desenhar() {
      const el = pilulaRef.current;
      if (!el) return;
      const tem = est.ativo >= 0 && !!est.medidas[est.ativo];
      el.style.opacity = tem && est.pronto ? "1" : "0";
      const tamanho = Math.max(est.d.x - est.e.x, 8);
      if (vertical) {
        el.style.height = `${tamanho.toFixed(2)}px`;
        el.style.transform = `translateY(${est.e.x.toFixed(2)}px)`;
      } else {
        el.style.width = `${tamanho.toFixed(2)}px`;
        el.style.transform = `translateX(${est.e.x.toFixed(2)}px)`;
      }
    }

    const passo = (agora: number) => {
      const dt = clamp((agora - est.ultimo) / 1000, 0, 1 / 30);
      est.ultimo = agora;
      if (est.atrasoE > 0) est.atrasoE -= dt;
      else molaPasso(est.e, est.alvoE, dt, est.molaE.k, est.molaE.c);
      if (est.atrasoD > 0) est.atrasoD -= dt;
      else molaPasso(est.d, est.alvoD, dt, est.molaD.k, est.molaD.c);
      const parado = (b: { x: number; v: number }, alvo: number) => Math.abs(b.v) < 2 && Math.abs(b.x - alvo) < 0.3;
      if (est.atrasoE <= 0 && est.atrasoD <= 0 && parado(est.e, est.alvoE) && parado(est.d, est.alvoD)) {
        est.e.x = est.alvoE;
        est.d.x = est.alvoD;
        est.e.v = est.d.v = 0;
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
      est.medidas = itens.current.map((el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return vertical ? { e: b.top - caixa.top - margem, d: b.bottom - caixa.top + margem } : { e: b.left - caixa.left - margem, d: b.right - caixa.left + margem };
      });
      const alvo = est.medidas[est.ativo];
      if (alvo) {
        est.alvoE = alvo.e;
        est.alvoD = alvo.d;
        if (!est.quadro) {
          est.e.x = alvo.e;
          est.d.x = alvo.d;
          est.e.v = est.d.v = 0;
          est.pronto = true;
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
      est.alvoE = alvo.e;
      est.alvoD = alvo.d;
      if (est.calmo || antes < 0) {
        est.e.x = alvo.e;
        est.d.x = alvo.d;
        est.e.v = est.d.v = 0;
        est.pronto = true;
        desenhar();
        return;
      }
      const paraDireita = alvo.e > est.e.x;
      est.molaD = paraDireita ? FRENTE : TRAS;
      est.molaE = paraDireita ? TRAS : FRENTE;
      est.atrasoD = paraDireita ? 0 : ATRASO_TRAS;
      est.atrasoE = paraDireita ? ATRASO_TRAS : 0;
      if (!est.quadro) {
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
    };
    // Montado uma vez; o que muda entra por `irParaRef` e `medirRef`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    irParaRef.current(indice);
  }, [indice]);

  // Texto ou largura das abas mudou: mede de novo (só acompanha). Passivo de propósito: as abas vêm depois deste componente.
  useEffect(() => {
    medirRef.current();
  });

  return (
    <div
      ref={pilulaRef}
      aria-hidden
      className={juntarClasses("pointer-events-none absolute", vertical ? "inset-x-0 top-0" : "left-0", variante !== "anel" && "rounded-controle")}
      style={vertical ? { ...ESTILO_MARCA, willChange: "transform, height" } : variante === "anel" ? ESTILO_ANEL : variante === "marca" ? ESTILO_MARCA : ESTILO_VIDRO}
    />
  );
}

const juntarClasses = (...c: (string | false)[]) => c.filter(Boolean).join(" ");

/** Pílula da cor da marca, em relevo, igual ao botão "afundado" do sistema. */
const ESTILO_MARCA: CSSProperties = {
  opacity: 0,
  willChange: "transform, width",
  background: "linear-gradient(to bottom, color-mix(in srgb, var(--color-marca) 78%, #000), var(--color-marca) 55%)",
  boxShadow: "var(--shadow-afundado)",
};

const ESTILO_VIDRO: CSSProperties = {
  top: 5,
  bottom: 5,
  opacity: 0,
  willChange: "transform, width",
  // Vidro líquido escuro: reflexo claro em cima, fundo ardósia translúcido, borda fina e sombra funda.
  background: "linear-gradient(180deg, rgb(255 255 255 / 0.2) 0%, rgb(255 255 255 / 0.06) 45%, rgb(255 255 255 / 0.1) 100%), rgb(52 66 86 / 0.7)",
  border: "1px solid rgb(255 255 255 / 0.16)",
  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.38), inset 0 -1px 0 rgb(0 0 0 / 0.35), inset 0 0 14px rgb(255 255 255 / 0.05), 0 3px 6px rgb(0 0 0 / 0.45), 0 1px 2px rgb(0 0 0 / 0.5)",
};

const ESTILO_ANEL: CSSProperties = {
  top: 0,
  bottom: 0,
  opacity: 0,
  willChange: "transform, width",
  borderRadius: 9999,
  border: "2px solid var(--color-marca-texto)",
  boxShadow: "0 0 16px color-mix(in srgb, var(--color-marca) 60%, transparent)",
};
