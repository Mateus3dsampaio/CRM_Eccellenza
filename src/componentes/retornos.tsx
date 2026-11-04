"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { useNomesEtapas } from "./etapas";
import { formatarHora, formatarVisitaCurta, partesLocais } from "@/regras/tempo";
import { ETAPAS_COM_RETORNO, formatarReais, situacaoDoRetorno, type SituacaoRetorno } from "@/regras/vendas";
import type { retornosDeHoje } from "@/servicos/consultas";
import { useDados } from "./dados";
import { useAgoraDoServidor } from "./espera";
import { retornoObrigatorio, useRegrasVendas } from "./vendas/regras";
import { juntar } from "./estilos";
import { useUsuario } from "./usuario";

export type LeadComRetorno = Awaited<ReturnType<typeof retornosDeHoje>>[number];

const Contexto = createContext<LeadComRetorno[]>([]);

/** Uma consulta só para a tela toda: o botão do topo e a lista usam os mesmos dados. */
export function ProvedorRetornos({ children }: { children: ReactNode }) {
  const { dados } = useDados<{ leads: LeadComRetorno[] }>("/api/retornos");
  const valor = useMemo(() => dados?.leads ?? [], [dados]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useRetornos = () => useContext(Contexto);

export interface SituacaoDoCard {
  situacao: SituacaoRetorno;
  /** "hoje 14:30", "atrasado desde 03/11", "10/11 14:30" ou "defina o próximo contato". */
  texto: string;
}

const dois = (n: number) => String(n).padStart(2, "0");

/** Situação do retorno de um lead. Só existe em Orçamento e Negociação; nas outras etapas devolve null. */
export function useSituacaoRetorno(etapa: string, proximoContatoEm: string | null): SituacaoDoCard | null {
  const agora = useAgoraDoServidor();
  const regras = useRegrasVendas();
  if (!(ETAPAS_COM_RETORNO as string[]).includes(etapa)) return null;
  const situacao = situacaoDoRetorno(proximoContatoEm, agora);
  // Sem data só vira cobrança ("defina o próximo contato") onde a data é obrigatória.
  if (situacao === "sem_data" && !retornoObrigatorio(regras, etapa)) return null;
  return { situacao, texto: textoDoRetorno(situacao, proximoContatoEm) };
}

export function textoDoRetorno(situacao: SituacaoRetorno, proximoContatoEm: string | null): string {
  if (situacao === "sem_data" || !proximoContatoEm) return "defina o próximo contato";
  const d = new Date(proximoContatoEm);
  const p = partesLocais(d);
  if (situacao === "hoje") return `hoje ${formatarHora(d)}`;
  if (situacao === "atrasado") return `atrasado desde ${dois(p.dia)}/${dois(p.mes)}`;
  return formatarVisitaCurta(d);
}

/** Destaque do card: borda forte no dia do retorno (e quando atrasado). A cor nunca vai sozinha: o card também escreve o texto. */
export const CLASSE_CARD_RETORNO: Record<SituacaoRetorno, string> = {
  sem_data: "",
  futuro: "",
  hoje: "ring-2 ring-marca",
  atrasado: "ring-2 ring-alerta",
};
export const CLASSE_TEXTO_RETORNO: Record<SituacaoRetorno, string> = {
  sem_data: "text-aviso",
  futuro: "text-texto-suave",
  hoje: "text-marca-texto",
  atrasado: "text-alerta",
};

/** Botão "Retornos de hoje" no topo; ao clicar, abre a lista (RET-02). */
export function BotaoRetornos() {
  const leads = useRetornos();
  const nomesEtapas = useNomesEtapas();
  const ehAdmin = useUsuario().perfil === "admin";
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent | TouchEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const total = leads.length;
  const urgentes = leads.filter((l) => l.situacao === "hoje" || l.situacao === "atrasado").length;
  const rotulo = `${total} ${total === 1 ? "retorno" : "retornos"} de hoje`;

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label={rotulo}
        title={rotulo}
        className={juntar(
          "inline-flex min-h-toque items-center gap-1.5 rounded-controle px-2.5 text-sm font-medium sm:gap-2 sm:px-3 shadow-card transition active:scale-[0.97]",
          urgentes > 0 ? "bg-marca text-sobre-marca hover:bg-marca-forte" : "bg-superficie-suave text-texto-suave hover:text-texto",
        )}
      >
        <CalendarClock className="size-4" aria-hidden />
        <span className="tabular-nums">{total}</span>
        <span className="hidden whitespace-nowrap 2xl:inline">retornos de hoje</span>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Retornos de hoje"
          className="fixed inset-x-3 top-[calc(var(--spacing-topo)+0.5rem)] z-50 animate-surgir rounded-card border border-borda bg-superficie shadow-flutuante sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <p className="border-b border-borda px-4 py-3 text-sm font-semibold">{total === 0 ? "Nenhum retorno para hoje" : `Retornos de hoje (${total})`}</p>
          {total === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-texto-suave">Nada marcado para hoje.</p>
          ) : (
            <ul className="rolagem-fina max-h-[60vh] divide-y divide-borda overflow-y-auto">
              {leads.map((l) => (
                <li key={l.id}>
                  <Link href={`/lead/${l.id}`} onClick={() => setAberto(false)} className="block px-4 py-3 hover:bg-superficie-suave">
                    <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                      <span className="truncate">{l.nome}</span>
                      {l.valorOrcamento ? <span className="shrink-0 text-xs font-medium text-texto-suave">{formatarReais(l.valorOrcamento)}</span> : null}
                    </p>
                    <p className={juntar("mt-0.5 inline-flex items-center gap-1 text-xs font-medium", CLASSE_TEXTO_RETORNO[l.situacao])}>
                      <CalendarClock className="size-3.5" aria-hidden />
                      {textoDoRetorno(l.situacao, l.proximoContatoEm)}
                      <span className="font-normal text-texto-fraco">
                        · {nomesEtapas.nome(l.etapa)}
                        {ehAdmin && ` · ${l.consultor ? l.consultor.nome : "sem consultor"}`}
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
