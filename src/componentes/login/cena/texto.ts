/**
 * Texto das mensagens fictícias do login. `[palavra|campo]` marca o que o assistente tira da mensagem
 * (campo: "nome", "cidade" ou "amb:N", o N-ésimo ambiente). Só regra de texto, sem tela.
 */
export interface Segmento {
  txt: string;
  campo?: string;
}

const MARCA = /\[([^\]|]+)\|([^\]]+)\]/g;

/** A mensagem como o cliente escreveu (sem as marcas). */
export const textoLimpo = (t: string) => t.replace(MARCA, "$1");

/**
 * Quebra a mensagem em palavras para entrarem uma a uma. Cada palavra é uma lista de pedaços sem espaço;
 * o trecho marcado nunca é quebrado (pode ter espaço, como "quarto de casal") e a pontuação colada fica junto dele.
 */
export function palavrasDoTexto(t: string): Segmento[][] {
  const partes: Segmento[] = [];
  let i = 0;
  for (const m of t.matchAll(MARCA)) {
    if (m.index! > i) partes.push({ txt: t.slice(i, m.index) });
    partes.push({ txt: m[1], campo: m[2] });
    i = m.index! + m[0].length;
  }
  if (i < t.length) partes.push({ txt: t.slice(i) });
  const palavras: Segmento[][] = [];
  let atual: Segmento[] | null = null;
  const fechar = () => {
    if (atual) palavras.push(atual);
    atual = null;
  };
  for (const p of partes) {
    if (p.campo) {
      (atual ??= []).push(p);
      continue;
    }
    for (const ch of p.txt) {
      if (ch === " ") {
        fechar();
        continue;
      }
      atual ??= [];
      const ult: Segmento | undefined = atual[atual.length - 1];
      if (ult && !ult.campo) ult.txt += ch;
      else atual.push({ txt: ch });
    }
  }
  fechar();
  return palavras;
}

export const escaparHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
