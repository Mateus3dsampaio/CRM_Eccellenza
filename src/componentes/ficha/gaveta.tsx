"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BellPlus, ClipboardCopy, Maximize2, StickyNote, X } from "lucide-react";
import { ETAPAS_COM_RETORNO } from "@/regras/vendas";
import type { FichaLead } from "@/servicos/consultas";
import { chamarApi, useDados } from "../dados";
import { Avatar, Botao, Carregando, EstadoErro, Sino } from "../ui";
import { MenuAgendar, SeletorEtapa, useAcoesDoLead } from "./acoes-lead";
import { ConversaConsultor } from "./conversa";
import { CamposDoCliente, linhaDoCliente } from "./dados-lead";
import { PilulasAgora, useItensDoPasso } from "./proximo-passo";

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

/** Painel deslizante de acesso rápido: o que pede ação agora, uma linha do cliente e a conversa. O resto fica na ficha completa. */
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
        <motion.div key="fundo" className="veu fixed inset-0 z-[55]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={aoFechar} aria-hidden />
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
          className="fixed inset-y-0 right-0 z-[56] flex w-full flex-col border-l border-borda bg-fundo pb-[env(safe-area-inset-bottom)] shadow-flutuante sm:w-[640px]"
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
  const { acoes, janelas } = useAcoesDoLead(ficha, recarregar);
  const itens = useItensDoPasso(ficha);
  // Resumo recolhido ao abrir: a conversa ganha a altura toda.
  const [resumoAberto, setResumoAberto] = useState(false);
  const idResumo = useId();
  const podeLembrar = acoes.podeEditar && !ficha.arquivado && (ETAPAS_COM_RETORNO as string[]).includes(ficha.etapa);
  const ultimaNota = ficha.notas[0];
  useMarcarComoVista(ficha.id, ficha.naoLidas);
  return (
    <>
      {/* Cabeçalho: quem é, com a etapa como botão (troca ali mesmo). */}
      <header className="flex shrink-0 items-center gap-3 luz-marca-fio border-b border-borda bg-superficie px-4 pb-3.5 pt-3 max-sm:flex-wrap max-sm:gap-x-2 max-sm:gap-y-2 max-sm:pb-2.5">
        <Avatar nome={ficha.nomeExibicao} cor={ficha.avatarCor} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold leading-tight">
            <span className="truncate">{ficha.nomeExibicao}</span>
            {ficha.aguardandoHumano && <Sino />}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-texto-suave">
            <span className="max-sm:whitespace-nowrap">{ficha.telefone}</span>
            {ficha.arquivado && <span className="font-medium text-aviso">Arquivado</span>}
          </p>
        </div>
        {/* Celular: a etapa desce para uma linha própria (nome, ficha completa e fechar não cabem com ela em 375px). */}
        <div className="max-sm:order-last max-sm:w-full">
          <SeletorEtapa etapa={ficha.etapa} aoEscolher={acoes.pedirEtapa} />
        </div>
        <Link href={`/lead/${ficha.id}`} aria-label="Abrir ficha completa" className="tecla inline-flex min-h-10 items-center gap-2 rounded-controle px-3 text-sm font-medium" title="Dados completos, medidas, notas e histórico">
          <Maximize2 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Ficha completa</span>
        </Link>
        <button onClick={aoFechar} className="botao-icone" aria-label="Fechar gaveta">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      {/* Agora: só o que pede ação, com cor de urgência. */}
      <PilulasAgora itens={itens} acoes={acoes} />

      {/* Quem é: uma linha; o resumo inteiro abre só se pedir. */}
      <div className="flex shrink-0 items-center gap-2 py-1 pl-4 pr-2">
        <p className="min-w-0 flex-1 truncate text-[13px] text-texto-suave">{linhaDoCliente(ficha)}</p>
        <Botao variante="fantasma" className="min-h-9 shrink-0 px-2.5 text-[13px]" onClick={() => setResumoAberto((a) => !a)} aria-expanded={resumoAberto} aria-controls={idResumo}>
          {resumoAberto ? "Fechar resumo" : "Ver resumo"}
        </Botao>
      </div>
      {resumoAberto && (
        <div id={idResumo} className="rolagem-fina mx-3 mb-2 max-h-[40vh] shrink-0 animate-surgir overflow-y-auto rounded-painel border border-borda bg-superficie p-3.5">
          <CamposDoCliente ficha={ficha} />
          {ficha.medidas.length > 0 && (
            <p className="mt-2 text-sm">
              <span className="text-texto-fraco">Medidas: </span>
              {ficha.medidas.map((m) => `${m.ambiente} ${m.descricao}`).join("; ")}
            </p>
          )}
          {ultimaNota && (
            <p className="mt-2 rounded-controle bg-superficie-suave px-3 py-2 text-sm">
              <span className="text-texto-fraco">Última nota · {ultimaNota.autorNome}: </span>
              <span className="whitespace-pre-wrap break-words">{ultimaNota.texto}</span>
            </p>
          )}
          <div className="mt-1 flex justify-end">
            <Botao variante="fantasma" className="min-h-9 px-2.5" icone={<ClipboardCopy className="size-4" aria-hidden />} onClick={acoes.copiarResumo}>
              Copiar resumo
            </Botao>
          </div>
        </div>
      )}

      {/* Conversa: ocupa todo o resto, com o campo de envio sempre à vista embaixo. */}
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <ConversaConsultor
          ficha={ficha}
          aoMudar={recarregar}
          atalhos={
            <>
              {!ficha.arquivado && <MenuAgendar aoEscolher={acoes.agendar} abrir="cima" alinhar="esquerda" />}
              {podeLembrar && (
                <Botao variante="fantasma" className="min-h-10 px-3" icone={<BellPlus className="size-4" aria-hidden />} onClick={acoes.editarLembrete}>
                  Lembrete
                </Botao>
              )}
              <Botao variante="fantasma" className="min-h-10 px-3" icone={<StickyNote className="size-4" aria-hidden />} onClick={acoes.novaNota}>
                Nota
              </Botao>
            </>
          }
        />
      </div>
      {janelas}
    </>
  );
}
