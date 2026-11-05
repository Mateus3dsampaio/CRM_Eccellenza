"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CheckSquare, ChevronsLeftRight, Clock, Filter, Minus, Pencil, Plus, Scan, Search, Trash2, Archive, UserRound, X } from "lucide-react";
import { nomeEtiqueta } from "@/regras/etapas";
import { CODIGOS_ETAPA, ETAPAS_LIMPAVEIS, ETIQUETAS, NOME_ETAPA_MAX, etapaComAgenda, type CodigoEtapa, type EtapaComAgenda } from "@/regras/etapas";
import { useNomesEtapas } from "../etapas";
import { idsCriticosDaColuna } from "@/regras/espera";
import { useAgoraDoServidor, useAguardando } from "../espera";
import { ETAPAS_QUE_PEDEM_DADOS } from "@/regras/vendas";
import type { CardKanban } from "@/servicos/consultas";
import { chamarApi, useAviso, useDados } from "../dados";
import { COR_ETAPA, juntar } from "../estilos";
import { AvisoMidias } from "../midias/aviso-midias";
import { Botao, Carregando, EstadoErro, EstadoVazio, Modal, Popover, classeEntrada } from "../ui";
import { usePode, useUsuario } from "../usuario";
import { JanelaMudanca, type VendaParaApi } from "../vendas/janela-mudanca";
import { AgendarVisita } from "../ficha/agendar";
import { NIVEIS_ZOOM, definirZoom, useZoomKanban, zoomParaCaber } from "./zoom";
import { Card, CardFlutuante, type AcoesCard } from "./card";
import { JanelaDecisao, type EscolhaDecisao } from "./decisao";

// Colunas recolhidas (tarefa 24): faixa fina com nome na vertical e contador. Fechado e Perdido começam assim.
const CHAVE_RECOLHIDAS = "colunas-recolhidas";
const RECOLHIDAS_PADRAO: readonly string[] = ["fechado", "perdido"];
// Medidas sem zoom para o ajuste automático (tokens --spacing-coluna e --spacing-coluna-recolhida, gap-4 e p-4).
const LARGURA_COLUNA = 264;
const LARGURA_RECOLHIDA = 44;
const ESPACO_ENTRE = 16;
const MARGEM_QUADRO = 32;

function assinarTela(aviso: () => void) {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", aviso);
  return () => mq.removeEventListener("change", aviso);
}
/** Colunas recolhidas só existem no computador; no celular as abas já resolvem. */
function useTelaGrande() {
  return useSyncExternalStore(assinarTela, () => window.matchMedia("(min-width: 768px)").matches, () => true);
}

function contagem(n: number) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "conversa" : "conversas"}`;
}

type Confirmacao = { titulo: string; texto: string; botao: string; perigo: boolean; midias?: { ids: string[] } | { etapa: string }; executar: () => Promise<void> } | null;

export function Quadro() {
  const { dados, erro, carregando, recarregar, setDados } = useDados<{ cards: CardKanban[]; consultores: { id: string; nome: string }[] }>("/api/kanban");
  const avisar = useAviso();
  const podeExcluir = usePode("excluir_lead");
  const podeRenomear = usePode("configurar");
  const nomesEtapas = useNomesEtapas();
  const usuario = useUsuario();
  const ehAdmin = usuario.perfil === "admin";
  const zoomEscolhido = useZoomKanban();
  const [recolhidas, setRecolhidas] = useState<Set<string>>(() => new Set(RECOLHIDAS_PADRAO));
  const [zoomAuto, setZoomAuto] = useState(1);
  const refRolagem = useRef<HTMLDivElement>(null);
  const zoom = zoomEscolhido === "auto" ? zoomAuto : zoomEscolhido;
  // No modo automático, −/+ partem do nível fixo mais próximo do zoom atual.
  const indiceZoom = (NIVEIS_ZOOM as readonly number[]).indexOf(zoomEscolhido === "auto" ? NIVEIS_ZOOM.reduce((a, b) => (Math.abs(b - zoom) < Math.abs(a - zoom) ? b : a)) : zoomEscolhido);

  // Quais colunas ficam recolhidas é escolha de cada pessoa neste navegador.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_RECOLHIDAS);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- só existe no navegador
      if (salvo !== null) setRecolhidas(new Set(JSON.parse(salvo) as string[]));
    } catch {
      // Sem armazenamento: vale o padrão.
    }
  }, []);
  function alternarRecolhida(codigo: string, recolher?: boolean) {
    setRecolhidas((atual) => {
      const novo = new Set(atual);
      const vai = recolher ?? !novo.has(codigo);
      if (vai) novo.add(codigo);
      else novo.delete(codigo);
      try {
        localStorage.setItem(CHAVE_RECOLHIDAS, JSON.stringify([...novo]));
      } catch {
        // Vale só nesta visita.
      }
      return novo;
    });
  }

  // Zoom automático: as colunas abertas cabem na largura do quadro (até o mínimo; abaixo disso rola).
  const totalColunas = nomesEtapas.lista.length;
  const totalRecolhidas = [...recolhidas].filter((c) => nomesEtapas.lista.some((e) => e.codigo === c)).length;
  useLayoutEffect(() => {
    const el = refRolagem.current;
    if (!el || zoomEscolhido !== "auto") return;
    const medir = () => {
      const necessario = (totalColunas - totalRecolhidas) * LARGURA_COLUNA + totalRecolhidas * LARGURA_RECOLHIDA + (totalColunas - 1) * ESPACO_ENTRE + MARGEM_QUADRO;
      setZoomAuto(zoomParaCaber(el.clientWidth, necessario));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [zoomEscolhido, totalColunas, totalRecolhidas, dados]);

  const [busca, setBusca] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [consultor, setConsultor] = useState("");
  const [cidade, setCidade] = useState("");
  // Filtros de um clique (ESP-12).
  const [soEsperando, setSoEsperando] = useState(false);
  const [soMeus, setSoMeus] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [arrastado, setArrastado] = useState<CardKanban | null>(null);
  const [abaCelular, setAbaCelular] = useState<string>("novo");
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [executando, setExecutando] = useState(false);
  const [pedido, setPedido] = useState<{ id: string; etapa: CodigoEtapa } | null>(null);
  // Medição/Apresentação agendada: o card só entra com o compromisso marcado; agendar já move o card.
  const [agendando, setAgendando] = useState<{ id: string; tipo: EtapaComAgenda } | null>(null);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  // "Ainda negociando": a janela de Negociação pede a data nova (sem trazer a data vencida preenchida).
  const [novoRetorno, setNovoRetorno] = useState(false);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Celular: toque longo para arrastar (KAN-03).
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const cards = useMemo(() => dados?.cards ?? [], [dados]);
  const consultores = useMemo(() => {
    const mapa = new Map<string, string>();
    cards.forEach((c) => c.consultor && mapa.set(c.consultor.id, c.consultor.nome));
    return [...mapa].sort((a, b) => a[1].localeCompare(b[1]));
  }, [cards]);
  const cidades = useMemo(() => [...new Set(cards.map((c) => c.cidade).filter(Boolean) as string[])].sort(), [cards]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoDigitos = termo.replace(/\D/g, "");
    return cards.filter(
      (c) =>
        (!termo || c.busca.includes(termo) || (termoDigitos.length >= 4 && c.busca.replace(/\D/g, "").includes(termoDigitos))) &&
        (!etiqueta || c.etiquetas.includes(etiqueta)) &&
        (!consultor || c.consultor?.id === consultor) &&
        (!cidade || c.cidade === cidade) &&
        (!soEsperando || c.esperandoDesde !== null) &&
        (!soMeus || c.consultor?.id === usuario.id),
    );
  }, [cards, busca, etiqueta, consultor, cidade, soEsperando, soMeus, usuario.id]);
  const totalEsperando = useMemo(() => cards.filter((c) => c.esperandoDesde !== null).length, [cards]);

  const porEtapa = useMemo(() => {
    const mapa: Record<string, CardKanban[]> = Object.fromEntries(CODIGOS_ETAPA.map((e) => [e, []]));
    filtrados.forEach((c) => mapa[c.etapa]?.push(c));
    return mapa;
  }, [filtrados]);

  const filtrosAtivos = [etiqueta, ehAdmin ? "" : consultor, cidade].filter(Boolean).length;

  async function acao(corpo: object, sucesso?: string) {
    try {
      const r = await chamarApi<{ total?: number }>("/api/leads/acoes", { method: "POST", json: corpo });
      if (sucesso) avisar(sucesso.replace("{n}", String(r.total ?? "")));
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível concluir.", "erro");
    } finally {
      await recarregar();
    }
  }

  function mover(id: string, etapa: string) {
    if (etapaComAgenda(etapa)) return setAgendando({ id, tipo: etapa });
    // Etapas que exigem dados (retorno, valor fechado, motivo da perda): abre a janela e só move ao confirmar.
    if ((ETAPAS_QUE_PEDEM_DADOS as string[]).includes(etapa)) return setPedido({ id, etapa: etapa as CodigoEtapa });
    moverAgora(id, etapa);
  }

  function moverAgora(id: string, etapa: string, venda?: VendaParaApi) {
    const mesmaEtapa = cards.find((c) => c.id === id)?.etapa === etapa;
    // Atualiza na tela na hora; o servidor confirma em seguida.
    setDados((d) => (d ? { ...d, cards: d.cards.map((c) => (c.id === id ? { ...c, etapa } : c)) } : d));
    void acao({ acao: "mover", ids: [id], etapa, ...(venda ? { dados: venda } : {}) }, mesmaEtapa ? "Próximo contato atualizado." : `Movido para "${nomesEtapas.nome(etapa)}".`);
  }

  function decidir(id: string, escolha: EscolhaDecisao) {
    setDecidindo(null);
    if ("agendar" in escolha) return setAgendando({ id, tipo: escolha.agendar });
    if ("mover" in escolha) return mover(id, escolha.mover);
    setNovoRetorno(true);
    setPedido({ id, etapa: "negociacao" });
  }

  function confirmarExclusao(ids: string[], depois?: () => void) {
    setConfirmacao({
      titulo: "Excluir de vez",
      texto: `Excluir ${ids.length} ${ids.length === 1 ? "lead" : "leads"}? Mensagens, fotos, vídeos e documentos também serão apagados. Não dá para desfazer.`,
      midias: { ids },
      botao: "Excluir",
      perigo: true,
      executar: async () => {
        await acao({ acao: "excluir", ids }, "{n} lead(s) excluído(s).");
        depois?.();
      },
    });
  }

  const acoes: AcoesCard = {
    mover,
    removerEtiqueta: (id, codigo) => void acao({ acao: "etiqueta", ids: [id], etiqueta: codigo, ativa: false }),
    arquivar: (id) => void acao({ acao: "arquivar", ids: [id] }, "Lead arquivado."),
    excluir: podeExcluir ? (id) => confirmarExclusao([id]) : undefined,
    decidir: setDecidindo,
  };
  const cardDecidindo = decidindo ? cards.find((c) => c.id === decidindo) : undefined;

  function limparColuna(etapa: string, modo: "arquivar" | "excluir") {
    // Conta a coluna inteira, não só o que está no filtro: a limpeza vale para todos.
    const totalReal = cards.filter((c) => c.etapa === etapa).length;
    if (!totalReal) return avisar("A coluna já está vazia.");
    setConfirmacao({
      titulo: `Limpar "${nomesEtapas.nome(etapa)}"`,
      texto:
        modo === "excluir"
          ? `Excluir ${totalReal} ${totalReal === 1 ? "lead" : "leads"}? Não dá para desfazer.`
          : `Arquivar ${totalReal} ${totalReal === 1 ? "lead" : "leads"}? Eles saem do kanban e podem ser restaurados em Arquivados por 30 dias.`,
      ...(modo === "excluir" ? { midias: { etapa } } : {}),
      botao: modo === "excluir" ? "Excluir todos" : "Arquivar todos",
      perigo: modo === "excluir",
      executar: () => acao({ acao: "limpar_coluna", etapa, modo }, modo === "excluir" ? "{n} lead(s) excluído(s)." : "{n} lead(s) arquivado(s)."),
    });
  }

  function aoComecar(e: DragStartEvent) {
    setArrastado(cards.find((c) => c.id === e.active.id) ?? null);
  }

  function aoSoltar(e: DragEndEvent) {
    setArrastado(null);
    const destino = e.over?.id ? String(e.over.id).replace(/^aba:/, "") : null;
    const origem = e.active.data.current?.etapa;
    if (destino && destino !== origem && (CODIGOS_ETAPA as string[]).includes(destino)) mover(String(e.active.id), destino);
  }

  function alternarSelecao(id: string) {
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function sairSelecao() {
    setSelecionando(false);
    setSelecionados(new Set());
  }

  return (
    // No computador o quadro ocupa a altura da tela; só a lista de cada coluna rola.
    <div className="flex min-h-0 flex-1 flex-col md:h-[calc(100dvh-var(--spacing-topo))] md:flex-none">
      {/* Barra de busca e filtros */}
      <div className="mx-auto w-full max-w-[1800px] space-y-3 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="sr-only">Atendimentos</h1>
          <div className="relative order-last min-w-0 basis-full sm:order-none sm:max-w-[15rem] sm:flex-1 sm:basis-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-fraco" aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone ou ficha"
              aria-label="Buscar"
              className={juntar(classeEntrada, "pl-9")}
            />
          </div>
          {/* Filtros rápidos na mesma linha da busca: o quadro ganha altura (pedido da revisão de design). */}
          <button
            onClick={() => setSoEsperando((v) => !v)}
            aria-pressed={soEsperando}
            className={juntar("inline-flex min-h-toque items-center gap-1.5 rounded-controle px-3 text-sm font-medium shadow-card", soEsperando ? "bg-alerta text-sobre-cor" : "bg-superficie text-texto-suave hover:bg-superficie-suave")}
          >
            <Clock className="size-4" aria-hidden />
            Esperando resposta
            <span className="tabular-nums">({totalEsperando})</span>
          </button>
          {!ehAdmin && (
            <button
              onClick={() => setSoMeus((v) => !v)}
              aria-pressed={soMeus}
              className={juntar("inline-flex min-h-toque items-center gap-1.5 rounded-controle px-3 text-sm font-medium shadow-card", soMeus ? "bg-marca text-sobre-marca" : "bg-superficie text-texto-suave hover:bg-superficie-suave")}
            >
              <UserRound className="size-4" aria-hidden />
              Meus leads
            </button>
          )}
          {ehAdmin && (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filtrar por consultor">
              {[{ id: "", nome: "Todos" }, ...(dados?.consultores ?? [])].map((c) => (
                <button
                  key={c.id || "todos"}
                  onClick={() => setConsultor(c.id)}
                  aria-pressed={consultor === c.id}
                  className={juntar("inline-flex min-h-toque items-center rounded-controle px-3 text-sm font-medium shadow-card", consultor === c.id ? "bg-marca text-sobre-marca" : "bg-superficie text-texto-suave hover:bg-superficie-suave")}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}
          {/* Filtros ligados viram chips com "x" (tarefa 27): dá para ver o que está filtrando sem abrir nada. */}
          {etiqueta && <ChipFiltro rotulo={`Etiqueta: ${nomeEtiqueta(etiqueta)}`} aoRemover={() => setEtiqueta("")} />}
          {cidade && <ChipFiltro rotulo={`Cidade: ${cidade}`} aoRemover={() => setCidade("")} />}
          {!ehAdmin && consultor && <ChipFiltro rotulo={`Consultor: ${consultores.find(([id]) => id === consultor)?.[1] ?? ""}`} aoRemover={() => setConsultor("")} />}
          <div className="md:ml-auto" />
          <Popover
            aberto={filtrosAbertos}
            aoFechar={() => setFiltrosAbertos(false)}
            titulo="Filtros do quadro"
            largura="sm:w-96"
            gatilho={
              <Botao onClick={() => setFiltrosAbertos((f) => !f)} aria-expanded={filtrosAbertos} icone={<Filter className="size-4" aria-hidden />}>
                Filtros{filtrosAtivos ? ` · ${filtrosAtivos}` : ""}
              </Botao>
            }
          >
            <div className="grid gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-texto-suave">Etiqueta</span>
                <select className={classeEntrada} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} aria-label="Filtrar por etiqueta">
                  <option value="">Todas as etiquetas</option>
                  {ETIQUETAS.map((e) => (
                    <option key={e.codigo} value={e.codigo}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </label>
              {!ehAdmin && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-texto-suave">Consultor</span>
                  <select className={classeEntrada} value={consultor} onChange={(e) => setConsultor(e.target.value)} aria-label="Filtrar por consultor">
                    <option value="">Todos os consultores</option>
                    {consultores.map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-texto-suave">Cidade</span>
                <select className={classeEntrada} value={cidade} onChange={(e) => setCidade(e.target.value)} aria-label="Filtrar por cidade">
                  <option value="">Todas as cidades</option>
                  {cidades.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <div className="hidden items-center justify-between gap-2 border-t border-borda pt-3 md:flex">
                <span className="text-xs font-medium text-texto-suave">Tamanho dos cards</span>
          <div className="flex items-center rounded-controle bg-superficie-suave" role="group" aria-label="Zoom do quadro">
            <button
              onClick={() => definirZoom(NIVEIS_ZOOM[Math.max(0, indiceZoom - 1)])}
              disabled={indiceZoom <= 0}
              className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave disabled:opacity-40"
              aria-label="Diminuir zoom (mostrar mais cards)"
              title="Mostrar mais cards"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <button onClick={() => definirZoom(1)} className="min-w-12 px-1 text-center text-sm font-medium tabular-nums" aria-label="Voltar o zoom para 100%" title={zoomEscolhido === "auto" ? "Ajustado à tela. Clique para voltar a 100%" : "Voltar para 100%"}>
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => definirZoom(NIVEIS_ZOOM[Math.min(NIVEIS_ZOOM.length - 1, indiceZoom + 1)])}
              disabled={indiceZoom >= NIVEIS_ZOOM.length - 1}
              className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave disabled:opacity-40"
              aria-label="Aumentar zoom (mostrar menos cards)"
              title="Mostrar menos cards"
            >
              <Plus className="size-4" aria-hidden />
            </button>
            <button
              onClick={() => definirZoom("auto")}
              aria-pressed={zoomEscolhido === "auto"}
              className={juntar("inline-flex size-toque items-center justify-center rounded-controle transition", zoomEscolhido === "auto" ? "text-marca-texto" : "text-texto-suave hover:bg-superficie-suave")}
              aria-label="Ajustar o zoom para as colunas caberem na tela"
              title="Ajustar à tela"
            >
              <Scan className="size-4" aria-hidden />
            </button>
          </div>
              </div>
              <Botao
                variante="fantasma"
                onClick={() => {
                  setEtiqueta("");
                  setConsultor("");
                  setCidade("");
                }}
                disabled={!filtrosAtivos}
              >
                Limpar filtros
              </Botao>
            </div>
          </Popover>
          {selecionando ? (
            <Botao variante="fantasma" onClick={sairSelecao} icone={<X className="size-4" aria-hidden />}>
              Cancelar seleção
            </Botao>
          ) : (
            <Botao onClick={() => setSelecionando(true)} icone={<CheckSquare className="size-4" aria-hidden />}>
              Selecionar
            </Botao>
          )}
        </div>
        {selecionando && (
          <div className="flex flex-wrap items-center gap-2 rounded-card bg-marca-suave p-2 pl-4 text-sm">
            <span className="font-medium text-marca-texto">{selecionados.size} selecionado(s)</span>
            <span className="text-texto-suave">· toque nos cards para marcar</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Botao
                icone={<Archive className="size-4" aria-hidden />}
                disabled={!selecionados.size}
                onClick={async () => {
                  await acao({ acao: "arquivar", ids: [...selecionados] }, "{n} lead(s) arquivado(s).");
                  sairSelecao();
                }}
              >
                Arquivar
              </Botao>
              {podeExcluir && (
                <Botao variante="perigo" icone={<Trash2 className="size-4" aria-hidden />} disabled={!selecionados.size} onClick={() => confirmarExclusao([...selecionados], sairSelecao)}>
                  Excluir
                </Botao>
              )}
            </div>
          </div>
        )}
      </div>

      {carregando && !dados ? (
        <div className="mx-auto grid w-full max-w-[1800px] gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Carregando key={i} linhas={3} />
          ))}
        </div>
      ) : erro && !dados ? (
        <div className="p-4">
          <EstadoErro texto={erro} aoTentar={recarregar} />
        </div>
      ) : (
        <DndContext sensors={sensores} onDragStart={aoComecar} onDragEnd={aoSoltar} onDragCancel={() => setArrastado(null)}>
          {/* Celular: abas por etapa (também recebem cards arrastados) */}
          <div className="sticky top-topo z-20 mt-3 flex gap-1 overflow-x-auto border-b border-borda bg-fundo px-4 pb-2 md:hidden" role="tablist" aria-label="Etapas">
            {nomesEtapas.lista.map((e) => (
              <AbaEtapa key={e.codigo} codigo={e.codigo} nome={e.nome} total={porEtapa[e.codigo].length} ativa={abaCelular === e.codigo} aoEscolher={() => setAbaCelular(e.codigo)} />
            ))}
          </div>

          <div ref={refRolagem} className="rolagem-fina mx-auto min-h-0 w-full max-w-[1800px] flex-1 overflow-x-auto">
            <div className="flex gap-4 p-4 md:h-full md:items-stretch md:[zoom:var(--zoom-kanban)]" style={{ "--zoom-kanban": zoom } as React.CSSProperties}>
            {nomesEtapas.lista.map((e) => (
              <Coluna
                key={e.codigo}
                codigo={e.codigo}
                nome={e.nome}
                cards={porEtapa[e.codigo]}
                totalSemFiltro={cards.filter((c) => c.etapa === e.codigo).length}
                visivelCelular={abaCelular === e.codigo}
                acoes={acoes}
                selecionando={selecionando}
                selecionados={selecionados}
                aoSelecionar={alternarSelecao}
                podeExcluir={podeExcluir}
                podeRenomear={podeRenomear}
                aoRenomear={nomesEtapas.renomear}
                aoLimpar={limparColuna}
                recolhida={recolhidas.has(e.codigo)}
                aoRecolher={(recolher) => alternarRecolhida(e.codigo, recolher)}
              />
            ))}
            </div>
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
            {arrastado ? (
              <div className="md:[zoom:var(--zoom-kanban)]" style={{ "--zoom-kanban": zoom } as React.CSSProperties}>
                <CardFlutuante card={arrastado} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {agendando && (
        <AgendarVisita
          leadId={agendando.id}
          tipo={agendando.tipo}
          aberto
          aoFechar={() => setAgendando(null)}
          aoAgendar={() => {
            setAgendando(null);
            void recarregar();
          }}
        />
      )}
      {cardDecidindo?.decisao && (
        <JanelaDecisao
          nome={cardDecidindo.nome}
          tipo={cardDecidindo.decisao.tipo}
          venceuEm={cardDecidindo.decisao.venceuEm}
          aoFechar={() => setDecidindo(null)}
          aoEscolher={(escolha) => decidir(cardDecidindo.id, escolha)}
        />
      )}
      {pedido && (
        <JanelaMudanca
          etapa={pedido.etapa}
          atuais={(() => {
            const atual = cards.find((c) => c.id === pedido.id);
            return atual && novoRetorno ? { ...atual, proximoContatoEm: null, lembreteNota: null } : atual;
          })()}
          aoCancelar={() => {
            setPedido(null);
            setNovoRetorno(false);
          }}
          aoConfirmar={(venda) => {
            moverAgora(pedido.id, pedido.etapa, venda);
            setPedido(null);
            setNovoRetorno(false);
          }}
        />
      )}

      <Modal aberto={!!confirmacao} aoFechar={() => setConfirmacao(null)} titulo={confirmacao?.titulo ?? ""} largura="max-w-md">
        <p className="text-sm text-texto-suave">{confirmacao?.texto}</p>
        {confirmacao?.midias && <AvisoMidias alvo={confirmacao.midias} />}
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setConfirmacao(null)}>
            Cancelar
          </Botao>
          <Botao
            variante={confirmacao?.perigo ? "perigo" : "primario"}
            carregando={executando}
            onClick={async () => {
              if (!confirmacao) return;
              setExecutando(true);
              await confirmacao.executar();
              setExecutando(false);
              setConfirmacao(null);
            }}
          >
            {confirmacao?.botao}
          </Botao>
        </div>
      </Modal>
    </div>
  );
}

/** Chip de filtro ligado, com "x" para tirar (tarefa 27). */
function ChipFiltro({ rotulo, aoRemover }: { rotulo: string; aoRemover: () => void }) {
  return (
    <span className="inline-flex min-h-toque items-center gap-1 rounded-pilula bg-marca-suave pl-3 pr-1.5 text-sm font-medium text-marca-texto">
      {rotulo}
      <button type="button" onClick={aoRemover} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-marca/20" aria-label={`Tirar o filtro ${rotulo}`}>
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

function AbaEtapa({ codigo, nome, total, ativa, aoEscolher }: { codigo: string; nome: string; total: number; ativa: boolean; aoEscolher: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `aba:${codigo}` });
  return (
    <button
      ref={setNodeRef}
      role="tab"
      aria-selected={ativa}
      onClick={aoEscolher}
      className={juntar(
        "inline-flex min-h-toque shrink-0 items-center gap-2 rounded-pilula px-3 text-sm font-medium transition",
        ativa ? "bg-marca text-sobre-marca" : "bg-superficie text-texto-suave",
        isOver && "ring-2 ring-marca ring-offset-1",
      )}
    >
      <span className={juntar("size-2 rounded-full", COR_ETAPA[codigo])} aria-hidden />
      {nome}
      <span className={juntar("rounded-pilula px-1.5 text-xs", ativa ? "bg-sobre-marca/20" : "bg-superficie-suave")}>{total}</span>
    </button>
  );
}

function Coluna(props: {
  codigo: string;
  nome: string;
  cards: CardKanban[];
  totalSemFiltro: number;
  visivelCelular: boolean;
  acoes: AcoesCard;
  selecionando: boolean;
  selecionados: Set<string>;
  aoSelecionar: (id: string) => void;
  podeExcluir: boolean;
  podeRenomear: boolean;
  aoRenomear: (codigo: CodigoEtapa, nome: string) => Promise<void>;
  aoLimpar: (etapa: string, modo: "arquivar" | "excluir") => void;
  recolhida: boolean;
  aoRecolher: (recolher: boolean) => void;
}) {
  const { codigo, nome, cards, recolhida, aoRecolher } = props;
  const { prazos } = useAguardando();
  const agora = useAgoraDoServidor();
  const criticos = useMemo(() => idsCriticosDaColuna(cards, agora, prazos), [cards, agora, prazos]);
  const { setNodeRef, isOver } = useDroppable({ id: codigo });
  const limpavel = (ETAPAS_LIMPAVEIS as string[]).includes(codigo);
  const telaGrande = useTelaGrande();
  // Card arrastado por cima da coluna recolhida: ela abre sozinha para receber (e fica aberta).
  useEffect(() => {
    if (isOver && recolhida) aoRecolher(false);
  }, [isOver, recolhida, aoRecolher]);

  if (recolhida && telaGrande) {
    return (
      <section
        ref={setNodeRef}
        aria-label={nome}
        data-recolhida
        className={juntar(
          "flex w-coluna-recolhida shrink-0 flex-col items-center rounded-painel bg-coluna py-3 shadow-painel transition md:max-h-full",
          isOver && "bg-marca-suave ring-2 ring-marca/40",
        )}
      >
        <button
          type="button"
          onClick={() => aoRecolher(false)}
          title={`Abrir a coluna ${nome}`}
          aria-label={`Abrir a coluna ${nome} (${contagem(props.totalSemFiltro)})`}
          aria-expanded={false}
          className="flex min-h-0 flex-1 flex-col items-center gap-3 rounded-controle px-1 py-1 text-texto-suave transition hover:bg-superficie hover:text-texto"
        >
          <span className={juntar("inline-flex min-w-6 items-center justify-center rounded-pilula px-1.5 py-0.5 text-xs font-semibold tabular-nums text-sobre-cor", COR_ETAPA[codigo])}>{props.totalSemFiltro}</span>
          <h2 className="truncate text-sm font-semibold [writing-mode:vertical-rl] [text-orientation:mixed]">{nome}</h2>
          <ChevronsLeftRight className="mt-auto size-4 shrink-0" aria-hidden />
        </button>
      </section>
    );
  }
  return (
    <section
      ref={setNodeRef}
      aria-label={nome}
      className={juntar(
        "w-full shrink-0 flex-col rounded-painel bg-coluna p-3 shadow-painel transition md:flex md:max-h-full md:w-coluna",
        props.visivelCelular ? "flex" : "hidden",
        isOver && "bg-marca-suave ring-2 ring-marca/40",
      )}
    >
      <header className="px-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <NomeDaColuna codigo={codigo as CodigoEtapa} nome={nome} podeRenomear={props.podeRenomear} aoRenomear={props.aoRenomear} />
            <p className="text-xs text-texto-fraco">
              {contagem(props.totalSemFiltro)}
              {cards.length !== props.totalSemFiltro && ` · ${cards.length} no filtro`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => aoRecolher(true)}
            title={`Recolher a coluna ${nome}`}
            aria-label={`Recolher a coluna ${nome}`}
            aria-expanded
            className="hidden size-7 shrink-0 items-center justify-center rounded-controle text-texto-fraco transition hover:bg-superficie hover:text-texto md:inline-flex"
          >
            <ChevronsLeftRight className="size-3.5" aria-hidden />
          </button>
        </div>
        <div className={juntar("mt-3 h-1 rounded-pilula", COR_ETAPA[codigo])} aria-hidden />
        {limpavel && props.totalSemFiltro > 0 && (
          <div className="mt-2 flex gap-1">
            <button onClick={() => props.aoLimpar(codigo, "arquivar")} className="inline-flex min-h-toque items-center gap-1 rounded-controle px-2 text-xs font-medium text-texto-suave hover:bg-superficie">
              <Archive className="size-3.5" aria-hidden /> Arquivar coluna
            </button>
            {props.podeExcluir && (
              <button onClick={() => props.aoLimpar(codigo, "excluir")} className="inline-flex min-h-toque items-center gap-1 rounded-controle px-2 text-xs font-medium text-alerta hover:bg-alerta-suave">
                <Trash2 className="size-3.5" aria-hidden /> Limpar coluna
              </button>
            )}
          </div>
        )}
      </header>
      <div className="rolagem-fina flex flex-col gap-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:p-0.5">
        {cards.length === 0 ? (
          <EstadoVazio titulo="Nenhum lead nesta etapa" />
        ) : (
          cards.map((c) => (
            <Card key={c.id} card={c} critico={criticos.has(c.id)} acoes={props.acoes} selecionando={props.selecionando} selecionado={props.selecionados.has(c.id)} aoSelecionar={props.aoSelecionar} />
          ))
        )}
      </div>
    </section>
  );
}

/** Título da coluna. Para o admin, o lápis ao lado troca o nome ali mesmo (Enter salva, Esc cancela; vazio volta ao nome de fábrica). */
function NomeDaColuna({ codigo, nome, podeRenomear, aoRenomear }: { codigo: CodigoEtapa; nome: string; podeRenomear: boolean; aoRenomear: (codigo: CodigoEtapa, nome: string) => Promise<void> }) {
  const avisar = useAviso();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nome);
  const [salvando, setSalvando] = useState(false);
  // O Enter já salvou: o desfoque que vem depois não pode salvar de novo.
  const encerrado = useRef(false);

  function comecar() {
    encerrado.current = false;
    setTexto(nome);
    setEditando(true);
  }

  async function salvar() {
    if (encerrado.current) return;
    encerrado.current = true;
    if (texto.trim() === nome) {
      setEditando(false);
      return;
    }
    setSalvando(true);
    try {
      await aoRenomear(codigo, texto);
      avisar("Nome da coluna salvo.");
      setEditando(false);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível salvar o nome.", "erro");
      encerrado.current = false;
    } finally {
      setSalvando(false);
    }
  }

  if (!editando) {
    return (
      <div className="flex items-center gap-1">
        <h2 className="font-semibold text-texto">{nome}</h2>
        {podeRenomear && (
          <button type="button" onClick={comecar} title="Editar o nome da coluna" aria-label={`Editar o nome da coluna ${nome}`} className="inline-flex size-6 shrink-0 items-center justify-center rounded-controle text-texto-fraco transition hover:bg-superficie hover:text-texto">
            <Pencil className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    );
  }
  return (
    <input
      autoFocus
      value={texto}
      maxLength={NOME_ETAPA_MAX}
      disabled={salvando}
      aria-label={`Novo nome da coluna ${nome}`}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => void salvar()}
      onKeyDown={(e) => {
        if (e.key === "Enter") void salvar();
        if (e.key === "Escape") {
          encerrado.current = true;
          setEditando(false);
        }
      }}
      className="w-full rounded-controle border border-marca bg-superficie px-2 py-0.5 text-base font-semibold text-texto focus:outline-none focus:ring-2 focus:ring-marca/30"
    />
  );
}
