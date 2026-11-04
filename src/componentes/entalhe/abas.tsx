"use client";

import { useRef } from "react";
import { juntar } from "../estilos";
import { ALTURA_BOJO } from "./geometria";
import { Bojo } from "./bojo";

/** Espaço acima da barra por onde o bojo sobe. Cancelado com margem negativa: não empurra o layout. */
const ESPACO_TOPO = ALTURA_BOJO + 4;
/** Espaço dos lados e de baixo para a sombra não ser cortada. */
const ESPACO_SOMBRA = 22;

export interface ItemAba<T extends string> {
  codigo: T;
  rotulo: string;
}

interface Props<T extends string> {
  itens: readonly ItemAba<T>[];
  /** `null`: nenhuma aba escolhida (a barra fica reta). */
  valor: T | null;
  aoMudar: (codigo: T) => void;
  rotuloAria: string;
  className?: string;
}

/**
 * Abas com o bojo líquido (padrão do sistema para qualquer escolha de abas ou filtro de uma opção só).
 * Use no lugar de botões `role="tab"` soltos.
 */
export function Abas<T extends string>({ itens, valor, aoMudar, rotuloAria, className }: Props<T>) {
  const raiz = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLElement | null)[]>([]);
  const indice = itens.findIndex((i) => i.codigo === valor);

  return (
    // Fora da barra: rola de lado em tela estreita, sem cortar a sombra nem o bojo.
    <div
      className={juntar("rolagem-fina pointer-events-none max-w-full overflow-x-auto", className)}
      style={{ margin: `${-ESPACO_TOPO}px ${-ESPACO_SOMBRA}px ${-ESPACO_SOMBRA}px`, padding: `0 ${ESPACO_SOMBRA}px ${ESPACO_SOMBRA}px` }}
    >
      <div ref={raiz} className="relative w-max min-w-full" style={{ paddingTop: ESPACO_TOPO }}>
        <Bojo raiz={raiz} itens={botoes} indice={indice} topo={ESPACO_TOPO} />
        <div role="tablist" aria-label={rotuloAria} className="pointer-events-auto relative flex px-5">
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
              className="min-h-toque shrink-0 whitespace-nowrap px-4 text-sm font-semibold text-sobre-marca"
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
