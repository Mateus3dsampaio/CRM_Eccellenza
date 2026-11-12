"use client";

import { Presentation } from "lucide-react";
import { useState } from "react";
import { META_MAXIMA, type MetasApresentacao } from "@/regras/apresentacao";
import { chamarApi, useAviso } from "../dados";
import { Botao, classeEntrada } from "../ui";
import type { Membro } from "./equipe";

/**
 * Meta mensal de apresentações REALIZADAS de cada vendedor (só admin). Sem valor padrão: campo vazio = sem meta, e o
 * quadro mostra só a contagem. A meta aparece no cabeçalho da coluna Apresentação agendada.
 */
export function MetasApresentacaoConfig({ equipe, metas, recarregar }: { equipe: Membro[]; metas: MetasApresentacao; recarregar: () => Promise<void> }) {
  const avisar = useAviso();
  const consultores = equipe.filter((u) => u.perfil === "consultor" && u.ativo);
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(consultores.map((c) => [c.id, metas[c.id] ? String(metas[c.id]) : ""])));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const corpo = Object.fromEntries(consultores.map((c) => [c.id, valores[c.id]?.trim() ? Number(valores[c.id]) : null]));
      await chamarApi("/api/configuracoes/metas-apresentacao", { method: "PUT", json: { metas: corpo } });
      avisar("Metas salvas.");
      await recarregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível salvar as metas.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="mt-6 rounded-painel border border-borda bg-superficie p-5 luz-marca-fio" aria-label="Meta de apresentações">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Presentation className="size-4 text-texto-suave" aria-hidden /> Meta de apresentações por mês
      </h2>
      <p className="mb-3 text-sm text-texto-suave">
        Quantas apresentações realizadas (cliente veio ou fechou) cada vendedor deve fazer por mês. Aparece no topo da coluna Apresentação agendada, só para o próprio vendedor. Deixe vazio para ficar sem meta (o quadro mostra só a contagem).
      </p>
      {consultores.length === 0 ? (
        <p className="text-sm text-texto-fraco">Nenhum consultor ativo.</p>
      ) : (
        <ul className="divide-y divide-borda">
          {consultores.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
              <label htmlFor={`meta-${c.id}`} className="font-medium">
                {c.nome}
              </label>
              <span className="inline-flex items-center gap-2">
                <input
                  id={`meta-${c.id}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={META_MAXIMA}
                  step={1}
                  value={valores[c.id] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                  placeholder="sem meta"
                  className={`${classeEntrada} w-28 text-right tabular-nums`}
                />
                <span className="whitespace-nowrap text-xs text-texto-fraco">por mês</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end">
        <Botao variante="primario" carregando={salvando} onClick={salvar} disabled={consultores.length === 0}>
          Salvar metas
        </Botao>
      </div>
    </section>
  );
}
