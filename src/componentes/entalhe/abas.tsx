"use client";

import { useEffect, useRef, useState } from "react";
import { juntar } from "../estilos";
import { Pilula } from "./pilula";

export interface ItemAba<T extends string> {
  codigo: T;
  rotulo: string;
}

interface Props<T extends string> {
  itens: readonly ItemAba<T>[];
  /** `null`: nenhuma aba escolhida (a pílula some). */
  valor: T | null;
  aoMudar: (codigo: T) => void;
  rotuloAria: string;
  className?: string;
}

/**
 * Abas com a pílula elástica de vidro escuro (padrão do sistema para qualquer escolha de abas ou filtro de uma opção só).
 * Use no lugar de botões `role="tab"` soltos.
 */
export function Abas<T extends string>({ itens, valor, aoMudar, rotuloAria, className }: Props<T>) {
  const raiz = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLElement | null)[]>([]);
  const indice = itens.findIndex((i) => i.codigo === valor);
  const rolagem = useRef<HTMLDivElement>(null);
  // Em tela estreita a barra rola de lado: os degradês nas pontas mostram que tem mais abas para o lado.
  const [pontas, setPontas] = useState({ esquerda: false, direita: false });

  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const ler = () => {
      const esquerda = el.scrollLeft > 2;
      const direita = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setPontas((p) => (p.esquerda === esquerda && p.direita === direita ? p : { esquerda, direita }));
    };
    ler();
    el.addEventListener("scroll", ler, { passive: true });
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(ler) : null;
    obs?.observe(el);
    if (raiz.current) obs?.observe(raiz.current);
    return () => {
      el.removeEventListener("scroll", ler);
      obs?.disconnect();
    };
  }, []);

  // A aba escolhida fica à vista (no celular a barra é mais larga que a tela).
  useEffect(() => {
    const el = rolagem.current;
    const aba = botoes.current[indice];
    if (!el || !aba) return;
    const alvo = aba.offsetLeft - (el.clientWidth - aba.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, alvo), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [indice]);

  const mascara = `linear-gradient(to right, ${pontas.esquerda ? "transparent, #000 28px" : "#000, #000 0"}, ${pontas.direita ? "#000 calc(100% - 28px), transparent" : "#000 100%, #000"})`;

  return (
    // Fora da barra: rola de lado em tela estreita.
    <div ref={rolagem} className={juntar("rolagem-fina max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} style={{ maskImage: mascara, WebkitMaskImage: mascara, touchAction: "pan-x pan-y" }}>
      <div
        ref={raiz}
        role="tablist"
        aria-label={rotuloAria}
        className="relative flex w-max min-w-full rounded-controle px-1.5"
        style={{
          background: "rgb(255 255 255 / 0.035)",
          border: "1px solid rgb(255 255 255 / 0.08)",
          boxShadow: "inset 0 1px 3px rgb(0 0 0 / 0.5), 0 1px 0 rgb(255 255 255 / 0.04)",
        }}
      >
        <Pilula raiz={raiz} itens={botoes} indice={indice} />
        {itens.map((item, i) => (
          <button
            key={item.codigo}
            ref={(el) => {
              botoes.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={item.codigo === valor}
            onClick={() => aoMudar(item.codigo)}
            className={juntar("relative min-h-toque shrink-0 whitespace-nowrap px-4 text-sm font-medium transition-colors duration-200", item.codigo === valor ? "text-texto" : "text-texto-suave hover:text-texto")}
          >
            {item.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
