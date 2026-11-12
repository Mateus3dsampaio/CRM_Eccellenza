"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Hourglass } from "lucide-react";
import { useNomesEtapas } from "./etapas";
import { janelasFechando } from "@/regras/janela24h";
import type { janelasAbertas } from "@/servicos/consultas";
import { useDados } from "./dados";
import { useAgoraDoServidor } from "./espera";
import { juntar } from "./estilos";
import { useUsuario } from "./usuario";
import { useGaveta } from "./ficha/gaveta";

type LeadComJanela = Awaited<ReturnType<typeof janelasAbertas>>[number];

const Contexto = createContext<LeadComJanela[]>([]);

/** Uma consulta só para a tela toda; quem está "fechando" é calculado com o relógio do servidor. */
export function ProvedorJanelas({ children }: { children: ReactNode }) {
  const { dados } = useDados<{ leads: LeadComJanela[] }>("/api/janelas");
  const valor = useMemo(() => dados?.leads ?? [], [dados]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Botão "Janelas fechando" no topo: leads com menos de 2 h de texto livre, do mais urgente ao menos (tarefa 37). */
export function BotaoJanelas() {
  const gaveta = useGaveta();
  const abertas = useContext(Contexto);
  const agora = useAgoraDoServidor();
  const nomesEtapas = useNomesEtapas();
  const ehAdmin = useUsuario().perfil === "admin";
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const leads = useMemo(() => janelasFechando(abertas, agora), [abertas, agora]);

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
  const rotulo = `${total} ${total === 1 ? "janela fechando" : "janelas fechando"} (menos de 2 h)`;

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label={rotulo}
        title={rotulo}
        className={juntar(
          "inline-flex min-h-toque items-center gap-1.5 rounded-controle px-2.5 text-sm font-medium shadow-card transition active:scale-[0.97] sm:gap-2 sm:px-3",
          total > 0 ? "bg-alerta-suave text-alerta ring-1 ring-alerta/60 hover:brightness-110" : "bg-superficie-suave text-texto-suave hover:text-texto",
        )}
      >
        <Hourglass className="size-4" aria-hidden />
        <span className="hidden whitespace-nowrap xl:inline">Janelas</span>
        <span className="tabular-nums">{total}</span>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Janelas fechando"
          className="vidro menu-nascer fixed inset-x-3 top-[calc(var(--spacing-topo)+0.5rem)] z-50 rounded-card sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <p className="border-b border-borda px-4 py-3 text-sm font-semibold">{total === 0 ? "Nenhuma janela fechando" : `Janelas fechando (${total})`}</p>
          <p className="border-b border-borda px-4 py-2 text-xs text-texto-fraco">Falta menos de 2 h para o texto livre fechar. Só a resposta do cliente renova a janela: chame agora.</p>
          {total === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-texto-suave">Nenhum cliente com a janela perto de fechar.</p>
          ) : (
            <ul className="rolagem-fina max-h-[60vh] divide-y divide-borda overflow-y-auto">
              {leads.map((l) => (
                <li key={l.id}>
                  <Link href={gaveta.hrefDe(l.id)} scroll={false} onClick={() => setAberto(false)} className="block px-4 py-3 hover:bg-superficie-suave">
                    <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                      <span className="truncate">{l.nome}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold tabular-nums text-alerta">
                        <Hourglass className="size-3.5" aria-hidden />
                        fecha em {l.janela.texto}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-texto-fraco">
                      {nomesEtapas.nome(l.etapa)}
                      {ehAdmin && ` · ${l.consultor ? l.consultor.nome : "sem consultor"}`}
                    </p>
                    {l.previa && <p className="mt-0.5 line-clamp-1 text-xs text-texto-suave">{l.previa}</p>}
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
