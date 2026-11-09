"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ClipboardList, Maximize2, SlidersHorizontal, X } from "lucide-react";
import { CLASSIFICACOES, type Classificacao } from "@/regras/etapas";
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
          className="fixed inset-y-0 right-0 z-[56] flex w-full flex-col border-l border-borda bg-fundo shadow-flutuante sm:w-[640px]"
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
  const { partes, janelas } = useBlocosDadosLead(ficha, recarregar);
  // Seções recolhidas ao abrir: a conversa ganha a altura toda e a gaveta abre no topo.
  const [aberta, setAberta] = useState<"resumo" | "etapa" | null>(null);
  const alternar = (secao: "resumo" | "etapa") => setAberta((a) => (a === secao ? null : secao));
  const primeiraLinhaResumo = ficha.resumo?.split("\n").find((l) => l.trim()) ?? "Ainda sem resumo";
  const classificacao = ficha.classificacao ? CLASSIFICACOES[ficha.classificacao as Classificacao] : "Sem classificação";
  const resumoEtapa = `${nomesEtapas.nome(ficha.etapa)} · ${ficha.consultor?.nome ?? "Sem consultor"} · ${classificacao}`;
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
      {/* Corpo sem rolagem própria: duas seções recolhíveis em cima e a conversa ocupando o resto,
          com o campo de envio sempre à vista embaixo. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        <SecaoRecolhivel
          titulo="Resumo para o consultor"
          icone={<ClipboardList className="size-4" aria-hidden />}
          linha={primeiraLinhaResumo}
          aberta={aberta === "resumo"}
          aoAlternar={() => alternar("resumo")}
          acao={partes.copiarResumo}
        >
          {partes.textoResumo}
        </SecaoRecolhivel>
        <SecaoRecolhivel
          titulo="Etapa e responsável"
          icone={<SlidersHorizontal className="size-4" aria-hidden />}
          linha={resumoEtapa}
          aberta={aberta === "etapa"}
          aoAlternar={() => alternar("etapa")}
        >
          {partes.conteudoEtapa}
        </SecaoRecolhivel>
        <div className="flex min-h-0 flex-1 flex-col">
          <ConversaConsultor ficha={ficha} aoMudar={recarregar} />
        </div>
      </div>
      {janelas}
    </>
  );
}

/** Seção que abre e fecha com um clique no cabeçalho. Fechada, mostra só uma linha de resumo; aberta, rola por dentro. */
function SecaoRecolhivel({ titulo, icone, linha, aberta, aoAlternar, acao, children }: { titulo: string; icone: ReactNode; linha: string; aberta: boolean; aoAlternar: () => void; acao?: ReactNode; children: ReactNode }) {
  const semMovimento = useReducedMotion();
  const idConteudo = useId();
  return (
    <section className={juntar("shrink-0 overflow-hidden rounded-painel border bg-superficie shadow-painel transition-colors", aberta ? "border-marca/40" : "border-borda")}>
      <div className="flex items-center gap-2 pr-2">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberta}
          aria-controls={idConteudo}
          className="flex min-h-toque min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left hover:bg-superficie-suave/60"
        >
          <span className={juntar("inline-flex size-8 shrink-0 items-center justify-center rounded-controle", aberta ? "bg-marca-suave text-marca-texto" : "bg-superficie-suave text-texto-suave")}>{icone}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-tight">{titulo}</span>
            {!aberta && <span className="block truncate text-xs text-texto-suave">{linha}</span>}
          </span>
          <ChevronDown className={juntar("size-4 shrink-0 text-texto-suave transition-transform duration-200", aberta && "rotate-180")} aria-hidden />
        </button>
        {aberta && acao}
      </div>
      <AnimatePresence initial={false}>
        {aberta && (
          <motion.div
            id={idConteudo}
            key="conteudo"
            initial={semMovimento ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="rolagem-fina max-h-[45vh] overflow-y-auto border-t border-borda p-3"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
