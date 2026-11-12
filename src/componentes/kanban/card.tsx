"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent as CliqueReact, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Bot, CalendarCheck, CalendarClock, CalendarX, Check, CircleDollarSign, Clock, Gavel, Headset, LayoutGrid, MapPin, MessageCircle, MoreVertical, Presentation, Reply, UserRound, type LucideIcon } from "lucide-react";
import { useNomesEtapas } from "../etapas";
import { formatarReaisCurto } from "@/regras/vendas";
import { formatarVisitaCurta } from "@/regras/tempo";
import { acoesDoCard, outrasPendencias, type AcaoCard, type CodigoAcao, type ContextoDaAcao, type CorAcao } from "@/regras/acao-card";
import type { CardKanban } from "@/servicos/consultas";
import { juntar } from "../estilos";
import { Avatar, Etiqueta, iniciais } from "../ui";
import { useAgoraDoServidor, useAguardando, useSituacaoEspera } from "../espera";
import { retornoObrigatorio, useRegrasVendas } from "../vendas/regras";
import { BolinhaNaoLidas } from "./bolinha";
import { RelogioJanela } from "./relogio-janela";
import { useGaveta } from "../ficha/gaveta";
import { useUsuario } from "../usuario";

export interface AcoesCard {
  mover: (id: string, etapa: string) => void;
  removerEtiqueta: (id: string, etiqueta: string) => void;
  arquivar: (id: string) => void;
  excluir?: (id: string) => void;
  /** Abre a janela de decisão (data vencida: medição, apresentação ou retorno da Negociação). */
  decidir?: (id: string) => void;
  /** Abre a agenda da apresentação (lead pronto para marcar). */
  marcarApresentacao?: (id: string) => void;
  /** "Cliente tem projeto: pular medição" (ou desfazer), só em Em qualificação. */
  pularMedicao?: (id: string, pular: boolean) => void;
  /** "Não precisa responder" (dispensar = true) ou "Precisa de resposta" (false): só quem pode enviar mensagem. */
  dispensarEspera?: (id: string, dispensar: boolean) => void;
}

/** Hora do servidor, prazos de espera e regra do retorno: o que a faixa de ação precisa para ser calculada. */
export function useContextoDaAcao(): ContextoDaAcao {
  const { prazos } = useAguardando();
  const agora = useAgoraDoServidor();
  const regras = useRegrasVendas();
  return useMemo(() => ({ agora, prazos, retornoObrigatorio: (etapa: string) => retornoObrigatorio(regras, etapa) }), [agora, prazos, regras]);
}

// Código de cores da faixa (tarefa 39): uma cor, um significado (regras/acao-card.ts). A cor nunca vai sozinha: a faixa sempre tem texto e ícone.
const CLASSE_FAIXA: Record<CorAcao, string> = {
  vermelho: "bg-alerta-suave text-alerta",
  ambar: "bg-aviso-suave text-aviso",
  azul: "bg-marca-suave text-marca-texto",
  verde: "bg-sucesso-suave text-sucesso",
  cinza: "bg-superficie-suave/55 font-medium text-texto-suave",
};
/** Faixa do card crítico (o que espera há mais tempo na coluna): vermelho cheio. */
const CLASSE_FAIXA_CRITICA = "bg-alerta text-sobre-cor";

const ICONE_ACAO: Record<CodigoAcao, LucideIcon> = {
  responder_atrasado: Clock,
  ia_travou: AlertTriangle,
  responder_atencao: Clock,
  na_fila: UserRound,
  decidir: Gavel,
  marcar_data: CalendarX,
  marcar_apresentacao: Presentation,
  retorno_atrasado: CalendarClock,
  definir_retorno: CalendarClock,
  responder: Clock,
  retorno_hoje: CalendarClock,
  compromisso: CalendarCheck,
  retorno_futuro: CalendarClock,
  cliente_respondeu: Reply,
  ia_atendendo: Bot,
  aguardando_cliente: MessageCircle,
};

/** Valor do card: orçamento em Apresentação/Negociação, valor fechado em Fechado. Vazio nas outras etapas. */
function valorDoCard(card: CardKanban): string {
  if (card.etapa === "fechado") return card.valorFechado ? `Fechado ${formatarReaisCurto(card.valorFechado)}` : "";
  if (card.etapa === "apresentacao" || card.etapa === "negociacao") return card.valorOrcamento ? formatarReaisCurto(card.valorOrcamento) : "";
  return "";
}

/** A faixa de ação: a pendência mais grave do lead, sempre no mesmo lugar. Com data vencida, vira o botão que abre a janela de decisão. */
function FaixaDeAcao({ card, acoes, critico, aoDecidir }: { card: CardKanban; acoes: AcaoCard[]; critico: boolean; aoDecidir?: () => void }) {
  const acao = acoes[0];
  if (!acao) return null;
  const Icone = ICONE_ACAO[acao.codigo];
  const outras = outrasPendencias(acoes);
  const classe = juntar("flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-semibold tabular-nums", critico && acao.cor === "vermelho" ? CLASSE_FAIXA_CRITICA : CLASSE_FAIXA[acao.cor]);
  const conteudo = (
    <>
      <Icone className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{acao.texto}</span>
      {outras > 0 && (
        <span className="shrink-0 rounded-md border border-current px-1 text-[11px] leading-4 opacity-85" title={`Mais ${outras} ${outras === 1 ? "pendência" : "pendências"}: ${acoes.slice(1).filter((a) => a.precisaDeVoce).map((a) => a.texto).join("; ")}`}>
          +{outras}
          <span className="sr-only"> {outras === 1 ? "pendência" : "pendências"}</span>
        </span>
      )}
    </>
  );
  if (acao.codigo === "decidir" && card.decisao && aoDecidir) {
    return (
      <button type="button" data-acao={acao.codigo} data-cor={acao.cor} onClick={aoDecidir} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} title={`Venceu em ${formatarVisitaCurta(new Date(card.decisao.venceuEm))}. Clique para decidir.`} className={juntar(classe, "transition hover:brightness-125")}>
        {conteudo}
      </button>
    );
  }
  return (
    <p data-acao={acao.codigo} data-cor={acao.cor} title={acao.dica} className={classe}>
      {conteudo}
    </p>
  );
}

/**
 * Informações do card, na ordem de prioridade aprovada (tarefa 39): 1) quem é; 2) o que fazer agora (faixa);
 * 3) última mensagem; 4) valor, cidade e ambientes; 5) rodapé (etiquetas, janela de 24h, consultor, menu).
 */
function ConteudoCard({
  card,
  acoes,
  critico = false,
  nome,
  direita,
  aoDecidir,
  aoMarcarApresentacao,
  aoRemoverEtiqueta,
  menu,
}: {
  card: CardKanban;
  acoes: AcaoCard[];
  critico?: boolean;
  /** O nome como link ou botão (o card inteiro também abre a ficha ao clicar). */
  nome?: ReactNode;
  /** Troca a hora/bolinha do topo (ex.: a marca de seleção). */
  direita?: ReactNode;
  aoDecidir?: () => void;
  /** Botão "Marcar apresentação" do lead pronto (some para quem não pode agendar para ele). */
  aoMarcarApresentacao?: () => void;
  aoRemoverEtiqueta?: (etiqueta: string) => void;
  menu?: ReactNode;
}) {
  const valor = valorDoCard(card);
  // Com orçamento no card, a faixa de investimento declarada pelo cliente já não acrescenta.
  const investimento = valor ? "" : (card.investimento ?? "");
  const ambientes = card.ambientes.join(", ");
  const temDetalhes = !!(valor || card.cidade || ambientes || investimento);
  const quemAtende = card.modo === "bot" ? { Icone: Bot, titulo: "IA atendendo" } : card.modo === "humano" ? { Icone: Headset, titulo: "Consultor na conversa" } : null;
  return (
    <>
      <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        <span className="relative shrink-0">
          <Avatar nome={card.nome} cor={card.avatarCor} tamanho="sm" />
          {quemAtende && (
            <span title={quemAtende.titulo} className="absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-superficie-suave text-texto ring-2 ring-superficie">
              <quemAtende.Icone className="size-2.5" aria-hidden />
              <span className="sr-only">{quemAtende.titulo}</span>
            </span>
          )}
        </span>
        {/* Nome inteiro, em até 2 linhas: é a informação mais importante do card. */}
        <p className="line-clamp-2 min-w-0 flex-1 break-words font-semibold leading-snug text-texto" title={card.nome}>
          {nome ?? card.nome}
        </p>
        {direita ?? (card.naoLidas > 0 ? <BolinhaNaoLidas total={card.naoLidas} /> : <span className="shrink-0 text-[11px] tabular-nums text-texto-fraco">{card.horario}</span>)}
      </div>
      <FaixaDeAcao card={card} acoes={acoes} critico={critico} aoDecidir={aoDecidir} />
      {card.pronto && aoMarcarApresentacao && (
        <div className="px-3 pt-2">
          <button
            type="button"
            data-marcar-apresentacao
            onClick={aoMarcarApresentacao}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-controle bg-etapa-apresentacao px-3 text-sm font-semibold text-sobre-cor shadow-card transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5"
          >
            <Presentation className="size-4" aria-hidden />
            Marcar apresentação
          </button>
        </div>
      )}
      {card.previa && <p className="line-clamp-2 break-words px-3 pt-2 text-sm text-texto-suave">{card.previa}</p>}
      {temDetalhes && (
        // Cada dado com seu ícone, sem cortar (pedido do Mateus 10/11/2026): quando não cabe na linha, o dado desce e o card cresce.
        <p className="flex flex-wrap items-start gap-x-2.5 gap-y-0.5 px-3 pt-1.5 text-xs text-texto-fraco">
          {valor && <b className="font-semibold tabular-nums text-texto">{valor}</b>}
          {card.cidade && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {card.cidade}
            </span>
          )}
          {investimento && (
            <span className="inline-flex items-center gap-1">
              <CircleDollarSign className="size-3.5 shrink-0" aria-hidden />
              {investimento}
            </span>
          )}
          {ambientes && (
            // Lista de ambientes muito longa para em 3 linhas; a dica mostra todos.
            <span className="inline-flex min-w-0 items-start gap-1" title={ambientes}>
              <LayoutGrid className="mt-px size-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-3 break-words">{ambientes}</span>
            </span>
          )}
        </p>
      )}
      {/* Etiquetas numa linha própria (quando existem), para o rodapé nunca mudar de formato. */}
      {card.etiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
          {card.etiquetas.map((e) => (
            <Etiqueta key={e} codigo={e} aoRemover={aoRemoverEtiqueta ? () => aoRemoverEtiqueta(e) : undefined} />
          ))}
        </div>
      )}
      {/* Rodapé com lugares fixos: anel da janela sempre no canto esquerdo, iniciais do consultor sempre no canto direito. */}
      <div className="flex min-h-10 items-center justify-between gap-1.5 px-3 pb-2 pt-1.5">
        <span className="shrink-0">
          <RelogioJanela etapa={card.etapa} ultimaMsgClienteEm={card.ultimaMsgClienteEm} />
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          {card.consultor && (
            <span title={`Consultor: ${card.consultor.nome}`} className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-superficie-suave text-[10px] font-bold text-texto-suave">
              <span aria-hidden>{iniciais(card.consultor.nome)}</span>
              <span className="sr-only">Consultor: {card.consultor.nome}</span>
            </span>
          )}
          {menu}
        </span>
      </div>
    </>
  );
}

/** Versão do card que acompanha o ponteiro ao arrastar. */
export function CardFlutuante({ card }: { card: CardKanban }) {
  const ctx = useContextoDaAcao();
  return (
    <div className="w-coluna rotate-2 overflow-hidden rounded-card border border-borda bg-superficie shadow-flutuante">
      <ConteudoCard card={card} acoes={acoesDoCard(card, ctx)} />
    </div>
  );
}

export function Card({
  card,
  pendencias,
  acoes,
  selecionando,
  selecionado,
  aoSelecionar,
  critico = false,
  celebrar = false,
}: {
  card: CardKanban;
  /** Pendências do lead, da mais grave à menos grave (regras/acao-card.ts); a primeira vira a faixa. */
  pendencias: AcaoCard[];
  acoes: AcoesCard;
  selecionando: boolean;
  selecionado: boolean;
  aoSelecionar: (id: string) => void;
  /** O que espera há mais tempo na coluna: único que pulsa, com a faixa em vermelho cheio (tarefa 39). */
  critico?: boolean;
  /** O card acabou de entrar na coluna Apresentação: aro e brilho curtos na cor da etapa. */
  celebrar?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, data: { etapa: card.etapa }, disabled: selecionando });
  const nomesEtapas = useNomesEtapas();
  const { faixa } = useSituacaoEspera(card.esperandoDesde);
  const gaveta = useGaveta();
  const router = useRouter();
  const usuario = useUsuario();
  const semMovimento = useReducedMotion();
  // O vendedor marca a apresentação dos leads dele (ou sem dono); o admin, de todos.
  const podeMarcar = !!acoes.marcarApresentacao && (usuario.perfil === "admin" || !card.consultor || card.consultor.id === usuario.id);
  const abertoNaGaveta = gaveta.aberto === card.id;
  // Menu "Mover para..." flutua por cima de tudo (posição fixa), para não ser cortado pela rolagem da coluna.
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const refBotao = useRef<HTMLButtonElement>(null);
  const refMenu = useRef<HTMLDivElement>(null);

  function posicaoDoMenu() {
    const r = refBotao.current!.getBoundingClientRect();
    const largura = 240;
    const altura = 540;
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

  const href = gaveta.hrefDe(card.id);
  /** O card inteiro abre a ficha (ou marca, no modo de seleção); links, botões e o menu cuidam do próprio clique. */
  function aoClicarNoCard(e: CliqueReact<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("a,button,[role=menu]")) return;
    if (selecionando) aoSelecionar(card.id);
    else if (gaveta.aberto !== null) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  return (
    <motion.div
      layout="position"
      transition={{ duration: 0.18 }}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      animate={celebrar && !semMovimento ? { scale: [1, 1.035, 1] } : { scale: 1 }}
      role="group"
      aria-label={card.nome}
      data-card={card.id}
      data-espera={faixa}
      data-critico={critico || undefined}
      aria-roledescription="card arrastável"
      onClick={aoClicarNoCard}
      className={juntar(
        "group relative shrink-0 cursor-pointer select-none overflow-hidden rounded-card border bg-superficie transition-[box-shadow,transform,border-color] duration-150 hover:-translate-y-0.5",
        // Só o card crítico pulsa; nada mais no card pisca (tarefa 39). Halo vermelho parado por fora e brilho de dentro pulsando só com opacidade (pulso-critico, globals.css).
        critico ? "border-alerta-vivo shadow-critico pulso-critico" : "border-borda shadow-card hover:border-borda-forte hover:shadow-card-hover",
        isDragging && "opacity-40",
        selecionado && "ring-2 ring-marca ring-offset-2 ring-offset-coluna",
        // Card aberto na gaveta: nível "selecionado" (docs/design.md).
        abertoNaGaveta && "ring-2 ring-marca shadow-card-hover",
      )}
    >
      {celebrar && (
        <motion.span aria-hidden data-chegada className="brilho-chegada pointer-events-none absolute inset-0 z-10 rounded-card" initial={{ opacity: 0 }} animate={{ opacity: semMovimento ? [0, 1, 1, 0] : [0, 1, 1, 0] }} transition={{ duration: semMovimento ? 1.2 : 2.4, times: [0, 0.15, 0.65, 1] }} />
      )}
      <ConteudoCard
        card={card}
        acoes={pendencias}
        critico={critico}
        nome={
          selecionando ? (
            <button type="button" onClick={() => aoSelecionar(card.id)} aria-pressed={selecionado} className="rounded-controle text-left">
              <span className="sr-only">{selecionado ? "Desmarcar" : "Selecionar"} </span>
              {card.nome}
            </button>
          ) : (
            <Link href={href} replace={gaveta.aberto !== null} scroll={false} draggable={false} className="rounded-controle" aria-label={`Abrir ficha de ${card.nome}`}>
              {card.nome}
            </Link>
          )
        }
        direita={
          selecionando ? (
            <span aria-hidden className={juntar("inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2", selecionado ? "border-marca bg-marca text-sobre-marca" : "border-borda-forte bg-superficie")}>
              {selecionado && <Check className="size-3.5" />}
            </span>
          ) : undefined
        }
        aoDecidir={selecionando || !acoes.decidir ? undefined : () => acoes.decidir!(card.id)}
        aoMarcarApresentacao={selecionando || !podeMarcar ? undefined : () => acoes.marcarApresentacao!(card.id)}
        aoRemoverEtiqueta={selecionando ? undefined : (e) => acoes.removerEtiqueta(card.id, e)}
        menu={
          selecionando ? undefined : (
            <span className="-my-2 -mr-2 inline-flex md:absolute md:right-1.5 md:top-2 md:m-0" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {/* No computador o menu só aparece com o mouse no card (ou com o foco do teclado), por cima da hora, sem ocupar lugar no rodapé; no celular fica sempre à vista, no rodapé. */}
              <button
                ref={refBotao}
                type="button"
                onClick={abrirMenu}
                aria-haspopup="menu"
                aria-expanded={!!menu}
                aria-label={`Ações para ${card.nome}`}
                className={juntar(
                  "inline-flex size-toque items-center justify-center rounded-controle text-texto-fraco transition hover:bg-superficie-suave hover:text-texto focus-visible:opacity-100 md:size-7 md:bg-superficie-suave md:text-texto md:shadow-card md:group-hover:opacity-100",
                  menu ? "bg-superficie-suave text-texto" : "md:opacity-0",
                )}
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
                    <p className="px-3 py-2 rotulo-secao">Mover para...</p>
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
                    {acoes.pularMedicao && card.etapa === "qualificacao" && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenu(null);
                          acoes.pularMedicao!(card.id, !card.pulouMedicao);
                        }}
                        className="block min-h-11 w-full rounded-controle px-3 py-1.5 text-left text-sm hover:bg-superficie-suave"
                      >
                        {card.pulouMedicao ? "Desfazer: cliente tem projeto" : "Cliente tem projeto: pular medição"}
                        {!card.pulouMedicao && card.temPlanta && <span className="block text-xs text-texto-fraco">A ficha já tem planta gravada</span>}
                      </button>
                    )}
                    {acoes.dispensarEspera && card.etapa !== "perdido" && card.esperandoDesde && (
                      <button
                        role="menuitem"
                        data-nao-precisa-responder
                        onClick={() => {
                          setMenu(null);
                          acoes.dispensarEspera!(card.id, true);
                        }}
                        className="block min-h-11 w-full rounded-controle px-3 py-1.5 text-left text-sm hover:bg-superficie-suave"
                      >
                        Não precisa responder
                        <span className="block text-xs text-texto-fraco">Para o cronômetro; o card não some</span>
                      </button>
                    )}
                    {acoes.dispensarEspera && !card.esperandoDesde && card.respondeuSemEsperaEm && card.etapa !== "perdido" && card.etapa !== "fechado" && (
                      <button
                        role="menuitem"
                        data-precisa-de-resposta
                        onClick={() => {
                          setMenu(null);
                          acoes.dispensarEspera!(card.id, false);
                        }}
                        className="block min-h-11 w-full rounded-controle px-3 py-1.5 text-left text-sm hover:bg-superficie-suave"
                      >
                        Precisa de resposta
                        <span className="block text-xs text-texto-fraco">O cliente está esperando você</span>
                      </button>
                    )}
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
            </span>
          )
        }
      />
    </motion.div>
  );
}
