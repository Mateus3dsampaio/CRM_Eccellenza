"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Maximize2, X } from "lucide-react";
import type { FichaLead } from "@/servicos/consultas";
import { useNomesEtapas } from "../etapas";
import { chamarApi, useDados } from "../dados";
import { COR_ETAPA, juntar } from "../estilos";
import { Avatar, Carregando, EstadoErro, Sino } from "../ui";
import { ConversaConsultor } from "./conversa";
import { useBlocosDadosLead } from "./dados-lead";

// Gaveta do lead (tarefa 23): abre por cima de qualquer tela com `?lead=ID` na URL. Assim F5 reabre,
// "voltar" fecha e o link pode ser mandado a outro consultor. Na própria tela /lead/[id] ela não aparece.
const PARAMETRO = "lead";

const ContextoGaveta = createContext<{ aberto: string | null; hrefDe: (id: string) => string; fechar: () => void }>({
  aberto: null,
  hrefDe: (id) => `/lead/${id}`,
  fechar: () => {},
});

/** `aberto` (id do lead na gaveta), `hrefDe(id)` (link que abre a gaveta na tela atual) e `fechar()`. */
export const useGaveta = () => useContext(ContextoGaveta);

export function ProvedorGaveta({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const naFicha = caminho.startsWith("/lead/");
  const aberto = naFicha ? null : params.get(PARAMETRO);

  const hrefDe = useCallback(
    (id: string) => {
      const novos = new URLSearchParams(params.toString());
      novos.set(PARAMETRO, id);
      return `${caminho}?${novos.toString()}`;
    },
    [caminho, params],
  );
  // Fechar troca a entrada atual do histórico (replace): "voltar" depois disso não reabre a gaveta.
  const fechar = useCallback(() => {
    const novos = new URLSearchParams(params.toString());
    novos.delete(PARAMETRO);
    const resto = novos.toString();
    router.replace(resto ? `${caminho}?${resto}` : caminho, { scroll: false });
  }, [caminho, params, router]);

  const valor = useMemo(() => ({ aberto, hrefDe, fechar }), [aberto, hrefDe, fechar]);
  return (
    <ContextoGaveta.Provider value={valor}>
      {children}
      <GavetaLead id={aberto} aoFechar={fechar} />
    </ContextoGaveta.Provider>
  );
}

/** Painel deslizante com resumo, conversa e etapa do lead. */
function GavetaLead({ id, aoFechar }: { id: string | null; aoFechar: () => void }) {
  const semMovimento = useReducedMotion();
  useEffect(() => {
    if (!id) return;
    const tecla = (e: KeyboardEvent) => {
      // Esc fecha a gaveta, mas não por cima de uma janela (modal) aberta dentro dela.
      if (e.key === "Escape" && !document.querySelector("[role=dialog][aria-modal=true]")) aoFechar();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [id, aoFechar]);

  return (
    <AnimatePresence>
      {id && (
        <motion.div key="fundo" className="fixed inset-0 z-[55] bg-texto/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={aoFechar} aria-hidden />
      )}
      {id && (
        <motion.aside
          key={id}
          role="complementary"
          aria-label="Gaveta do lead"
          data-gaveta
          initial={semMovimento ? { opacity: 0 } : { x: "100%" }}
          animate={semMovimento ? { opacity: 1 } : { x: 0 }}
          exit={semMovimento ? { opacity: 0 } : { x: "100%" }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-y-0 right-0 z-[56] flex w-full flex-col border-l border-borda bg-fundo shadow-flutuante sm:w-[600px]"
        >
          <ConteudoGaveta id={id} aoFechar={aoFechar} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function ConteudoGaveta({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const { dados: ficha, erro, carregando, recarregar } = useDados<FichaLead>(`/api/leads/${id}`);
  if (carregando && !ficha) {
    return (
      <div className="p-4">
        <Carregando linhas={4} />
      </div>
    );
  }
  if (!ficha) {
    return (
      <div className="p-4">
        <EstadoErro texto={erro ?? "Lead não encontrado. Ele pode ter sido excluído."} aoTentar={recarregar} />
      </div>
    );
  }
  return <GavetaCarregada ficha={ficha} recarregar={recarregar} aoFechar={aoFechar} />;
}

/** Com a gaveta aberta e a aba visível, a conversa conta como vista (ESP-06), igual à ficha completa. */
function useMarcarComoVista(id: string, naoLidas: number) {
  useEffect(() => {
    if (naoLidas <= 0) return;
    const marcar = () => {
      if (document.visibilityState === "visible") void chamarApi(`/api/leads/${id}/conversa`, { method: "POST", json: { acao: "vista" } }).catch(() => undefined);
    };
    marcar();
    document.addEventListener("visibilitychange", marcar);
    return () => document.removeEventListener("visibilitychange", marcar);
  }, [id, naoLidas]);
}

function GavetaCarregada({ ficha, recarregar, aoFechar }: { ficha: FichaLead; recarregar: () => void | Promise<void>; aoFechar: () => void }) {
  const nomesEtapas = useNomesEtapas();
  const { blocos, janelas } = useBlocosDadosLead(ficha, recarregar);
  useMarcarComoVista(ficha.id, ficha.naoLidas);
  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-borda bg-superficie px-4 py-3">
        <Avatar nome={ficha.nomeExibicao} cor={ficha.avatarCor} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold leading-tight">
            <span className="truncate">{ficha.nomeExibicao}</span>
            {ficha.aguardandoHumano && <Sino />}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-texto-suave">
            <span>{ficha.telefone}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className={juntar("size-2 rounded-full", COR_ETAPA[ficha.etapa])} aria-hidden />
              {nomesEtapas.nome(ficha.etapa)}
            </span>
            {ficha.arquivado && <span className="font-medium text-aviso">Arquivado</span>}
          </p>
        </div>
        <Link href={`/lead/${ficha.id}`} className="tecla inline-flex min-h-toque items-center gap-2 rounded-controle px-3 text-sm font-medium" title="Dados completos, medidas, notas e histórico">
          <Maximize2 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Abrir ficha completa</span>
          <span className="sr-only sm:hidden">Abrir ficha completa</span>
        </Link>
        <button onClick={aoFechar} className="inline-flex size-toque shrink-0 items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave" aria-label="Fechar gaveta">
          <X className="size-5" aria-hidden />
        </button>
      </header>
      <div className="rolagem-fina flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="shrink-0">{blocos.resumo}</div>
        <div className="flex h-[30rem] shrink-0 flex-col">
          <ConversaConsultor ficha={ficha} aoMudar={recarregar} />
        </div>
        <div className="shrink-0">{blocos.etapa}</div>
      </div>
      {janelas}
    </>
  );
}
