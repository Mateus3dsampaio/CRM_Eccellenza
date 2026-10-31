"use client";

import { useSyncExternalStore } from "react";

// Zoom do quadro (só no computador): mais zoom = menos cards na tela, menos zoom = mais cards.
// É uma preferência de cada pessoa neste navegador.
export const NIVEIS_ZOOM = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25] as const;
const CHAVE = "zoom-kanban";
const PADRAO = 1;

let valor: number = PADRAO;
let lido = false;
const ouvintes = new Set<() => void>();

function ler(): number {
  if (!lido) {
    lido = true;
    try {
      const salvo = Number(localStorage.getItem(CHAVE));
      if ((NIVEIS_ZOOM as readonly number[]).includes(salvo)) valor = salvo;
    } catch {
      // Sem armazenamento: usa o padrão.
    }
  }
  return valor;
}

export function definirZoom(novo: number) {
  valor = novo;
  try {
    localStorage.setItem(CHAVE, String(novo));
  } catch {
    // Vale só nesta visita.
  }
  ouvintes.forEach((f) => f());
}

export function useZoomKanban(): number {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    ler,
    () => PADRAO,
  );
}
