"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { juntar } from "../estilos";

// Calendário de um mês para escolher o dia (datas como "AAAA-MM-DD", sem fuso: é só o dia do calendário).
const NOMES_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const INICIAIS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function partesChave(chave: string) {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return { ano, mes, dia };
}

export function montarChave(ano: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function somarDiasChave(chave: string, dias: number): string {
  const { ano, mes, dia } = partesChave(chave);
  return montarChave(ano, mes, dia + dias);
}

export function diaSemanaChave(chave: string): number {
  const { ano, mes, dia } = partesChave(chave);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function Calendario({
  mes,
  aoMudarMes,
  selecionado,
  aoEscolher,
  minimo,
  maximo,
  hoje,
  fechado,
}: {
  /** Primeiro dia do mês visível ("AAAA-MM-01"). */
  mes: string;
  aoMudarMes: (mes: string) => void;
  selecionado: string | null;
  aoEscolher: (dia: string) => void;
  minimo: string;
  maximo: string;
  hoje?: string;
  /** Dia em que a loja não abre (não dá para escolher). */
  fechado: (diaSemana: number) => boolean;
}) {
  const { ano, mes: m } = partesChave(mes);
  const vazios = diaSemanaChave(mes);
  const totalDias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const anterior = montarChave(ano, m - 1, 1);
  const seguinte = montarChave(ano, m + 1, 1);
  const podeVoltar = montarChave(ano, m, 0) >= minimo;
  const podeAvancar = seguinte <= maximo;

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => aoMudarMes(anterior)} disabled={!podeVoltar} aria-label="Mês anterior" className="inline-flex size-9 items-center justify-center rounded-controle text-texto-suave transition hover:bg-superficie-suave disabled:opacity-30 disabled:hover:bg-transparent">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <p className="text-sm font-semibold" aria-live="polite">
          {NOMES_MESES[m - 1][0].toUpperCase() + NOMES_MESES[m - 1].slice(1)} de {ano}
        </p>
        <button onClick={() => aoMudarMes(seguinte)} disabled={!podeAvancar} aria-label="Próximo mês" className="inline-flex size-9 items-center justify-center rounded-controle text-texto-suave transition hover:bg-superficie-suave disabled:opacity-30 disabled:hover:bg-transparent">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Escolha o dia">
        {INICIAIS.map((l, i) => (
          <span key={i} className="pb-1 text-xs font-medium text-texto-fraco">
            {l}
          </span>
        ))}
        {Array.from({ length: vazios }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: totalDias }, (_, i) => {
          const chave = montarChave(ano, m, i + 1);
          const bloqueado = chave < minimo || chave > maximo || fechado(diaSemanaChave(chave));
          const ativo = chave === selecionado;
          return (
            <button
              key={chave}
              onClick={() => aoEscolher(chave)}
              disabled={bloqueado}
              aria-pressed={ativo}
              aria-label={`${i + 1} de ${NOMES_MESES[m - 1]}${bloqueado ? " (indisponível)" : ""}`}
              className={juntar(
                "relative flex h-9 items-center justify-center rounded-controle text-sm tabular-nums transition",
                ativo ? "bg-marca font-semibold text-sobre-marca shadow-sm" : "hover:bg-superficie-suave",
                bloqueado && "text-texto-fraco/50 line-through decoration-texto-fraco/30 hover:bg-transparent",
                chave === hoje && !ativo && "font-semibold text-marca",
              )}
            >
              {i + 1}
              {chave === hoje && <span className={juntar("absolute bottom-1 size-1 rounded-full", ativo ? "bg-sobre-marca" : "bg-marca")} aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
