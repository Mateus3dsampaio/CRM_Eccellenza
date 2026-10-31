"use client";

import { createContext, useContext, type ReactNode } from "react";
import { pode, type Acao } from "@/regras/permissoes";

export interface Usuario {
  id: string;
  nome: string;
  perfil: "admin" | "consultor";
}

const Contexto = createContext<Usuario | null>(null);

export function ProvedorUsuario({ usuario, children }: { usuario: Usuario; children: ReactNode }) {
  return <Contexto.Provider value={usuario}>{children}</Contexto.Provider>;
}

export function useUsuario(): Usuario {
  const u = useContext(Contexto);
  if (!u) throw new Error("Usuário fora do contexto.");
  return u;
}

/** Só esconde na tela; o servidor confere de novo (USR-02). */
export function usePode(acao: Acao): boolean {
  return pode(useUsuario().perfil, acao);
}
