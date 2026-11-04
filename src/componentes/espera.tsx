"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { faixaDeEspera, minutosEsperando, PRAZOS_ESPERA_PADRAO, textoDeEspera, type FaixaEspera, type PrazosEspera } from "@/regras/espera";
import type { leadsAguardando } from "@/servicos/consultas";
import { useDados, useVersao } from "./dados";

export type LeadAguardando = Awaited<ReturnType<typeof leadsAguardando>>[number];
interface Resposta {
  leads: LeadAguardando[];
  prazos: PrazosEspera;
}

const Contexto = createContext<Resposta>({ leads: [], prazos: PRAZOS_ESPERA_PADRAO });

/** Uma consulta só para a tela toda: o contador do topo, a lista e as cores dos cards usam os mesmos dados. */
export function ProvedorEspera({ children }: { children: ReactNode }) {
  const { dados } = useDados<Resposta>("/api/aguardando");
  const valor = useMemo(() => dados ?? { leads: [], prazos: PRAZOS_ESPERA_PADRAO }, [dados]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useAguardando = () => useContext(Contexto);

/** A hora vem do servidor (que pode estar com o relógio simulado), não do navegador. */
export function useAgoraDoServidor(): Date {
  const { agora } = useVersao();
  return useMemo(() => (agora ? new Date(agora) : new Date()), [agora]);
}

export interface SituacaoEspera {
  esperando: boolean;
  minutos: number;
  faixa: FaixaEspera;
  texto: string;
}

/** Quanto tempo o cliente espera e em que faixa de cor isso cai. */
export function useSituacaoEspera(esperandoDesde: string | null): SituacaoEspera {
  const { prazos } = useAguardando();
  const agora = useAgoraDoServidor();
  const minutos = minutosEsperando(esperandoDesde, agora);
  return { esperando: esperandoDesde !== null, minutos, faixa: faixaDeEspera(esperandoDesde, agora, prazos), texto: textoDeEspera(minutos) };
}

/**
 * Classes do card por faixa (tarefa 33): borda esquerda grossa + badge, fundo normal. A cor nunca vai sozinha: o card
 * também diz "esperando há X". Só o card crítico (`CLASSE_CARD_CRITICO`) fica com o fundo vermelho inteiro que pisca.
 */
export const CLASSE_CARD_ESPERA: Record<FaixaEspera, string> = {
  normal: "border-borda bg-superficie",
  amarelo: "border-borda border-l-4 border-l-aviso bg-superficie",
  vermelho: "border-borda border-l-4 border-l-alerta bg-superficie shadow-espera-vermelha",
};
// Vermelho vivo que pisca (halo pulsando, mesmo ritmo do botão "Retornos de hoje"), pedido do Mateus 04/11/2026;
// com "reduzir movimento" ligado no aparelho, quase não anima.
export const CLASSE_CARD_CRITICO = "border-alerta-vivo bg-alerta-card animate-respirar";
/** Badge "esperando há X" por faixa. */
export const CLASSE_BADGE_ESPERA: Record<FaixaEspera, string> = {
  normal: "bg-superficie-suave text-texto-suave",
  amarelo: "bg-aviso-suave text-aviso",
  vermelho: "bg-alerta-suave text-alerta",
};
export const CLASSE_TEXTO_ESPERA: Record<FaixaEspera, string> = {
  normal: "text-texto-suave",
  amarelo: "text-aviso",
  vermelho: "text-alerta",
};
