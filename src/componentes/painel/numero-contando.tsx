"use client";

import { useEffect, useState } from "react";

const DURACAO = 600; // ms

/**
 * Número do Painel que sobe de zero até o valor em 600 ms. Só conta quando nasce com `animar` (a abertura da tela);
 * depois disso, se o valor mudar (filtro, atualização automática), troca direto, sem animação.
 * Com "reduzir movimento" mostra o valor final de uma vez.
 */
export function NumeroContando({ valor, formatar = (n) => n.toLocaleString("pt-BR"), animar }: { valor: number; formatar?: (n: number) => string; animar: boolean }) {
  const [contar] = useState(animar);
  const [mostrado, setMostrado] = useState(contar ? 0 : valor);
  const [terminou, setTerminou] = useState(!contar);

  useEffect(() => {
    if (terminou) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- só no navegador dá para saber a preferência
      setTerminou(true);
      return;
    }
    let quadro = 0;
    let inicio = 0;
    const passo = (agora: number) => {
      inicio ||= agora;
      const t = Math.min(1, (agora - inicio) / DURACAO);
      if (t >= 1) return setTerminou(true);
      setMostrado(Math.round(valor * (1 - Math.pow(1 - t, 3)))); // desacelera no fim
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [terminou, valor]);

  return <>{formatar(terminou ? valor : mostrado)}</>;
}
