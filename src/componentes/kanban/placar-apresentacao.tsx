"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { animate, motion, useAnimationControls, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { CalendarClock, Flag, Target } from "lucide-react";
import { placarVisto, progressoDaMeta, ritmoDaMeta } from "@/regras/apresentacao";
import type { PlacarDoMes } from "@/servicos/apresentacoes";
import { useDados } from "../dados";
import { juntar } from "../estilos";
import { useUsuario } from "../usuario";

/** Número que sobe até o valor novo (sem animar na primeira exibição; com "reduzir movimento", troca direto). */
function Contador({ valor, className }: { valor: number; className?: string }) {
  const semMovimento = useReducedMotion();
  const mv = useMotionValue(valor);
  const texto = useTransform(mv, (v) => String(Math.round(v)));
  const pulo = useAnimationControls();
  const anterior = useRef(valor);
  useEffect(() => {
    if (anterior.current === valor) return;
    anterior.current = valor;
    if (semMovimento) {
      mv.set(valor);
      return;
    }
    void pulo.start({ scale: [1, 1.14, 1], transition: { duration: 0.5 } });
    const controle = animate(mv, valor, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
    return () => controle.stop();
  }, [valor, semMovimento, mv, pulo]);
  return (
    <motion.span className={juntar("inline-block", className)} animate={pulo}>
      <motion.span>{texto}</motion.span>
    </motion.span>
  );
}

/** Anel de progresso da meta. O traço cresce com `pathLength` (só desenho, sem layout). */
function Anel({ progresso, batida }: { progresso: number; batida: boolean }) {
  const semMovimento = useReducedMotion();
  return (
    <svg viewBox="0 0 44 44" className="size-12 shrink-0 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" className="stroke-borda" />
      <motion.circle
        cx="22"
        cy="22"
        r="18"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className={batida ? "stroke-sucesso" : "stroke-etapa-apresentacao"}
        initial={{ pathLength: semMovimento ? progresso : 0 }}
        animate={{ pathLength: progresso }}
        transition={{ duration: semMovimento ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

/**
 * Placar no topo da coluna Apresentação agendada: apresentações REALIZADAS no mês contra a meta, as agendadas, o ritmo
 * e o atalho dos leads prontos para marcar. Consultor vê só o dele; o admin vê a soma da loja ou o vendedor escolhido no quadro.
 */
export function PlacarApresentacao({ vendedorEscolhido, prontos, soProntos, aoAlternarProntos }: { vendedorEscolhido: string | null; prontos: number; soProntos: boolean; aoAlternarProntos: () => void }) {
  const usuario = useUsuario();
  const ehAdmin = usuario.perfil === "admin";
  const { dados } = useDados<PlacarDoMes>("/api/apresentacoes");

  const visto = dados ? placarVisto(dados.contagens, dados.metas, dados.vendedores.map((v) => v.id), ehAdmin ? vendedorEscolhido : null) : null;
  const meta = visto?.meta ?? null;
  const ritmo = visto && meta ? ritmoDaMeta(visto.realizadas, meta, dados!.diasRestantes) : null;
  const quem = ehAdmin ? (vendedorEscolhido ? (dados?.vendedores.find((v) => v.id === vendedorEscolhido)?.nome ?? "") : "loja toda") : "";

  return (
    <div className="mt-3 space-y-2.5" data-placar-apresentacao>
      <div className="flex items-center gap-3 rounded-controle bg-superficie/60 px-3 py-2.5 shadow-card ring-1 ring-etapa-apresentacao/25">
        {visto && meta ? <Anel progresso={progressoDaMeta(visto.realizadas, meta)} batida={!!ritmo?.batida} /> : <Target className="size-8 shrink-0 text-etapa-apresentacao" aria-hidden />}
        <div className="min-w-0 flex-1">
          {visto ? (
            <>
              <p className="flex flex-wrap items-baseline gap-x-1 leading-tight" aria-label={meta ? `${visto.realizadas} de ${meta} apresentações em ${dados!.nomeDoMes}` : `${visto.realizadas} apresentações em ${dados!.nomeDoMes}`}>
                <Contador valor={visto.realizadas} className="text-2xl font-bold tabular-nums text-texto" />
                {meta && <span className="text-sm font-semibold text-texto-suave">de {meta}</span>}
              </p>
              <p className="text-xs text-texto-suave">
                {meta ? "apresentações" : visto.realizadas === 1 ? "apresentação realizada" : "apresentações realizadas"} em {dados!.nomeDoMes}
                {quem && <span className="text-texto-fraco"> · {quem}</span>}
              </p>
            </>
          ) : (
            <p className="text-xs text-texto-fraco">Carregando o placar…</p>
          )}
        </div>
      </div>

      {visto && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-0.5">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pilula bg-superficie-suave px-2 py-1 text-xs font-medium text-texto-suave" title="Apresentações do mês de hoje em diante, mais as vencidas que ainda esperam decisão">
            <CalendarClock className="size-3.5" aria-hidden />
            <Contador valor={visto.agendadas} className="tabular-nums" />
            <span>{visto.agendadas === 1 ? "agendada" : "agendadas"}</span>
          </span>
          {ritmo && (
            <p className={juntar("flex min-w-0 items-center gap-1.5 text-xs font-medium", ritmo.batida ? "text-sucesso" : "text-texto-suave")}>
              <Flag className="size-3.5 shrink-0" aria-hidden />
              {ritmo.texto}
            </p>
          )}
        </div>
      )}
      {visto && !meta && ehAdmin && (
        <Link href="/configuracoes?secao=equipe" className="inline-flex items-center gap-1.5 rounded-controle px-1 text-xs font-semibold text-marca-texto underline-offset-2 hover:underline">
          <Target className="size-3.5" aria-hidden /> Definir meta
        </Link>
      )}

      <button
        type="button"
        onClick={aoAlternarProntos}
        aria-pressed={soProntos}
        disabled={prontos === 0 && !soProntos}
        data-prontos
        className={juntar(
          "flex min-h-toque w-full items-center justify-between gap-2 rounded-controle px-3 text-left text-sm font-semibold transition disabled:cursor-default disabled:opacity-60",
          soProntos ? "bg-aviso text-sobre-cor shadow-card" : prontos > 0 ? "bg-aviso-suave text-aviso hover:brightness-125" : "bg-superficie-suave/60 text-texto-fraco",
        )}
        title={soProntos ? "Mostrar o quadro inteiro de novo" : "Mostrar só os leads prontos para marcar a apresentação"}
      >
        <span>
          <span className="tabular-nums">{prontos}</span> {prontos === 1 ? "lead pronto" : "leads prontos"} para apresentação
        </span>
        <span className="shrink-0 text-xs font-medium">{soProntos ? "Ver todos" : prontos > 0 ? "Ver" : ""}</span>
      </button>
    </div>
  );
}
