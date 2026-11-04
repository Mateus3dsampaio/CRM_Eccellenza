"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarCheck, CalendarClock, CircleDollarSign, Clock, Headset, LayoutGrid, MapPin, MessageCircle, MoreVertical, UserRound } from "lucide-react";
import { useNomesEtapas } from "../etapas";
import { formatarReais } from "@/regras/vendas";
import type { CardKanban } from "@/servicos/consultas";
import { juntar } from "../estilos";
import { Avatar, Etiqueta, Sino } from "../ui";
import { CLASSE_CARD_RETORNO, CLASSE_TEXTO_RETORNO, useSituacaoRetorno } from "../retornos";
import { CLASSE_CARD_ESPERA, CLASSE_TEXTO_ESPERA, useSituacaoEspera } from "../espera";
import { BolinhaNaoLidas } from "./bolinha";

export interface AcoesCard {
  mover: (id: string, etapa: string) => void;
  removerEtiqueta: (id: string, etiqueta: string) => void;
  arquivar: (id: string) => void;
  excluir?: (id: string) => void;
}

/** Valor mostrado no card: orçamento em Orçamento/Negociação, valor fechado em Fechado. Vazio nas outras etapas. */
function valorDoCard(card: CardKanban): string {
  if (card.etapa === "fechado") return card.valorFechado ? `Fechado ${formatarReais(card.valorFechado)}` : "";
  if (card.etapa === "apresentacao" || card.etapa === "negociacao") return card.valorOrcamento ? `Orçamento ${formatarReais(card.valorOrcamento)}` : "";
  return "";
}

/** Informações do card (KAN-02). */
export function ConteudoCard({ card }: { card: CardKanban }) {
  const espera = useSituacaoEspera(card.esperandoDesde);
  const retorno = useSituacaoRetorno(card.etapa, card.proximoContatoEm);
  return (
    <>
      <div className="flex items-start gap-3">
        <Avatar nome={card.nome} cor={card.avatarCor} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {/* Nome em até 2 linhas: é a informação mais importante do card. */}
            <p className="min-w-0 flex-1 break-words font-semibold leading-snug text-texto line-clamp-2">{card.nome}</p>
            <span className="flex shrink-0 items-center gap-1.5">
              {/* Quando o card já diz "esperando há X", o sino repetiria o aviso. */}
              {card.aguardandoHumano && !espera.esperando && <Sino />}
              <span className="text-xs text-texto-fraco">{card.horario}</span>
            </span>
          </div>
          {(card.previa || card.naoLidas > 0) && (
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-texto-suave">
              {card.previa && (
                <>
                  <MessageCircle className="size-3.5 shrink-0 fill-whatsapp text-whatsapp" aria-label="WhatsApp" />
                  <span className="truncate">{card.previa}</span>
                </>
              )}
              <span className="ml-auto pl-1">
                <BolinhaNaoLidas total={card.naoLidas} />
              </span>
            </div>
          )}

        </div>
      </div>
      {espera.esperando && (
        <p className={juntar("mt-2 flex items-center gap-1 text-xs font-medium", CLASSE_TEXTO_ESPERA[espera.faixa])}>
          <Clock className="size-3.5 shrink-0" aria-hidden />
          esperando há {espera.texto}
        </p>
      )}
      {valorDoCard(card) && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-pilula bg-superficie-suave px-2.5 py-0.5 text-xs font-semibold tabular-nums text-texto">
          <CircleDollarSign className="size-3.5" aria-hidden />
          {valorDoCard(card)}
        </p>
      )}
      {retorno && (
        <p className={juntar("mt-2 flex items-center gap-1 text-xs font-medium", CLASSE_TEXTO_RETORNO[retorno.situacao])}>
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate" title={card.lembreteNota ?? undefined}>
            Retorno {retorno.texto}
            {card.lembreteNota && <span className="font-normal text-texto-suave"> · {card.lembreteNota}</span>}
          </span>
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 pr-10 text-xs text-texto-suave">
        {card.cidade && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {card.cidade}
          </span>
        )}
        {card.ambientes.length > 0 && (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{card.ambientes.join(", ")}</span>
          </span>
        )}
        {card.investimento && (
          <span className="inline-flex items-center gap-1">
            <CircleDollarSign className="size-3.5" aria-hidden />
            {card.investimento}
          </span>
        )}
        {card.consultor ? (
          <span className="inline-flex items-center gap-1">
            <UserRound className="size-3.5" aria-hidden />
            {card.consultor.nome}
          </span>
        ) : card.modo !== "bot" ? (
          // Bot repassou e nenhum consultor estava disponível: o lead espera na fila até alguém ficar online.
          <span className="inline-flex items-center gap-1 rounded-pilula bg-aviso-suave px-2 py-0.5 font-medium text-aviso">
            <UserRound className="size-3.5" aria-hidden />
            Na fila – sem consultor
          </span>
        ) : null}
        {card.modo === "humano" && (
          <span className="inline-flex items-center gap-1 text-marca-texto">
            <Headset className="size-3.5" aria-hidden />
            Consultor na conversa
          </span>
        )}
      </div>
      {card.visita && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-pilula bg-sucesso-suave px-2.5 py-0.5 text-xs font-medium text-sucesso">
          <CalendarCheck className="size-3.5" aria-hidden />
          {card.visita}
        </p>
      )}
      {card.erroBot && (
        <p className="mr-10 mt-2 flex items-start gap-1.5 rounded-controle bg-alerta-suave px-2 py-1 text-xs text-alerta">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Bot sem resposta: {card.erroBot}
        </p>
      )}
    </>
  );
}

/** Versão do card que acompanha o ponteiro ao arrastar. */
export function CardFlutuante({ card }: { card: CardKanban }) {
  return (
    <div className="w-coluna rotate-2 rounded-card border border-borda bg-superficie p-3 shadow-flutuante">
      <ConteudoCard card={card} />
      {card.etiquetas.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {card.etiquetas.map((e) => (
            <Etiqueta key={e} codigo={e} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Card({
  card,
  acoes,
  selecionando,
  selecionado,
  aoSelecionar,
}: {
  card: CardKanban;
  acoes: AcoesCard;
  selecionando: boolean;
  selecionado: boolean;
  aoSelecionar: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, data: { etapa: card.etapa }, disabled: selecionando });
  const nomesEtapas = useNomesEtapas();
  const { faixa } = useSituacaoEspera(card.esperandoDesde);
  const retorno = useSituacaoRetorno(card.etapa, card.proximoContatoEm);
  // Menu "Mover para..." flutua por cima de tudo (posição fixa), para não ser cortado pela rolagem da coluna.
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const refBotao = useRef<HTMLButtonElement>(null);
  const refMenu = useRef<HTMLDivElement>(null);

  function posicaoDoMenu() {
    const r = refBotao.current!.getBoundingClientRect();
    const largura = 240;
    const altura = 470;
    const left = Math.max(8, Math.min(r.right - largura, window.innerWidth - largura - 8));
    const top = r.bottom + altura > window.innerHeight ? Math.max(8, r.top - altura) : r.bottom + 4;
    return { top, left };
  }

  function abrirMenu() {
    setMenu(menu ? null : posicaoDoMenu());
  }

  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent | TouchEvent) => {
      const alvo = e.target as Node;
      if (!refMenu.current?.contains(alvo) && !refBotao.current?.contains(alvo)) setMenu(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        refBotao.current?.focus();
      }
    };
    const fechar = () => setMenu(null);
    // Se a tela rolar, o menu acompanha o botão.
    const acompanhar = () => refBotao.current && setMenu(posicaoDoMenu());
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", fechar);
    document.addEventListener("scroll", acompanhar, true);
    refMenu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", fechar);
      document.removeEventListener("scroll", acompanhar, true);
    };
  }, [menu !== null]); // eslint-disable-line react-hooks/exhaustive-deps -- só ao abrir/fechar

  return (
    <motion.div
      layout="position"
      transition={{ duration: 0.18 }}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="group"
      aria-label={card.nome}
      data-card={card.id}
      aria-roledescription="card arrastável"
      className={juntar(
        "group relative select-none rounded-card border p-3 shadow-card transition-[box-shadow,transform,background-color,border-color] duration-150 hover:-translate-y-0.5 hover:shadow-card-hover",
        CLASSE_CARD_ESPERA[faixa],
        retorno && CLASSE_CARD_RETORNO[retorno.situacao],
        isDragging && "opacity-40",
        selecionado && "ring-2 ring-marca ring-offset-2 ring-offset-coluna",
      )}
    >
      {selecionando ? (
        <button type="button" onClick={() => aoSelecionar(card.id)} aria-pressed={selecionado} className="block w-full text-left">
          <span className="sr-only">{selecionado ? "Desmarcar" : "Selecionar"} </span>
          <ConteudoCard card={card} />
        </button>
      ) : (
        <Link href={`/lead/${card.id}`} draggable={false} className="block rounded-controle" aria-label={`Abrir ficha de ${card.nome}`}>
          <ConteudoCard card={card} />
        </Link>
      )}

      {card.etiquetas.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 pr-10">
          {card.etiquetas.map((e) => (
            <Etiqueta key={e} codigo={e} aoRemover={selecionando ? undefined : () => acoes.removerEtiqueta(card.id, e)} />
          ))}
        </div>
      )}

      {selecionando ? (
        <span
          aria-hidden
          className={juntar(
            "pointer-events-none absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full border-2 text-xs",
            selecionado ? "border-marca bg-marca text-sobre-marca" : "border-borda-forte bg-superficie",
          )}
        >
          {selecionado && "✓"}
        </span>
      ) : (
        <div className="absolute bottom-1 right-1" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <button
            ref={refBotao}
            type="button"
            onClick={abrirMenu}
            aria-haspopup="menu"
            aria-expanded={!!menu}
            aria-label={`Ações para ${card.nome}`}
            className="inline-flex size-toque items-center justify-center rounded-controle text-texto-fraco transition hover:bg-superficie-suave hover:text-texto"
          >
            <MoreVertical className="size-4" aria-hidden />
          </button>
          {menu &&
            createPortal(
              <div
                ref={refMenu}
                role="menu"
                aria-label={`Ações para ${card.nome}`}
                style={{ top: menu.top, left: menu.left }}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                  e.preventDefault();
                  const itens = [...(refMenu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
                  const i = itens.indexOf(document.activeElement as HTMLElement);
                  itens[(i + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length]?.focus();
                }}
                className="fixed z-50 w-60 animate-surgir rounded-controle border border-borda bg-superficie p-1 shadow-flutuante"
              >
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-texto-fraco">Mover para...</p>
                {nomesEtapas.lista.filter((e) => e.codigo !== card.etapa).map((e) => (
                  <button
                    key={e.codigo}
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      acoes.mover(card.id, e.codigo);
                    }}
                    className="block min-h-11 w-full rounded-controle px-3 text-left text-sm hover:bg-superficie-suave"
                  >
                    {e.nome}
                  </button>
                ))}
                <div className="my-1 border-t border-borda" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    acoes.arquivar(card.id);
                  }}
                  className="block min-h-11 w-full rounded-controle px-3 text-left text-sm hover:bg-superficie-suave"
                >
                  Arquivar
                </button>
                {acoes.excluir && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      acoes.excluir!(card.id);
                    }}
                    className="block min-h-11 w-full rounded-controle px-3 text-left text-sm text-alerta hover:bg-alerta-suave"
                  >
                    Excluir
                  </button>
                )}
              </div>,
              document.body,
            )}
        </div>
      )}
    </motion.div>
  );
}
