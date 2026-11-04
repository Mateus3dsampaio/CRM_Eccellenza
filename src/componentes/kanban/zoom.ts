"use client";

import { useSyncExternalStore } from "react";

// Zoom do quadro (só no computador): mais zoom = menos cards na tela, menos zoom = mais cards.
// É uma preferência de cada pessoa neste navegador. "auto" (padrão, tarefa 24) ajusta o zoom para
// todas as colunas abertas caberem na tela, até o limite de ZOOM_AUTO_MINIMO; abaixo disso rola.
export const NIVEIS_ZOOM = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25] as const;
export const ZOOM_AUTO_MINIMO = 0.75;
export type Zoom = number | "auto";
const CHAVE = "zoom-kanban";
const PADRAO: Zoom = "auto";

let valor: Zoom = PADRAO;
let lido = false;
const ouvintes = new Set<() => void>();

function ler(): Zoom {
  if (!lido) {
    lido = true;
    try {
      const salvo = localStorage.getItem(CHAVE);
      const numero = Number(salvo);
      if (salvo === "auto") valor = "auto";
      else if ((NIVEIS_ZOOM as readonly number[]).includes(numero)) valor = numero;
    } catch {
      // Sem armazenamento: usa o padrão.
    }
  }
  return valor;
}

export function definirZoom(novo: Zoom) {
  valor = novo;
  try {
    localStorage.setItem(CHAVE, String(novo));
  } catch {
    // Vale só nesta visita.
  }
  ouvintes.forEach((f) => f());
}

export function useZoomKanban(): Zoom {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    ler,
    () => PADRAO,
  );
}

/** Zoom que faz `necessario` px caberem em `disponivel` px, entre o mínimo automático e 100%. */
export function zoomParaCaber(disponivel: number, necessario: number): number {
  if (disponivel <= 0 || necessario <= 0) return 1;
  const bruto = Math.min(1, disponivel / necessario);
  // Duas casas: evita o zoom "tremer" com diferenças de fração de pixel.
  return Math.max(ZOOM_AUTO_MINIMO, Math.floor(bruto * 100) / 100);
}
