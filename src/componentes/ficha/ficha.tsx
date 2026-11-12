"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Download, MoreHorizontal, PanelRightClose, PanelRightOpen, Trash2 } from "lucide-react";
import { useNomesEtapas } from "../etapas";
import { formatarDataHora } from "@/regras/tempo";
import type { FichaLead } from "@/servicos/consultas";
import { chamarApi, useAviso, useDados } from "../dados";
import { Abas } from "../entalhe/abas";
import { COR_ETAPA, juntar } from "../estilos";
import { Avatar, Botao, CarregandoTela, EstadoErro, Modal, Popover, Sino, classeEntrada } from "../ui";
import { useDefinirTituloTela } from "../titulo-tela";
import { usePode } from "../usuario";
import { AvisoMidias } from "../midias/aviso-midias";
import { SeletorEtapa, useAcoesDoLead } from "./acoes-lead";
import { ConversaConsultor } from "./conversa";
import { BlocoCliente, BlocoGestao, BlocoMedidas, BlocoNotas, Painel } from "./dados-lead";
import { BlocoProximoPasso, IconesDoPasso, useItensDoPasso } from "./proximo-passo";

type Aba = "conversa" | "ficha";
type AbaConversa = "conversa" | "notas" | "historico";

const TELA_GRANDE = "(min-width: 1024px)";
const TELA_LARGA = "(min-width: 1440px)";
function assinarTela(aviso: () => void) {
  const consultas = [TELA_GRANDE, TELA_LARGA].map((c) => window.matchMedia(c));
  consultas.forEach((mq) => mq.addEventListener("change", aviso));
  return () => consultas.forEach((mq) => mq.removeEventListener("change", aviso));
}
/** Duas colunas lado a lado só no computador/tablet largo; no celular ficam as abas. */
function useTelaGrande() {
  return useSyncExternalStore(assinarTela, () => window.matchMedia(TELA_GRANDE).matches, () => true);
}
/** A partir de 1440px a etapa cabe na barra de cima, ao lado do cliente; abaixo disso ela fica na linha das abas da conversa. */
function useTelaLarga() {
  return useSyncExternalStore(assinarTela, () => window.matchMedia(TELA_LARGA).matches, () => true);
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

// A escolha de recolher a coluna da ficha fica guardada neste navegador.
const CHAVE_RECOLHIDA = "crm.ficha.recolhida";
function lerRecolhida(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_RECOLHIDA) === "1";
  } catch {
    return false;
  }
}

export function Ficha({ id }: { id: string }) {
  const { dados: ficha, erro, carregando, recarregar } = useDados<FichaLead>(`/api/leads/${id}`);
  if (carregando && !ficha) return <CarregandoTela />;
  if (!ficha) return <div className="mx-auto w-full max-w-6xl p-4"><EstadoErro texto={erro ?? "Lead não encontrado. Ele pode ter sido excluído."} aoTentar={recarregar} /></div>;
  return <FichaCarregada ficha={ficha} id={id} recarregar={recarregar} />;
}

/**
 * Ficha completa (arranjo de 09/11/2026): conversa à esquerda e, à direita, uma coluna só em ordem de prioridade
 * (Próximo passo, Cliente, Notas, Medidas, Gestão). A coluna recolhe e a conversa ocupa a tela.
 */
function FichaCarregada({ ficha, id, recarregar }: { ficha: FichaLead; id: string; recarregar: () => void | Promise<void> }) {
  const router = useRouter();
  const avisar = useAviso();
  const podeExcluir = usePode("excluir_lead");
  const nomesEtapas = useNomesEtapas();
  const [aba, setAba] = useState<Aba>("conversa");
  const [abaConversa, setAbaConversa] = useState<AbaConversa>("conversa");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  // Este componente só monta no navegador (depois de carregar a ficha): dá para ler a escolha guardada direto.
  const [recolhida, setRecolhida] = useState(lerRecolhida);
  const telaGrande = useTelaGrande();
  const telaLarga = useTelaLarga();
  const { acoes, janelas } = useAcoesDoLead(ficha, recarregar);
  const itens = useItensDoPasso(ficha);
  useMarcarComoVista(id, ficha.naoLidas);

  function alternarRecolhida() {
    setRecolhida((r) => {
      try {
        window.localStorage.setItem(CHAVE_RECOLHIDA, r ? "0" : "1");
      } catch {
        // Sem armazenamento (aba anônima): vale só até fechar a tela.
      }
      return !r;
    });
  }

  // As ações moram na barra de cima, que só é refeita quando a `chave` muda: elas leem sempre a versão atual daqui.
  const acoesRef = useRef<AcoesDaFicha>({ arquivar: () => {}, restaurar: () => {}, excluir: () => {}, pedirEtapa: () => {} });
  useEffect(() => {
    acoesRef.current = {
      arquivar: () => void acao({ acao: "arquivar" }, "Lead arquivado.", () => router.push("/")),
      restaurar: () => void restaurar(),
      excluir: () => setConfirmarExclusao(true),
      pedirEtapa: acoes.pedirEtapa,
    };
  });

  // A barra de cima mostra o cliente (tarefa 28), com a etapa como botão que troca ali mesmo.
  useDefinirTituloTela(
    <>
      <Link href="/" className="botao-icone" aria-label="Voltar ao kanban">
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <Avatar nome={ficha.nomeExibicao} cor={ficha.avatarCor} tamanho="sm" />
      <div className="min-w-0 lg:min-w-[8.5rem]">
        <h1 className="flex items-center gap-2 text-base font-semibold leading-tight tracking-tight">
          <span className="truncate">{ficha.nomeExibicao}</span>
          {ficha.aguardandoHumano && <Sino />}
        </h1>
        <p className="flex items-center gap-x-3 overflow-hidden whitespace-nowrap text-xs text-texto-suave">
          <span>{ficha.telefone}</span>
          {!telaGrande && (
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
              <span className={juntar("size-2 rounded-full", COR_ETAPA[ficha.etapa])} aria-hidden />
              {nomesEtapas.nome(ficha.etapa)}
            </span>
          )}
          {ficha.arquivado && <span className="font-medium text-aviso">Arquivado</span>}
        </p>
      </div>
      {telaLarga && (
        <div className="shrink-0 pb-1">
          <SeletorEtapa etapa={ficha.etapa} aoEscolher={(e) => acoesRef.current.pedirEtapa(e)} alinhar="esquerda" />
        </div>
      )}
      {telaGrande && <AcoesFicha leadId={ficha.id} arquivado={ficha.arquivado} podeExcluir={podeExcluir} acoes={acoesRef} />}
    </>,
    `${ficha.nomeExibicao}|${ficha.telefone}|${ficha.etapa}|${ficha.aguardandoHumano}|${ficha.arquivado}|${nomesEtapas.nome(ficha.etapa)}|${podeExcluir}|${telaGrande}|${telaLarga}`,
  );

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

  const abas: { codigo: Aba; rotulo: string }[] = [
    { codigo: "conversa", rotulo: "Conversa" },
    { codigo: "ficha", rotulo: "Ficha" },
  ];
  // Painel da conversa com abas Conversa | Notas | Histórico (tarefa 28): é tudo linha do tempo do mesmo cliente.
  const abasConversa: { codigo: AbaConversa; rotulo: string }[] = [
    { codigo: "conversa", rotulo: "Conversa" },
    { codigo: "notas", rotulo: ficha.notas.length ? `Notas (${ficha.notas.length})` : "Notas" },
    { codigo: "historico", rotulo: "Histórico" },
  ];
  const conversa = (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Abas itens={abasConversa} valor={abaConversa} aoMudar={setAbaConversa} rotuloAria="Conversa, notas e histórico" />
        </div>
        {/* Computador com menos de 1440px: a barra de cima não tem espaço para a etapa; ela fica aqui. */}
        {telaGrande && !telaLarga && <SeletorEtapa etapa={ficha.etapa} aoEscolher={acoes.pedirEtapa} />}
      </div>
      {abaConversa === "conversa" ? <ConversaConsultor ficha={ficha} aoMudar={recarregar} /> : abaConversa === "notas" ? <Notas ficha={ficha} aoMudar={recarregar} /> : <Historico ficha={ficha} />}
    </div>
  );
  // Coluna da ficha, em ordem de prioridade. `recolher` só existe no computador.
  const blocos = (recolher?: React.ReactNode) => (
    <>
      <BlocoProximoPasso ficha={ficha} itens={itens} acoes={acoes} extra={recolher} />
      <BlocoCliente ficha={ficha} acoes={acoes} />
      <BlocoNotas
        ficha={ficha}
        acoes={acoes}
        aoVerTodas={() => {
          setAba("conversa");
          setAbaConversa("notas");
        }}
      />
      <BlocoMedidas ficha={ficha} aoMudar={recarregar} />
      <BlocoGestao ficha={ficha} acoes={acoes} />
    </>
  );

  return (
    <>
      {telaGrande ? (
        // Altura da janela menos a barra de cima (e a linha dela): a conversa, com o campo de envio, cabe sem rolar a página.
        <div className="flex h-[calc(100dvh-var(--spacing-topo)-1px)] w-full gap-3.5 p-4">
          <div className="min-w-0 flex-[1.35]">{conversa}</div>
          {recolhida ? (
            <aside aria-label="Ficha recolhida" className="flex w-[58px] shrink-0 animate-surgir flex-col items-center gap-2.5 rounded-painel border border-borda bg-coluna py-2.5">
              <button type="button" onClick={alternarRecolhida} aria-label="Mostrar a ficha" title="Mostrar a ficha" className="tecla mb-2 inline-flex size-10 items-center justify-center rounded-controle">
                <PanelRightOpen className="size-[18px]" aria-hidden />
              </button>
              <IconesDoPasso itens={itens} />
            </aside>
          ) : (
            <aside aria-label="Ficha do cliente" className="rolagem-fina flex min-w-[380px] flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
              {blocos(
                <button type="button" onClick={alternarRecolhida} aria-label="Recolher a ficha" title="Recolher a ficha: a conversa ocupa a tela" className="tecla mb-1 ml-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-controle">
                  <PanelRightClose className="size-[18px]" aria-hidden />
                </button>,
              )}
            </aside>
          )}
        </div>
      ) : (
        <div className="mx-auto flex w-full flex-1 flex-col gap-3 p-3 md:gap-4 md:p-4">
          {/* Celular: a barra de cima não tem espaço; etapa e ações ficam numa linha própria, acima das abas. */}
          <div className="flex items-center justify-between gap-2 pb-1">
            <SeletorEtapa etapa={ficha.etapa} aoEscolher={acoes.pedirEtapa} alinhar="esquerda" />
            <AcoesFicha leadId={ficha.id} arquivado={ficha.arquivado} podeExcluir={podeExcluir} acoes={acoesRef} />
          </div>
          <Abas itens={abas} valor={aba} aoMudar={setAba} rotuloAria="Seções da ficha" />
          {/* Altura tirada da tela (topo, linha da etapa, abas e a barra de baixo): quem rola é a caixa da conversa, que abre no fim, e não a página. */}
          {aba === "conversa" && <div className="flex h-[calc(100dvh-var(--spacing-topo)-14rem-env(safe-area-inset-bottom))] min-h-[22rem] flex-col md:h-[calc(100dvh-var(--spacing-topo)-10.75rem)]">{conversa}</div>}
          {aba === "ficha" && <div className="flex flex-col gap-3">{blocos()}</div>}
        </div>
      )}
      {janelas}

      <Modal aberto={confirmarExclusao} aoFechar={() => setConfirmarExclusao(false)} titulo="Excluir de vez" largura="max-w-md">
        <p className="text-sm text-texto-suave">Excluir 1 lead? Mensagens, fotos, vídeos e documentos também serão apagados. Não dá para desfazer.</p>
        {confirmarExclusao && <AvisoMidias alvo={{ ids: [ficha.id] }} />}
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setConfirmarExclusao(false)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={() => acao({ acao: "excluir" }, "Lead excluído.", () => router.push("/"))}>Excluir</Botao>
        </div>
      </Modal>
    </>
  );
}

interface AcoesDaFicha {
  arquivar: () => void;
  restaurar: () => void;
  excluir: () => void;
  pedirEtapa: (etapa: string) => void;
}

/** Arquivar (ou Restaurar) e o menu "⋯" com o raro (exportar LGPD, excluir), na barra de cima ao lado do cliente. */
function AcoesFicha({ leadId, arquivado, podeExcluir, acoes }: { leadId: string; arquivado: boolean; podeExcluir: boolean; acoes: RefObject<AcoesDaFicha> }) {
  const [menuAberto, setMenuAberto] = useState(false);
  return (
    <div className="ml-1 flex shrink-0 items-center gap-1.5 border-l border-borda pl-3">
      {arquivado ? (
        <button type="button" onClick={() => acoes.current.restaurar()} className="tecla inline-flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-controle px-3 text-sm font-medium" title="Restaurar lead">
          <ArchiveRestore className="size-4" aria-hidden />
          <span className="hidden 2xl:inline">Restaurar</span>
          <span className="sr-only 2xl:hidden">Restaurar</span>
        </button>
      ) : (
        <button type="button" onClick={() => acoes.current.arquivar()} className="tecla inline-flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-controle px-3 text-sm font-medium" title="Arquivar lead">
          <Archive className="size-4" aria-hidden />
          <span className="hidden 2xl:inline">Arquivar</span>
          <span className="sr-only 2xl:hidden">Arquivar</span>
        </button>
      )}
      {podeExcluir && (
        <Popover
          aberto={menuAberto}
          aoFechar={() => setMenuAberto(false)}
          titulo="Mais ações"
          largura="sm:w-64"
          gatilho={
            <button type="button" onClick={() => setMenuAberto((m) => !m)} aria-expanded={menuAberto} aria-haspopup="dialog" aria-label="Mais ações" title="Mais ações" className="tecla inline-flex size-toque items-center justify-center rounded-controle">
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          }
        >
          <div className="-mt-2 grid gap-0.5">
            {/* LGPD: baixa tudo o que o CRM guarda deste cliente. É um link normal; o servidor confere se é admin. */}
            <a href={`/api/leads/${leadId}/exportar`} download onClick={() => setMenuAberto(false)} className="flex min-h-toque items-center gap-3 rounded-controle px-3 text-sm hover:bg-superficie-suave" title="Baixar todos os dados deste cliente (LGPD)">
              <Download className="size-4 text-texto-suave" aria-hidden /> Exportar dados (LGPD)
            </a>
            <button
              type="button"
              onClick={() => {
                setMenuAberto(false);
                acoes.current.excluir();
              }}
              className="flex min-h-toque items-center gap-3 rounded-controle px-3 text-left text-sm text-alerta hover:bg-alerta-suave"
            >
              <Trash2 className="size-4" aria-hidden /> Excluir de vez
            </button>
          </div>
        </Popover>
      )}
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
                className="botao-icone botao-icone-compacto botao-icone-perigo"
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
      <ol className="space-y-2 pr-1 text-sm">
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
