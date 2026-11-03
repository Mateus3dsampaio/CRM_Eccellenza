"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BellRing, Clock } from "lucide-react";
import { juntar } from "./estilos";
import { CLASSE_TEXTO_ESPERA, useAguardando, useSituacaoEspera, type LeadAguardando } from "./espera";
import { BolinhaNaoLidas } from "./kanban/bolinha";
import { useUsuario } from "./usuario";

/** Contador "X aguardando você" no topo; ao clicar, abre a lista desses leads (ESP-05). */
export function BotaoAguardando() {
  const { leads } = useAguardando();
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
  const rotulo = `${total} aguardando ${ehAdmin ? "resposta" : "você"}`;

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label={rotulo}
        title={rotulo}
        className={juntar(
          "inline-flex min-h-toque items-center gap-2 rounded-controle px-3 text-sm font-medium shadow-card transition active:scale-[0.97]",
          total > 0 ? "bg-alerta text-sobre-marca hover:opacity-90" : "bg-superficie-suave text-texto-suave hover:text-texto",
        )}
      >
        <BellRing className="size-4" aria-hidden />
        <span className="tabular-nums">{total}</span>
        <span className="hidden whitespace-nowrap xl:inline">aguardando {ehAdmin ? "resposta" : "você"}</span>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Leads aguardando"
          className="fixed inset-x-3 top-[calc(var(--spacing-topo)+0.5rem)] z-50 animate-surgir rounded-card border border-borda bg-superficie shadow-flutuante sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <p className="border-b border-borda px-4 py-3 text-sm font-semibold">
            {total === 0 ? "Ninguém esperando resposta" : `${total} ${total === 1 ? "lead aguardando" : "leads aguardando"} ${ehAdmin ? "um consultor" : "você"}`}
          </p>
          {total === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-texto-suave">Tudo respondido por enquanto.</p>
          ) : (
            <ul className="rolagem-fina max-h-[60vh] divide-y divide-borda overflow-y-auto">
              {leads.map((l) => (
                <ItemAguardando key={l.id} lead={l} mostrarConsultor={ehAdmin} aoEscolher={() => setAberto(false)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ItemAguardando({ lead, mostrarConsultor, aoEscolher }: { lead: LeadAguardando; mostrarConsultor: boolean; aoEscolher: () => void }) {
  const espera = useSituacaoEspera(lead.esperandoDesde);
  return (
    <li>
      <Link href={`/lead/${lead.id}`} onClick={aoEscolher} className="flex items-start gap-3 px-4 py-3 hover:bg-superficie-suave">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{lead.nome}</p>
          {lead.previa && <p className="truncate text-xs text-texto-suave">{lead.previa}</p>}
          <p className={juntar("mt-1 inline-flex items-center gap-1 text-xs font-medium", CLASSE_TEXTO_ESPERA[espera.faixa])}>
            <Clock className="size-3.5" aria-hidden />
            esperando há {espera.texto}
            {mostrarConsultor && <span className="font-normal text-texto-fraco"> · {lead.consultor ? lead.consultor.nome : "sem consultor"}</span>}
          </p>
        </div>
        <BolinhaNaoLidas total={lead.naoLidas} />
      </Link>
    </li>
  );
}
