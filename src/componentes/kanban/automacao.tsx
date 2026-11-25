"use client";
/* eslint-disable react-hooks/refs -- falso alarme com Floating UI: `refs.setReference`/`setFloating` são funções de callback (ref callback), não leitura de `.current` durante a renderização. */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Archive, Eye, EyeOff, Shield, TriangleAlert } from "lucide-react";
import { FloatingPortal, autoUpdate, flip, offset, safePolygon, shift, useDismiss, useFloating, useFocus, useHover, useInteractions, useRole, useTransitionStyles } from "@floating-ui/react";
import { categoriaDaPrevisao, formatarMomento, linhaDaPrevisao, previsaoDeJson, type CategoriaPrevisao, type CorPrevisao, type PrevisaoCard, type PrevisaoCardJson } from "@/regras/previsao-automacao";
import { ATRASO_DICA_MS } from "../dica";
import { juntar } from "../estilos";

// Acompanhamento da automação no kanban (tarefa 48), só para o admin: chips no cabeçalho da coluna, olho que mostra a linha
// em cada card e balão com a linha do tempo. Só mostra o que `regras/previsao-automacao.ts` calculou (as mesmas regras das rotinas).

export type PrevisoesDoKanban = Record<string, PrevisaoCardJson>;

export interface ItemDaAutomacao {
  previsao: PrevisaoCard;
  categoria: CategoriaPrevisao;
  cor: CorPrevisao;
}

/** Colunas que têm acompanhamento: IA atendendo (`novo`) e Perdido. */
export const COLUNAS_COM_AUTOMACAO = ["novo", "perdido"];

/** Datas em ISO viram `Date` uma vez só, quando a resposta da rota muda. */
export function usePrevisoes(json: PrevisoesDoKanban | undefined): Record<string, PrevisaoCard> | null {
  return useMemo(() => (json ? Object.fromEntries(Object.entries(json).map(([id, p]) => [id, previsaoDeJson(p)])) : null), [json]);
}

/** A categoria depende do dia de hoje, então é calculada na hora de mostrar (à meia-noite "hoje" vira "amanhã" sozinho). */
export function itensDaAutomacao(previsoes: Record<string, PrevisaoCard>, ids: string[], agora: Date): Map<string, ItemDaAutomacao> {
  const itens = new Map<string, ItemDaAutomacao>();
  for (const id of ids) {
    const previsao = previsoes[id];
    if (previsao) itens.set(id, { previsao, ...categoriaDaPrevisao(previsao, agora) });
  }
  return itens;
}

// ---------------------------------------------------------------- cores (só tokens)

const COR_CHIP: Record<CorPrevisao, string> = {
  alerta: "border-alerta/30 bg-alerta-suave text-alerta",
  aviso: "border-aviso/30 bg-aviso-suave text-aviso",
  neutra: "border-texto-suave/30 bg-superficie-suave text-texto-suave",
};
const COR_LINHA: Record<CorPrevisao, string> = {
  alerta: "bg-alerta-suave/70 text-alerta",
  aviso: "bg-aviso-suave/70 text-aviso",
  neutra: "bg-superficie-suave/30 text-texto-suave",
};
const COR_PONTO: Record<CorPrevisao, string> = { alerta: "bg-alerta", aviso: "bg-aviso", neutra: "bg-texto-suave" };

// ---------------------------------------------------------------- chips

interface DefinicaoChip {
  categoria: CategoriaPrevisao;
  cor: CorPrevisao;
  /** Sem texto, o chip mostra só o ícone e o número. */
  texto?: string;
  icone?: "alerta" | "escudo";
  dica: string;
}

const CHIPS: Record<string, DefinicaoChip[]> = {
  novo: [
    { categoria: "perdido_hoje", cor: "alerta", texto: "Perdido hoje", dica: "Vão para Perdido (ou para o arquivo, se forem pós-venda) hoje se não responderem" },
    { categoria: "msg_hoje", cor: "aviso", texto: "msg hoje", dica: "Recebem mensagem automática hoje" },
    { categoria: "travado", cor: "aviso", icone: "alerta", dica: "Travados: sem mensagem automática, só saem pela rede de segurança" },
    { categoria: "protegido", cor: "neutra", icone: "escudo", dica: "Sem automação: passou por consultor, visita marcada ou retorno marcado" },
  ],
  perdido: [
    { categoria: "arquiva_breve", cor: "alerta", texto: "arquiva em breve", dica: "Vão para o arquivo hoje ou amanhã" },
    { categoria: "arquiva_depois", cor: "neutra", texto: "depois", dica: "Vão para o arquivo daqui a mais de 2 dias" },
  ],
};

/** Quantos cards há em cada categoria. */
export function contarCategorias(itens: Map<string, ItemDaAutomacao>): Map<CategoriaPrevisao, number> {
  const mapa = new Map<CategoriaPrevisao, number>();
  for (const i of itens.values()) mapa.set(i.categoria, (mapa.get(i.categoria) ?? 0) + 1);
  return mapa;
}

/** Chips do cabeçalho da coluna: uma linha, chip com contagem 0 não aparece e, sem nenhum, a linha some. Clicar filtra a coluna; clicar de novo limpa. */
export function ChipsDaColuna({ coluna, contagem, ativo, aoEscolher }: { coluna: string; contagem: Map<CategoriaPrevisao, number>; ativo: CategoriaPrevisao | null; aoEscolher: (categoria: CategoriaPrevisao | null) => void }) {
  const visiveis = (CHIPS[coluna] ?? []).filter((c) => (contagem.get(c.categoria) ?? 0) > 0);
  if (!visiveis.length) return null;
  return (
    <div role="group" aria-label="Acompanhamento da automação" className="mt-2 flex flex-nowrap gap-[3px]">
      {visiveis.map((c) => {
        const marcado = ativo === c.categoria;
        const n = contagem.get(c.categoria) ?? 0;
        return (
          <button
            key={c.categoria}
            type="button"
            data-chip-automacao={c.categoria}
            aria-pressed={marcado}
            title={`${n} — ${c.dica}`}
            onClick={() => aoEscolher(marcado ? null : c.categoria)}
            className={juntar("inline-flex items-center gap-1 whitespace-nowrap rounded-pilula border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition hover:-translate-y-px", COR_CHIP[c.cor], marcado && "ring-2 ring-current")}
          >
            {c.icone === "alerta" ? <TriangleAlert className="size-[11px] shrink-0" aria-hidden /> : c.icone === "escudo" ? <Shield className="size-[11px] shrink-0" aria-hidden /> : <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
            <b>{n}</b>
            {c.texto && <span>{c.texto}</span>}
            {!c.texto && <span className="sr-only">{c.dica}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- olho

/** O olho de cada coluna começa desligado e guarda a escolha neste navegador (como as colunas recolhidas). */
export function useOlhoDaColuna(codigo: string): [boolean, () => void] {
  const chave = `automacao-visivel-${codigo}`;
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- só existe no navegador
      setLigado(localStorage.getItem(chave) === "1");
    } catch {
      /* sem armazenamento: começa desligado */
    }
  }, [chave]);
  const alternar = useCallback(() => {
    setLigado((atual) => {
      try {
        localStorage.setItem(chave, atual ? "0" : "1");
      } catch {
        /* o estado vale só nesta tela */
      }
      return !atual;
    });
  }, [chave]);
  return [ligado, alternar];
}

export function BotaoOlho({ ligado, aoAlternar, nome }: { ligado: boolean; aoAlternar: () => void; nome: string }) {
  const Icone = ligado ? Eye : EyeOff;
  const titulo = ligado ? "Esconder o acompanhamento da automação" : "Mostrar o acompanhamento da automação";
  return (
    <button
      type="button"
      data-olho-automacao
      aria-pressed={ligado}
      onClick={aoAlternar}
      title={titulo}
      aria-label={`${titulo} (${nome})`}
      className={juntar("inline-flex size-6 shrink-0 items-center justify-center rounded-controle transition", ligado ? "bg-marca-suave text-marca-texto" : "text-texto-fraco hover:bg-superficie hover:text-texto")}
    >
      <Icone className="size-3.5" aria-hidden />
    </button>
  );
}

// ---------------------------------------------------------------- linha do card e balão

/** Trilha de 3 marcas (1ª mensagem, 2ª mensagem, Perdido): feitas cheias em cinza, a atual na cor da categoria com um anel. */
function Trilha({ feitos, atual }: { feitos: number; atual: number }) {
  const marca = (i: number) => {
    const forma = i === 2 ? "size-2 rounded-[2px]" : "size-1.5 rounded-full";
    const estado = i === atual ? "border-current bg-current shadow-[0_0_0_2px_color-mix(in_srgb,currentColor_25%,transparent)]" : i < feitos ? "border-texto-fraco bg-texto-fraco" : "border-borda-forte bg-transparent";
    return <span key={i} className={juntar("box-border shrink-0 border-[1.5px]", forma, estado)} />;
  };
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center gap-[3px]">
      {marca(0)}
      <span className="h-[1.5px] w-[5px] bg-borda-forte" />
      {marca(1)}
      <span className="h-[1.5px] w-[5px] bg-borda-forte" />
      {marca(2)}
    </span>
  );
}

function useBalao() {
  const [aberto, setAberto] = useState(false);
  const { refs, floatingStyles, context } = useFloating({ open: aberto, onOpenChange: setAberto, placement: "bottom-start", whileElementsMounted: autoUpdate, middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })] });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { mouseOnly: true, delay: { open: ATRASO_DICA_MS, close: 120 }, handleClose: safePolygon() }),
    useFocus(context, { visibleOnly: true }),
    useDismiss(context),
    useRole(context, { role: "tooltip" }),
  ]);
  const { isMounted, styles } = useTransitionStyles(context, { duration: 160, initial: { opacity: 0, transform: "translateY(-4px)" } });
  return { refs, floatingStyles, getReferenceProps, getFloatingProps, isMounted, styles };
}

/** Balão "AUTOMAÇÃO DESTE LEAD": o que já foi feito em cinza e o próximo passo na cor da categoria, cada um com dia e hora. */
function ConteudoDoBalao({ item, agora }: { item: ItemDaAutomacao; agora: Date }) {
  const { passos, nota } = item.previsao;
  const proximo = passos.findIndex((p) => !p.feito);
  return (
    <>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-texto-suave">Automação deste lead</p>
      {passos.map((p, i) => (
        <div key={`${p.rotulo}-${i}`} className={juntar("flex items-center gap-2 py-[3px]", p.feito && "text-texto-suave")}>
          <span className={juntar("size-[7px] shrink-0 rounded-full", p.feito ? "bg-texto-fraco" : i === proximo ? COR_PONTO[item.cor] : "bg-texto")} aria-hidden />
          <span className="min-w-0 flex-1">{p.rotulo}</span>
          <span className="whitespace-nowrap tabular-nums">{!p.feito && p.quando.getTime() <= agora.getTime() ? "agora" : formatarMomento(p.quando, agora)}</span>
        </div>
      ))}
      {nota && <p className="mt-1.5 border-t border-borda pt-1.5 text-texto-suave">{nota}</p>}
    </>
  );
}

function LinhaComBalao({ item, agora }: { item: ItemDaAutomacao; agora: Date }) {
  const balao = useBalao();
  const linha = linhaDaPrevisao(item.previsao, agora);
  const Icone = linha.icone === "alerta" ? TriangleAlert : linha.icone === "escudo" ? Shield : Archive;
  return (
    <>
      <p
        ref={balao.refs.setReference}
        tabIndex={0}
        data-automacao-linha
        data-automacao-categoria={item.categoria}
        aria-label={`Automação: ${linha.rotulo}${linha.horario ? ` ${linha.horario}` : ""}`}
        className={juntar("flex cursor-help items-center gap-[7px] border-t border-dashed border-borda-forte/60 px-3 py-[5px] text-[11px] font-semibold tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca", COR_LINHA[item.cor])}
        {...balao.getReferenceProps()}
      >
        {linha.trilha ? <Trilha feitos={linha.trilha.feitos} atual={linha.trilha.atual} /> : <Icone className="size-3.5 shrink-0" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{linha.rotulo}</span>
        {linha.horario && <span className="shrink-0 opacity-85">{linha.horario}</span>}
      </p>
      {balao.isMounted && (
        <FloatingPortal>
          <div ref={balao.refs.setFloating} style={balao.floatingStyles} className="z-[60]" {...balao.getFloatingProps()}>
            <div style={balao.styles} className="w-60 max-w-full rounded-controle border border-borda-forte bg-superficie p-2.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-texto shadow-flutuante">
              <ConteudoDoBalao item={item} agora={agora} />
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/** Linha da automação do card. Fica escondida atrás do olho da coluna; com um chip escolhido, aparece nos cards que ele filtrou. */
export function LinhaAutomacao({ item, agora, visivel }: { item: ItemDaAutomacao; agora: Date; visivel: boolean }): ReactNode {
  const semMovimento = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {visivel && (
        <motion.div key="linha" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.16, ease: "easeOut" }} className="overflow-hidden">
          <LinhaComBalao item={item} agora={agora} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
