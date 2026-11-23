"use client";
/* eslint-disable react-hooks/refs -- falso alarme com Floating UI: `refs.setReference`/`setFloating` são funções de callback (ref callback), não leitura de `.current` durante a renderização. */

import { useState, type MouseEventHandler, type ReactNode } from "react";
import { Info } from "lucide-react";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  useTransitionStyles,
} from "@floating-ui/react";
import { juntar } from "./estilos";

// Balão de explicação (Floating UI: posiciona sem sair da tela e cuida de mouse, toque e teclado).
// PC: abre com o mouse parado 0,6 s em cima (decisão do Mateus 23/11/2026) ou ao clicar no ⓘ.
// Celular/iPhone: abre e fecha tocando no ⓘ; tocar fora fecha. Teclado: abre ao focar o ⓘ; Esc fecha.

/** Tempo com o mouse parado antes de abrir (decisão do Mateus 23/11/2026). */
export const ATRASO_DICA_MS = 600;

function useDica() {
  const [aberta, setAberta] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: aberta,
    onOpenChange: setAberta,
    placement: "bottom",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      // Nunca mais largo que a tela (iPhone): 18 rem ou a largura disponível.
      size({ padding: 8, apply: ({ availableWidth, elements }) => { elements.floating.style.maxWidth = `${Math.min(288, availableWidth)}px`; } }),
    ],
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    // mouseOnly: no toque quem abre é o clique; sem isso o iPhone abriria duas vezes.
    useHover(context, { mouseOnly: true, delay: { open: ATRASO_DICA_MS, close: 120 }, handleClose: safePolygon() }),
    useFocus(context, { visibleOnly: true }),
    useClick(context, { ignoreMouse: false }),
    useDismiss(context),
    useRole(context, { role: "tooltip" }),
  ]);
  const { isMounted, styles } = useTransitionStyles(context, {
    duration: 160,
    initial: { opacity: 0, transform: "translateY(-4px) scale(0.98)" },
  });
  return { refs, floatingStyles, getReferenceProps, getFloatingProps, isMounted, styles };
}

function Balao({ dica, texto, children }: { dica: ReturnType<typeof useDica>; texto: string; children?: ReactNode }) {
  if (!dica.isMounted) return null;
  return (
    <FloatingPortal>
      <div ref={dica.refs.setFloating} style={dica.floatingStyles} className="z-[60]" {...dica.getFloatingProps()}>
        <div style={dica.styles} className="w-72 max-w-full rounded-controle border border-borda bg-superficie p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-texto shadow-flutuante">
          {texto}
          {children}
        </div>
      </div>
    </FloatingPortal>
  );
}

const CLASSE_ICONE = "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-texto-fraco hover:bg-superficie-suave hover:text-texto focus:outline-none focus-visible:ring-2 focus-visible:ring-marca/40";

/** Ícone ⓘ com explicação: abre com o mouse parado em cima, ao focar com o teclado ou ao tocar. */
export function Dica({ texto, children, rotulo = "Mais informações" }: { texto: string; children?: ReactNode; rotulo?: string; /** Mantido por compatibilidade: o balão já se ajusta sozinho às bordas da tela. */ lado?: "centro" | "direita" }) {
  const dica = useDica();
  return (
    <>
      <button type="button" ref={dica.refs.setReference} aria-label={rotulo} className={CLASSE_ICONE} {...dica.getReferenceProps()}>
        <Info className="size-4" aria-hidden />
      </button>
      <Balao dica={dica} texto={texto}>
        {children}
      </Balao>
    </>
  );
}

/**
 * Título de um número com a explicação do que ele conta. No PC o mouse parado em cima do título ou do ⓘ abre;
 * no iPhone, tocar no ⓘ. Sem texto, mostra só o título.
 */
export function TituloComDica({ titulo, dica: texto, className, como: Tag = "p" }: { titulo: ReactNode; dica: string; className?: string; /** "span" dentro de um título (h2), onde <p> não pode. */ como?: "p" | "span" }) {
  const dica = useDica();
  const { onClick, ...semClique } = dica.getReferenceProps() as Record<string, unknown> & { onClick?: unknown };
  if (!texto) return <Tag className={className}>{titulo}</Tag>;
  return (
    <Tag className={juntar("flex items-start gap-0.5", className)}>
      {/* A área do mouse é o título inteiro; o toque e o clique ficam no ⓘ (pedido do Mateus para o iPhone). */}
      <span ref={dica.refs.setReference} className="-my-1 inline-flex min-w-0 items-center gap-0.5" {...semClique}>
        <span className="min-w-0">{titulo}</span>
        <button type="button" aria-label={`O que é: ${typeof titulo === "string" ? titulo : "este número"}`} className={juntar(CLASSE_ICONE, "-mr-1 size-6")} onClick={onClick as MouseEventHandler<HTMLButtonElement>}>
          <Info className="size-3.5" aria-hidden />
        </button>
      </span>
      <Balao dica={dica} texto={texto} />
    </Tag>
  );
}
