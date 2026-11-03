"use client";

import { Gauge } from "lucide-react";
import { LIMITE_POR_DIA, LIMITE_POR_MINUTO } from "@/regras/limite-bot";
import { useDados } from "../dados";

interface Uso {
  dias: number;
  chamadas: number;
  entrada: number;
  saida: number;
  cacheLeitura: number;
  cacheEscrita: number;
}

const numero = (n: number) => n.toLocaleString("pt-BR");

/** Uso da API (Claude ou GPT) pelo bot (só admin). Mostra números, não reais: o preço muda e é melhor conferir no painel da Anthropic. */
export function UsoDoBot() {
  const { dados } = useDados<Uso>("/api/configuracoes/uso-bot");
  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Gauge className="size-4 text-texto-suave" aria-hidden /> Uso do bot (últimos 30 dias)
      </h2>
      <p className="mb-3 text-sm text-texto-suave">
        Para o bot não gastar a API à toa, ele pausa e chama um consultor se o mesmo cliente passar de {LIMITE_POR_MINUTO} mensagens em 1 minuto ou de {LIMITE_POR_DIA} em 24 horas (valores provisórios).
      </p>
      {dados ? (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Chamadas à API", dados.chamadas],
            ["Tokens enviados", dados.entrada],
            ["Tokens respondidos", dados.saida],
            ["Lidos do cache", dados.cacheLeitura],
          ].map(([rotulo, valor]) => (
            <div key={rotulo as string} className="rounded-controle bg-superficie-suave p-3">
              <dt className="text-xs text-texto-suave">{rotulo}</dt>
              <dd className="mt-1 text-lg font-semibold">{numero(valor as number)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-texto-suave">Carregando…</p>
      )}
      <p className="mt-3 text-xs text-texto-fraco">O valor em dinheiro você confere no painel do provedor em uso (console.anthropic.com para o Claude, platform.openai.com para o GPT), que é a fonte certa do preço. Os números acima somam os dois provedores.</p>
    </section>
  );
}
