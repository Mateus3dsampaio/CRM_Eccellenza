"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ETAPAS, nomesPadraoDasEtapas, type CodigoEtapa, type NomesEtapas } from "@/regras/etapas";
import { chamarApi, useDados } from "./dados";

interface Valor {
  nomes: NomesEtapas;
  /** Nome da coluna (o do admin, ou o de fábrica). */
  nome: (codigo: string) => string;
  /** Colunas na ordem, já com os nomes atuais. */
  lista: { codigo: CodigoEtapa; nome: string }[];
  /** Só o admin pode (a API confere de novo). Nome vazio volta ao padrão. */
  renomear: (codigo: CodigoEtapa, nome: string) => Promise<void>;
}

const PADRAO = nomesPadraoDasEtapas();
const Contexto = createContext<Valor>({
  nomes: PADRAO,
  nome: (c) => PADRAO[c as CodigoEtapa] ?? c,
  lista: ETAPAS.map((e) => ({ codigo: e.codigo, nome: e.nome })),
  renomear: async () => undefined,
});

/** Uma consulta só para a tela toda: nomes das colunas do Kanban (menu de mover, ficha, avisos). Recarrega quando o admin renomeia. */
export function ProvedorEtapas({ children }: { children: ReactNode }) {
  const { dados, recarregar } = useDados<{ nomes: NomesEtapas }>("/api/etapas");
  const valor = useMemo<Valor>(() => {
    const nomes = dados?.nomes ?? PADRAO;
    return {
      nomes,
      nome: (c) => nomes[c as CodigoEtapa] ?? c,
      lista: ETAPAS.map((e) => ({ codigo: e.codigo, nome: nomes[e.codigo] })),
      renomear: async (codigo, nome) => {
        await chamarApi("/api/etapas", { method: "PUT", json: { codigo, nome } });
        await recarregar();
      },
    };
  }, [dados, recarregar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useNomesEtapas = () => useContext(Contexto);
