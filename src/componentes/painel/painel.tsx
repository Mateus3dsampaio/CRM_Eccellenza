"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatarData } from "@/regras/tempo";
import { useDados } from "../dados";
import { juntar } from "../estilos";
import { Carregando, EstadoErro } from "../ui";

interface DadosPainel {
  periodo: "semana" | "mes";
  inicio: string;
  indicadores: { tipo: string; nome: string; atual: number; anterior: number }[];
  funil: { tipo: string; nome: string; total: number }[];
  visitasPorConsultor: { nome: string; total: number }[];
}

function taxa(a: number, b: number) {
  if (!b) return "–";
  return `${Math.round((a / b) * 100).toLocaleString("pt-BR")}%`;
}

// Painel de métricas (MET-01/02), feito só com contadores anônimos (MET-03).
export function Painel() {
  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana");
  const { dados, erro, carregando, recarregar } = useDados<DadosPainel>(`/api/painel?periodo=${periodo}`);
  const maiorFunil = Math.max(1, ...(dados?.funil.map((f) => f.total) ?? [1]));
  const maiorConsultor = Math.max(1, ...(dados?.visitasPorConsultor.map((c) => c.total) ?? [1]));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Painel</h1>
        <div className="flex rounded-controle bg-superficie p-1 shadow-card" role="tablist" aria-label="Período">
          {(["semana", "mes"] as const).map((p) => (
            <button key={p} role="tab" aria-selected={periodo === p} onClick={() => setPeriodo(p)} className={juntar("min-h-toque rounded-controle px-4 text-sm font-medium", periodo === p ? "bg-marca text-sobre-marca" : "text-texto-suave")}>
              {p === "semana" ? "Esta semana" : "Este mês"}
            </button>
          ))}
        </div>
        {dados && <p className="text-sm text-texto-suave">desde {formatarData(new Date(dados.inicio))} · comparação com o período anterior</p>}
      </div>

      {carregando && !dados ? (
        <Carregando linhas={3} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : dados ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {dados.indicadores.map((i) => {
              const diferenca = i.atual - i.anterior;
              return (
                <div key={i.tipo} className="rounded-painel border border-borda bg-superficie p-4 shadow-painel">
                  <p className="text-sm text-texto-suave">{i.nome}</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">{i.atual.toLocaleString("pt-BR")}</p>
                  <p className={juntar("mt-1 inline-flex items-center gap-1 text-xs", diferenca > 0 ? "text-sucesso" : diferenca < 0 ? "text-alerta" : "text-texto-fraco")}>
                    {diferenca > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : diferenca < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                    {i.anterior.toLocaleString("pt-BR")} no período anterior
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <section className="rounded-painel border border-borda bg-superficie p-4 shadow-painel">
              <h2 className="font-semibold">Funil</h2>
              <p className="mb-4 text-xs text-texto-fraco">Leads que chegaram a cada etapa no período e a conversão entre etapas.</p>
              <ol className="space-y-3">
                {dados.funil.map((f, i) => (
                  <li key={f.tipo}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{f.nome}</span>
                      <span className="tabular-nums">
                        {f.total.toLocaleString("pt-BR")}
                        {i > 0 && <span className="ml-2 text-xs text-texto-suave">{taxa(f.total, dados.funil[i - 1].total)} da etapa anterior</span>}
                      </span>
                    </div>
                    <div className="h-3 rounded-pilula bg-superficie-suave">
                      <div className="h-3 rounded-pilula bg-marca transition-[width] duration-300" style={{ width: `${(f.total / maiorFunil) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            <section className="rounded-painel border border-borda bg-superficie p-4 shadow-painel">
              <h2 className="mb-4 font-semibold">Visitas agendadas por consultor</h2>
              <ul className="space-y-3">
                {dados.visitasPorConsultor.map((c) => (
                  <li key={c.nome}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{c.nome}</span>
                      <span className="tabular-nums font-medium">{c.total}</span>
                    </div>
                    <div className="h-3 rounded-pilula bg-superficie-suave">
                      <div className="h-3 rounded-pilula bg-etapa-visita transition-[width] duration-300" style={{ width: `${(c.total / maiorConsultor) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-texto-fraco">Os números são contadores anônimos gravados na hora de cada evento: excluir leads não muda o painel.</p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
