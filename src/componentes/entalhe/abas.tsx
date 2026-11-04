"use client";

import { useRef } from "react";
import { juntar } from "../estilos";
import { Entalhe } from "./entalhe";

/** Espaço acima da barra por onde a pílula salta. Cancelado com margem negativa: não empurra o layout. */
const ESPACO_TOPO = 18;
const ESPACO_BAIXO = 10;

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
  /** Cor do que fica atrás da barra, se não for o fundo da tela. */
  fundo?: string;
}

/**
 * Abas com o entalhe flutuante (padrão do sistema para qualquer escolha de abas ou filtro de uma opção só).
 * Use no lugar de botões `role="tab"` soltos.
 */
export function AbasEntalhe<T extends string>({ itens, valor, aoMudar, rotuloAria, className, fundo }: Props<T>) {
  const raiz = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLElement | null)[]>([]);
  const indice = itens.findIndex((i) => i.codigo === valor);

  return (
    // Fora da barra: rola de lado em tela estreita, sem cortar a sombra nem a pílula.
    <div className={juntar("rolagem-fina pointer-events-none max-w-full overflow-x-auto", className)} style={{ marginTop: -ESPACO_TOPO, paddingTop: ESPACO_TOPO, marginBottom: -ESPACO_BAIXO, paddingBottom: ESPACO_BAIXO }}>
      <div ref={raiz} className="relative w-max min-w-full" style={{ paddingTop: ESPACO_TOPO }}>
        <div role="tablist" aria-label={rotuloAria} className="pointer-events-auto flex rounded-controle border border-borda bg-superficie px-5 shadow-card">
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
              className={juntar("min-h-toque shrink-0 whitespace-nowrap px-4 text-sm font-medium transition-colors", item.codigo === valor ? "text-sobre-marca" : "text-texto-suave hover:text-texto")}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
        <Entalhe
          raiz={raiz}
          itens={botoes}
          indice={indice}
          orientacao="horizontal"
          borda={ESPACO_TOPO}
          fundo={fundo}
          classePilula="flex items-center justify-center whitespace-nowrap px-3 text-sm font-semibold"
          conteudo={(i) => itens[i]?.rotulo ?? ""}
        />
      </div>
    </div>
  );
}
