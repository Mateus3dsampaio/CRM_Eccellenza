"use client";

import { useMemo, useState } from "react";
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
import { CheckSquare, Filter, Search, Trash2, Archive, X } from "lucide-react";
import { CODIGOS_ETAPA, ETAPAS, ETAPAS_LIMPAVEIS, ETIQUETAS, nomeEtapa } from "@/regras/etapas";
import type { CardKanban } from "@/servicos/consultas";
import { chamarApi, useAviso, useDados } from "../dados";
import { COR_ETAPA, juntar } from "../estilos";
import { Botao, Carregando, EstadoErro, EstadoVazio, Modal, classeEntrada } from "../ui";
import { usePode } from "../usuario";
import { Card, CardFlutuante, type AcoesCard } from "./card";

function contagem(n: number) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "conversa" : "conversas"}`;
}

type Confirmacao = { titulo: string; texto: string; botao: string; perigo: boolean; executar: () => Promise<void> } | null;

export function Quadro() {
  const { dados, erro, carregando, recarregar, setDados } = useDados<{ cards: CardKanban[] }>("/api/kanban");
  const avisar = useAviso();
  const podeExcluir = usePode("excluir_lead");

  const [busca, setBusca] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [consultor, setConsultor] = useState("");
  const [cidade, setCidade] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [arrastado, setArrastado] = useState<CardKanban | null>(null);
  const [abaCelular, setAbaCelular] = useState<string>("novo");
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [executando, setExecutando] = useState(false);

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
        (!cidade || c.cidade === cidade),
    );
  }, [cards, busca, etiqueta, consultor, cidade]);

  const porEtapa = useMemo(() => {
    const mapa: Record<string, CardKanban[]> = Object.fromEntries(CODIGOS_ETAPA.map((e) => [e, []]));
    filtrados.forEach((c) => mapa[c.etapa]?.push(c));
    return mapa;
  }, [filtrados]);

  const filtrosAtivos = [etiqueta, consultor, cidade].filter(Boolean).length;

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
    // Atualiza na tela na hora; o servidor confirma em seguida.
    setDados((d) => (d ? { cards: d.cards.map((c) => (c.id === id ? { ...c, etapa } : c)) } : d));
    void acao({ acao: "mover", ids: [id], etapa }, `Movido para "${nomeEtapa(etapa)}".`);
  }

  function confirmarExclusao(ids: string[], depois?: () => void) {
    setConfirmacao({
      titulo: "Excluir de vez",
      texto: `Excluir ${ids.length} ${ids.length === 1 ? "lead" : "leads"}? Mensagens, fotos e plantas também serão apagadas. Não dá para desfazer.`,
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
  };

  function limparColuna(etapa: string, modo: "arquivar" | "excluir") {
    // Conta a coluna inteira, não só o que está no filtro: a limpeza vale para todos.
    const totalReal = cards.filter((c) => c.etapa === etapa).length;
    if (!totalReal) return avisar("A coluna já está vazia.");
    setConfirmacao({
      titulo: `Limpar "${nomeEtapa(etapa)}"`,
      texto:
        modo === "excluir"
          ? `Excluir ${totalReal} ${totalReal === 1 ? "lead" : "leads"}? Não dá para desfazer.`
          : `Arquivar ${totalReal} ${totalReal === 1 ? "lead" : "leads"}? Eles saem do kanban e podem ser restaurados em Arquivados por 30 dias.`,
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Barra de busca e filtros */}
      <div className="mx-auto w-full max-w-[1800px] space-y-3 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-semibold tracking-tight sm:mr-2">Atendimentos</h1>
          <div className="relative order-last min-w-0 basis-full sm:order-none sm:max-w-sm sm:flex-1 sm:basis-auto">
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
          <Botao onClick={() => setFiltrosAbertos((f) => !f)} aria-expanded={filtrosAbertos} icone={<Filter className="size-4" aria-hidden />}>
            Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ""}
          </Botao>
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
        {filtrosAbertos && (
          <div className="grid animate-surgir gap-2 rounded-card border border-borda bg-superficie p-3 shadow-painel sm:grid-cols-4">
            <select className={classeEntrada} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} aria-label="Filtrar por etiqueta">
              <option value="">Todas as etiquetas</option>
              {ETIQUETAS.map((e) => (
                <option key={e.codigo} value={e.codigo}>
                  {e.nome}
                </option>
              ))}
            </select>
            <select className={classeEntrada} value={consultor} onChange={(e) => setConsultor(e.target.value)} aria-label="Filtrar por consultor">
              <option value="">Todos os consultores</option>
              {consultores.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
            <select className={classeEntrada} value={cidade} onChange={(e) => setCidade(e.target.value)} aria-label="Filtrar por cidade">
              <option value="">Todas as cidades</option>
              {cidades.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
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
        )}
        {selecionando && (
          <div className="flex flex-wrap items-center gap-2 rounded-card bg-marca-suave p-2 pl-4 text-sm">
            <span className="font-medium text-marca">{selecionados.size} selecionado(s)</span>
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
            {ETAPAS.map((e) => (
              <AbaEtapa key={e.codigo} codigo={e.codigo} nome={e.nome} total={porEtapa[e.codigo].length} ativa={abaCelular === e.codigo} aoEscolher={() => setAbaCelular(e.codigo)} />
            ))}
          </div>

          <div className="rolagem-fina mx-auto flex w-full max-w-[1800px] flex-1 gap-4 overflow-x-auto p-4 md:items-start">
            {ETAPAS.map((e) => (
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
                aoLimpar={limparColuna}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>{arrastado ? <CardFlutuante card={arrastado} /> : null}</DragOverlay>
        </DndContext>
      )}

      <Modal aberto={!!confirmacao} aoFechar={() => setConfirmacao(null)} titulo={confirmacao?.titulo ?? ""} largura="max-w-md">
        <p className="text-sm text-texto-suave">{confirmacao?.texto}</p>
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
  aoLimpar: (etapa: string, modo: "arquivar" | "excluir") => void;
}) {
  const { codigo, nome, cards } = props;
  const { setNodeRef, isOver } = useDroppable({ id: codigo });
  const limpavel = (ETAPAS_LIMPAVEIS as string[]).includes(codigo);
  return (
    <section
      ref={setNodeRef}
      aria-label={nome}
      className={juntar(
        "w-full shrink-0 flex-col rounded-painel bg-coluna p-3 shadow-painel transition md:flex md:w-coluna",
        props.visivelCelular ? "flex" : "hidden",
        isOver && "bg-marca-suave ring-2 ring-marca/40",
      )}
    >
      <header className="px-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-texto">{nome}</h2>
            <p className="text-xs text-texto-fraco">
              {contagem(props.totalSemFiltro)}
              {cards.length !== props.totalSemFiltro && ` · ${cards.length} no filtro`}
            </p>
          </div>
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
      <div className="rolagem-fina flex flex-col gap-3 md:max-h-[calc(100dvh-15rem)] md:overflow-y-auto md:p-0.5">
        {cards.length === 0 ? (
          <EstadoVazio titulo="Nenhum lead nesta etapa" />
        ) : (
          cards.map((c) => (
            <Card key={c.id} card={c} acoes={props.acoes} selecionando={props.selecionando} selecionado={props.selecionados.has(c.id)} aoSelecionar={props.aoSelecionar} />
          ))
        )}
      </div>
    </section>
  );
}
