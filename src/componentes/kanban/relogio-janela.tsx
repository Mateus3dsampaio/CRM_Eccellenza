"use client";

import { janelaFechaEm, situacaoDaJanela, type FaixaJanela } from "@/regras/janela24h";
import { formatarDataHora } from "@/regras/tempo";
import { juntar } from "../estilos";
import { useAgoraDoServidor } from "../espera";

/** Etapas em que a janela não importa: o atendimento acabou. */
const ETAPAS_SEM_RELOGIO = ["fechado", "perdido"];

const COR_ANEL: Record<FaixaJanela, string> = {
  verde: "text-sucesso",
  amarelo: "text-aviso",
  vermelho: "text-alerta",
  fechada: "text-texto-fraco",
};

const R = 9;
const CIRCUNFERENCIA = 2 * Math.PI * R;

/**
 * Relógio da janela de 24h da Meta (tarefa 37): anel que esvazia com as horas que sobram. No rodapé do card (tarefa 39)
 * o texto só aparece quando importa: faltam 2 h ou menos, ou a janela fechou ("Só modelo"). Não pisca; a dica (passar o
 * mouse) diz a hora exata. Só mensagem do cliente reabre a janela.
 */
export function RelogioJanela({ etapa, ultimaMsgClienteEm }: { etapa: string; ultimaMsgClienteEm: string | null }) {
  const agora = useAgoraDoServidor();
  if (ETAPAS_SEM_RELOGIO.includes(etapa)) return null;
  const j = situacaoDaJanela(ultimaMsgClienteEm, agora);
  const fechaEm = janelaFechaEm(ultimaMsgClienteEm ? new Date(ultimaMsgClienteEm) : null);
  const fecha = fechaEm ? formatarDataHora(fechaEm) : null;
  const titulo = j.faixa === "fechada" ? "Janela de 24h fechada: só modelo de mensagem. O cliente precisa responder para reabrir." : `Texto livre até ${fecha} (faltam ${j.texto}). Só a resposta do cliente renova a janela.`;
  const texto = j.faixa === "fechada" ? "Só modelo" : j.faixa === "vermelho" ? j.texto : "";
  return (
    <span data-janela={j.faixa} className={juntar("inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums", COR_ANEL[j.faixa])} title={titulo} aria-label={titulo}>
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={R} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
        {j.faixa !== "fechada" && <circle cx="12" cy="12" r={R} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeDasharray={CIRCUNFERENCIA} strokeDashoffset={CIRCUNFERENCIA * (1 - j.fracao)} />}
      </svg>
      {texto}
    </span>
  );
}
