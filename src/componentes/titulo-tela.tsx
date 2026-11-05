"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Título da barra de cima (tarefa 28): uma tela pode trocar o título padrão por algo seu (a ficha mostra o cliente).
export interface TituloTela {
  conteudo: ReactNode;
}

const Contexto = createContext<{ titulo: TituloTela | null; definir: (t: TituloTela | null) => void }>({ titulo: null, definir: () => {} });

export function ProvedorTituloTela({ children }: { children: ReactNode }) {
  const [titulo, definir] = useState<TituloTela | null>(null);
  const valor = useMemo(() => ({ titulo, definir }), [titulo]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useTituloTela = () => useContext(Contexto).titulo;

/** A tela que chama passa a mandar na barra de cima enquanto estiver montada. */
export function useDefinirTituloTela(conteudo: ReactNode, chave: string) {
  const { definir } = useContext(Contexto);
  useEffect(() => {
    definir({ conteudo });
    return () => definir(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `chave` resume o que muda no conteúdo (nome, etapa)
  }, [definir, chave]);
}
