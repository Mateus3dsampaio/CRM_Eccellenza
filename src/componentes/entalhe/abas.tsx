"use client";

import { useRef } from "react";
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

  return (
    // Fora da barra: rola de lado em tela estreita.
    <div className={juntar("rolagem-fina max-w-full overflow-x-auto", className)}>
      <div
        ref={raiz}
        role="tablist"
        aria-label={rotuloAria}
        className="relative flex w-max min-w-full rounded-controle px-1.5"
        style={{
          background: "rgb(255 255 255 / 0.035)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
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
