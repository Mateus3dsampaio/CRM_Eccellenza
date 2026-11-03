"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CodigoEtapa } from "@/regras/etapas";
import { MOTIVOS_PADRAO, REGRAS_PADRAO, type MotivoDePerda, type RegrasDeVendas } from "@/regras/vendas";
import { useDados } from "../dados";

interface Resposta {
  exigirContatoNegociacao: boolean;
  motivos: MotivoDePerda[];
}

const PADRAO: Resposta = { exigirContatoNegociacao: true, motivos: MOTIVOS_PADRAO.map((m) => ({ ...m, ativo: true })) };
const Contexto = createContext<Resposta>(PADRAO);

/** Uma consulta só para a tela toda (janela de mover, ficha, destaque do card). Recarrega quando o admin muda as regras. */
export function ProvedorVendas({ children }: { children: ReactNode }) {
  const { dados } = useDados<Resposta>("/api/vendas/regras");
  const valor = useMemo(() => (dados ? { exigirContatoNegociacao: dados.exigirContatoNegociacao, motivos: dados.motivos } : PADRAO), [dados]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useRegrasVendas = () => useContext(Contexto);

/** Regras no formato que `faltaParaMover` entende; `motivoAtual` continua valendo mesmo se o admin o desativou. */
export function regrasParaConferir(r: Resposta, motivoAtual?: string | null): RegrasDeVendas {
  return { ...REGRAS_PADRAO, exigirContatoNegociacao: r.exigirContatoNegociacao, motivos: r.motivos.filter((m) => m.ativo || m.codigo === motivoAtual).map((m) => ({ codigo: m.codigo, pergunta: m.pergunta })) };
}

/** O retorno é obrigatório nessa etapa? (Negociação depende do interruptor em Configurações > Vendas.) */
export function retornoObrigatorio(r: Resposta, etapa: CodigoEtapa | string): boolean {
  return etapa === "orcamento" || (etapa === "negociacao" && r.exigirContatoNegociacao);
}
