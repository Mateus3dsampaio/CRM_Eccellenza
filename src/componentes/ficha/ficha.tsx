"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import ReactGridLayout, { useContainerWidth, verticalCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Archive, ArchiveRestore, ArrowLeft, GripHorizontal, LayoutDashboard, RotateCcw, Save, Trash2, X } from "lucide-react";
import { nomeEtapa } from "@/regras/etapas";
import { ALTURA_LINHA_FICHA, BLOCOS_FICHA, COLUNAS_FICHA, LAYOUT_PADRAO_FICHA, NOMES_BLOCOS, limparLayout, type BlocoFicha, type ItemLayout } from "@/regras/layout-ficha";
import { formatarDataHora } from "@/regras/tempo";
import type { FichaLead } from "@/servicos/consultas";
import { chamarApi, useAviso, useDados } from "../dados";
import { COR_ETAPA, juntar } from "../estilos";
import { Avatar, Botao, Carregando, EstadoErro, Modal, Sino, classeEntrada } from "../ui";
import { usePode } from "../usuario";
import { ConversaConsultor } from "./conversa";
import { Painel, useBlocosDadosLead } from "./dados-lead";

type Aba = "conversa" | "ficha" | "notas";

function assinarTela(aviso: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", aviso);
  return () => mq.removeEventListener("change", aviso);
}
/** Grade arrastável só no computador/tablet largo; no celular ficam as abas. */
function useTelaGrande() {
  return useSyncExternalStore(assinarTela, () => window.matchMedia("(min-width: 1024px)").matches, () => true);
}

/** Com a ficha aberta e a aba visível, a conversa conta como vista: zera a bolinha de não lidas (ESP-06). */
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

export function Ficha({ id }: { id: string }) {
  const { dados: ficha, erro, carregando, recarregar } = useDados<FichaLead>(`/api/leads/${id}`);
  if (carregando && !ficha) return <div className="mx-auto w-full max-w-6xl p-4"><Carregando linhas={4} /></div>;
  if (!ficha) return <div className="mx-auto w-full max-w-6xl p-4"><EstadoErro texto={erro ?? "Lead não encontrado. Ele pode ter sido excluído."} aoTentar={recarregar} /></div>;
  return <FichaCarregada ficha={ficha} id={id} recarregar={recarregar} />;
}

function FichaCarregada({ ficha, id, recarregar }: { ficha: FichaLead; id: string; recarregar: () => void | Promise<void> }) {
  const router = useRouter();
  const avisar = useAviso();
  const podeExcluir = usePode("excluir_lead");
  const podeConfigurar = usePode("configurar");
  const [aba, setAba] = useState<Aba>("conversa");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const { dados: layoutSalvo, recarregar: recarregarLayout } = useDados<{ layout: ItemLayout[]; personalizado: boolean }>("/api/configuracoes/layout-ficha");
  // Rascunho do admin enquanto personaliza (null = não está personalizando).
  const [rascunho, setRascunho] = useState<ItemLayout[] | null>(null);
  const [salvandoLayout, setSalvandoLayout] = useState(false);
  const { width, containerRef, mounted } = useContainerWidth();
  const telaGrande = useTelaGrande();
  const { blocos: blocosDados, janelas } = useBlocosDadosLead(ficha, recarregar);
  useMarcarComoVista(id, ficha.naoLidas);

  async function acao(corpo: object, sucesso: string, depois?: () => void) {
    try {
      await chamarApi("/api/leads/acoes", { method: "POST", json: { ...corpo, ids: [id] } });
      avisar(sucesso);
      depois?.();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível concluir.", "erro");
    } finally {
      void recarregar();
    }
  }

  async function restaurar() {
    try {
      await chamarApi(`/api/leads/${id}`, { method: "PATCH", json: { restaurar: true } });
      avisar("Lead restaurado.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível restaurar.", "erro");
    } finally {
      void recarregar();
    }
  }

  async function salvarLayout() {
    if (!rascunho) return;
    setSalvandoLayout(true);
    try {
      await chamarApi("/api/configuracoes/layout-ficha", { method: "PUT", json: { layout: limparLayout(rascunho) } });
      avisar("Layout salvo como padrão de todos.");
      setRascunho(null);
      await recarregarLayout();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível salvar o layout.", "erro");
    } finally {
      setSalvandoLayout(false);
    }
  }

  async function voltarLayoutOriginal() {
    try {
      await chamarApi("/api/configuracoes/layout-ficha", { method: "DELETE" });
      avisar("Layout original restaurado para todos.");
      setRascunho(null);
      await recarregarLayout();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível restaurar.", "erro");
    }
  }

  const abas: { id: Aba; rotulo: string }[] = [
    { id: "conversa", rotulo: "Conversa" },
    { id: "ficha", rotulo: "Ficha" },
    { id: "notas", rotulo: "Notas" },
  ];

  const blocos: Record<BlocoFicha, React.ReactNode> = {
    conversa: (
      <div className="flex h-full min-h-0 flex-col">
        <ConversaConsultor ficha={ficha} aoMudar={recarregar} />
      </div>
    ),
    ...blocosDados,
    notas: <Notas ficha={ficha} aoMudar={recarregar} />,
    historico: <Historico ficha={ficha} />,
  };

  const editando = rascunho !== null;
  const layoutAtual = rascunho ?? layoutSalvo?.layout ?? LAYOUT_PADRAO_FICHA;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie" aria-label="Voltar ao kanban">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <Avatar nome={ficha.nomeExibicao} cor={ficha.avatarCor} tamanho="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="truncate">{ficha.nomeExibicao}</span>
            {ficha.aguardandoHumano && <Sino />}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-texto-suave">
            <span>{ficha.telefone}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className={juntar("size-2 rounded-full", COR_ETAPA[ficha.etapa])} aria-hidden />
              {nomeEtapa(ficha.etapa)}
            </span>
            {ficha.arquivado && <span className="font-medium text-aviso">Arquivado</span>}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          {podeConfigurar && telaGrande && !editando && (
            <Botao onClick={() => setRascunho(layoutAtual.map((l) => ({ ...l })))} icone={<LayoutDashboard className="size-4" aria-hidden />}>
              Personalizar layout
            </Botao>
          )}
          {ficha.arquivado ? (
            <Botao onClick={restaurar} icone={<ArchiveRestore className="size-4" aria-hidden />}>Restaurar</Botao>
          ) : (
            <Botao onClick={() => acao({ acao: "arquivar" }, "Lead arquivado.", () => router.push("/"))} icone={<Archive className="size-4" aria-hidden />}>
              Arquivar
            </Botao>
          )}
          {podeExcluir && (
            <Botao variante="fantasma" className="text-alerta hover:bg-alerta-suave hover:text-alerta sm:ml-4" onClick={() => setConfirmarExclusao(true)} icone={<Trash2 className="size-4" aria-hidden />}>
              <span className="hidden sm:inline">Excluir</span>
              <span className="sr-only sm:hidden">Excluir</span>
            </Botao>
          )}
        </div>
      </div>

      {editando && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-marca/30 bg-marca-suave p-2 pl-4 text-sm">
          <span className="font-medium text-marca-texto">Personalizando o layout</span>
          <span className="text-texto-suave">· arraste pela barra de cada quadro e redimensione pelo canto. Vale para todos.</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Botao variante="fantasma" onClick={voltarLayoutOriginal} icone={<RotateCcw className="size-4" aria-hidden />}>
              Voltar ao original
            </Botao>
            <Botao variante="fantasma" onClick={() => setRascunho(null)} icone={<X className="size-4" aria-hidden />}>
              Cancelar
            </Botao>
            <Botao variante="primario" carregando={salvandoLayout} onClick={salvarLayout} icone={<Save className="size-4" aria-hidden />}>
              Salvar para todos
            </Botao>
          </div>
        </div>
      )}

      {telaGrande ? (
        <div ref={containerRef}>
          {mounted && (
            <ReactGridLayout
              width={width}
              layout={layoutAtual}
              gridConfig={{ cols: COLUNAS_FICHA, rowHeight: ALTURA_LINHA_FICHA, margin: [12, 12], containerPadding: [0, 0] }}
              dragConfig={{ enabled: editando, handle: ".alca-bloco" }}
              resizeConfig={{ enabled: editando }}
              compactor={verticalCompactor}
              onLayoutChange={(novo) => {
                if (editando) setRascunho(novo.map(({ i, x, y, w, h }) => ({ i: i as BlocoFicha, x, y, w, h })));
              }}
            >
              {BLOCOS_FICHA.map((b) => (
                <div key={b} className={juntar("relative min-h-0", editando && "rounded-painel outline-2 outline-dashed outline-marca/50")}>
                  {editando && (
                    <div className="alca-bloco absolute inset-x-0 top-0 z-10 flex h-7 cursor-grab items-center justify-center gap-1.5 rounded-t-painel bg-marca text-xs font-medium text-sobre-marca active:cursor-grabbing">
                      <GripHorizontal className="size-4" aria-hidden /> {NOMES_BLOCOS[b]}
                    </div>
                  )}
                  <div className={juntar("h-full min-h-0", editando && "pointer-events-none pt-7")}>{blocos[b]}</div>
                </div>
              ))}
            </ReactGridLayout>
          )}
        </div>
      ) : (
        <>
          {/* Celular: abas */}
          <div className="flex gap-1 rounded-controle bg-superficie p-1 shadow-card" role="tablist">
            {abas.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
                className={juntar("min-h-toque flex-1 rounded-controle text-sm font-medium transition", aba === a.id ? "bg-marca-suave text-marca-texto" : "text-texto-suave")}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          {aba === "conversa" && <div className="flex min-h-[28rem] flex-col">{blocos.conversa}</div>}
          {aba === "ficha" && (
            <div className="space-y-4">
              {(["resumo", "etapa", "visita", "apresentacao", "dados", "medidas"] as const).map((b) => (
                <div key={b}>{blocos[b]}</div>
              ))}
            </div>
          )}
          {aba === "notas" && (
            <div className="space-y-4">
              {blocos.notas}
              {blocos.historico}
            </div>
          )}
        </>
      )}
      {janelas}

      <Modal aberto={confirmarExclusao} aoFechar={() => setConfirmarExclusao(false)} titulo="Excluir de vez" largura="max-w-md">
        <p className="text-sm text-texto-suave">Excluir 1 lead? Mensagens, fotos e plantas também serão apagadas. Não dá para desfazer.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setConfirmarExclusao(false)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={() => acao({ acao: "excluir" }, "Lead excluído.", () => router.push("/"))}>Excluir</Botao>
        </div>
      </Modal>
    </div>
  );
}

function Notas({ ficha, aoMudar }: { ficha: FichaLead; aoMudar: () => void }) {
  const avisar = useAviso();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  return (
    <Painel titulo="Notas internas">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          setSalvando(true);
          try {
            await chamarApi(`/api/leads/${ficha.id}/notas`, { method: "POST", json: { texto } });
            setTexto("");
            avisar("Nota salva.");
          } catch (erro) {
            avisar(erro instanceof Error ? erro.message : "Não foi possível salvar.", "erro");
          } finally {
            setSalvando(false);
            aoMudar();
          }
        }}
      >
        <input className={classeEntrada} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva uma nota (o cliente não vê)" aria-label="Nova nota" />
        <Botao type="submit" variante="primario" carregando={salvando} disabled={!texto.trim()} className="whitespace-nowrap">
          Salvar nota
        </Botao>
      </form>
      <ul className="mt-3 space-y-2">
        {ficha.notas.length === 0 && <li className="text-sm text-texto-suave">Nenhuma nota.</li>}
        {ficha.notas.map((n) => (
          <li key={n.id} className="rounded-controle bg-superficie-suave p-3 text-sm">
            <p className="whitespace-pre-wrap">{n.texto}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-xs text-texto-fraco">
                {n.autorNome} · {formatarDataHora(new Date(n.criadoEm))}
              </p>
              <button
                onClick={async () => {
                  try {
                    await chamarApi(`/api/leads/${ficha.id}/notas`, { method: "DELETE", json: { notaId: n.id } });
                    avisar("Nota excluída.");
                  } catch (erro) {
                    avisar(erro instanceof Error ? erro.message : "Não foi possível excluir.", "erro");
                  } finally {
                    aoMudar();
                  }
                }}
                className="inline-flex size-9 items-center justify-center rounded-controle text-texto-fraco hover:bg-alerta-suave hover:text-alerta"
                aria-label="Excluir nota"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Painel>
  );
}

function Historico({ ficha }: { ficha: FichaLead }) {
  return (
    <Painel titulo="Histórico de alterações">
      <ol className="max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
        {ficha.historico.map((h) => (
          <li key={h.id} className="flex gap-3 border-l-2 border-borda pl-3">
            <div className="min-w-0">
              <p>{h.descricao}</p>
              <p className="text-xs text-texto-fraco">
                {h.autor === "bot" ? "Bot" : h.autor === "sistema" ? "Sistema" : h.autor} · {formatarDataHora(new Date(h.criadoEm))}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Painel>
  );
}
