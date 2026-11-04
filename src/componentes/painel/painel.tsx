"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ATALHOS_PAINEL, type AtalhoPainel } from "@/regras/painel";
import { formatarReais } from "@/regras/vendas";
import { formatarDuracao, type EstatisticaTempo } from "@/regras/tempo-resposta";
import { useDados } from "../dados";
import { Abas } from "../entalhe/abas";
import { juntar } from "../estilos";
import { Carregando, EstadoErro, classeEntrada } from "../ui";
import { useUsuario } from "../usuario";

interface DadosPainel {
  de: string;
  ate: string;
  dias: number;
  vendedores: { id: string; nome: string }[];
  vendedorId: string | null;
  vendedorNome: string | null;
  indicadores: { tipo: string; nome: string; atual: number; anterior: number }[];
  funil: { tipo: string; nome: string; total: number }[];
  tempos: { geral: EstatisticaTempo; consultor: EstatisticaTempo; primeiraResposta: EstatisticaTempo & { aguardando: number }; bot: EstatisticaTempo; semResposta: number };
  apresentacoesPorConsultor: { nome: string; total: number }[];
  conversoes: { medicoes: number; medicoesComApresentacao: number; apresentacoes: number; apresentacoesFechadas: number };
  vendas: {
    emNegociacao: { quantidade: number; total: number; semValor: number };
    vendido: { quantidade: number; total: number };
    perdidos: { quantidade: number; motivos: { codigo: string; nome: string; total: number; detalhes: string[] }[] };
  };
}

interface Filtro {
  atalho: AtalhoPainel | null;
  de: string;
  ate: string;
  vendedorId: string;
}

// Quando o número SOBE, isso é bom, ruim ou não dá para julgar? PROVISÓRIO: confirmar com o Mateus.
// Curiosos e Outras cidades ficam neutros; o resto é melhor quando sobe.
const SENTIDO_DO_INDICADOR: Record<string, "mais_e_melhor" | "menos_e_melhor" | "neutro"> = {
  curioso: "neutro",
  outra_cidade: "neutro",
  nao_compareceu: "menos_e_melhor", // cliente que faltou à medição/apresentação: subir é ruim
};

function variacao(tipo: string, atual: number, anterior: number) {
  const diferenca = atual - anterior;
  const sentido = SENTIDO_DO_INDICADOR[tipo] ?? "mais_e_melhor";
  const cor = diferenca === 0 || sentido === "neutro" ? "text-texto-suave" : (diferenca > 0) === (sentido === "mais_e_melhor") ? "text-sucesso" : "text-alerta";
  const texto = diferenca === 0 ? `igual ao período anterior (${anterior.toLocaleString("pt-BR")})` : `${diferenca > 0 ? "+" : "−"}${Math.abs(diferenca).toLocaleString("pt-BR")} em relação ao período anterior (era ${anterior.toLocaleString("pt-BR")})`;
  return { diferenca, cor, texto };
}

function taxa(a: number, b: number) {
  if (!b) return "–";
  return `${Math.round((a / b) * 100).toLocaleString("pt-BR")}%`;
}

// Painel de métricas (MET-01/02). Sem vendedor: contadores anônimos (MET-03). Com vendedor (só admin): leads dele.
export function Painel() {
  const admin = useUsuario().perfil === "admin";
  const [filtro, setFiltro] = useState<Filtro>({ atalho: "semana", de: "", ate: "", vendedorId: "" });
  const consulta = new URLSearchParams(filtro.atalho ? { atalho: filtro.atalho } : { de: filtro.de, ate: filtro.ate });
  if (filtro.vendedorId) consulta.set("vendedor", filtro.vendedorId);
  const { dados, erro, carregando, recarregar } = useDados<DadosPainel>(`/api/painel?${consulta}`);
  const de = filtro.atalho ? (dados?.de ?? "") : filtro.de;
  const ate = filtro.atalho ? (dados?.ate ?? "") : filtro.ate;
  const mudarData = (campo: "de" | "ate", valor: string) => setFiltro({ ...filtro, atalho: null, de, ate, [campo]: valor });
  const maiorFunil = Math.max(1, ...(dados?.funil.map((f) => f.total) ?? [1]));
  const maiorConsultor = Math.max(1, ...(dados?.apresentacoesPorConsultor.map((c) => c.total) ?? [1]));

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="sr-only">Painel</h1>
        <Abas
          itens={ATALHOS_PAINEL.map((a) => ({ codigo: a.codigo, rotulo: a.nome }))}
          valor={filtro.atalho}
          aoMudar={(codigo) => setFiltro({ ...filtro, atalho: codigo })}
          rotuloAria="Atalhos de período"
        />
        <label className="space-y-1 text-xs text-texto-suave">
          De
          <input type="date" className={juntar(classeEntrada, "w-auto")} value={de} max={ate || undefined} onChange={(e) => mudarData("de", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-texto-suave">
          Até
          <input type="date" className={juntar(classeEntrada, "w-auto")} value={ate} min={de || undefined} onChange={(e) => mudarData("ate", e.target.value)} />
        </label>
        {admin && dados && (
          <label className="space-y-1 text-xs text-texto-suave">
            Vendedor
            <select className={juntar(classeEntrada, "w-auto")} value={filtro.vendedorId} onChange={(e) => setFiltro({ ...filtro, vendedorId: e.target.value })}>
              <option value="">Todos</option>
              {dados.vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {dados && (
        <p className="text-sm text-texto-suave">
          {dados.dias} {dados.dias === 1 ? "dia" : "dias"} · comparação com os {dados.dias} {dados.dias === 1 ? "dia" : "dias"} anteriores
          {dados.vendedorNome && <> · números dos leads de <strong className="text-texto">{dados.vendedorNome}</strong></>}
        </p>
      )}
      {erro && dados && <p className="rounded-controle bg-alerta-suave px-3 py-2 text-sm text-alerta">{erro}</p>}

      {carregando && !dados ? (
        <Carregando linhas={3} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : dados ? (
        <>
          <h2 className="-mb-1 text-xs font-semibold uppercase tracking-wide text-texto-fraco">Resultado</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-painel border border-borda bg-superficie p-4 shadow-painel">
              <p className="text-sm text-texto-suave">Total em negociação</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{formatarReais(dados.vendas.emNegociacao.total)}</p>
              <p className="mt-1 text-xs text-texto-fraco">
                {dados.vendas.emNegociacao.quantidade} {dados.vendas.emNegociacao.quantidade === 1 ? "lead" : "leads"} em Apresentação agendada ou Negociação, agora
                {dados.vendas.emNegociacao.semValor > 0 && ` · ${dados.vendas.emNegociacao.semValor} sem valor informado`}
              </p>
            </div>
            <div className="rounded-painel border border-borda bg-superficie p-4 shadow-painel">
              <p className="text-sm text-texto-suave">Total vendido</p>
              <p className={juntar("mt-1 text-3xl font-semibold tabular-nums", dados.vendas.vendido.total > 0 && "text-sucesso")}>{formatarReais(dados.vendas.vendido.total)}</p>
              <p className="mt-1 text-xs text-texto-fraco">
                {dados.vendas.vendido.quantidade} {dados.vendas.vendido.quantidade === 1 ? "venda fechada" : "vendas fechadas"} no período
              </p>
            </div>
            <section className="rounded-painel border border-borda bg-superficie p-4 shadow-painel sm:col-span-2 lg:col-span-1">
              <p className="text-sm text-texto-suave">Motivos de perda</p>
              {dados.vendas.perdidos.quantidade === 0 ? (
                <p className="mt-2 text-xs text-texto-fraco">Nenhum lead perdido no período.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {dados.vendas.perdidos.motivos.map((m) => (
                    <li key={m.codigo} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span>{m.nome}</span>
                        <span className="tabular-nums font-medium">{m.total}</span>
                      </div>
                      {m.detalhes.length > 0 && <p className="text-xs text-texto-fraco">{m.detalhes.join(", ")}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <h2 className="-mb-1 text-xs font-semibold uppercase tracking-wide text-texto-fraco">Leads no período</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {dados.indicadores.map((i) => {
              const v = variacao(i.tipo, i.atual, i.anterior);
              return (
                <div key={i.tipo} className="rounded-painel border border-borda bg-superficie p-4 shadow-painel">
                  <p className="text-sm text-texto-suave">{i.nome}</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">{i.atual.toLocaleString("pt-BR")}</p>
                  <p className={juntar("mt-1 inline-flex items-center gap-1 text-xs", v.cor)}>
                    {v.diferenca > 0 ? <ArrowUpRight className="size-3.5 shrink-0" aria-hidden /> : v.diferenca < 0 ? <ArrowDownRight className="size-3.5 shrink-0" aria-hidden /> : <Minus className="size-3.5 shrink-0" aria-hidden />}
                    {v.texto}
                  </p>
                </div>
              );
            })}
          </div>

          <h2 className="-mb-1 text-xs font-semibold uppercase tracking-wide text-texto-fraco">Conversão da agenda</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Medições que viraram apresentação", dados.conversoes.medicoesComApresentacao, dados.conversoes.medicoes, "medição marcada no período"],
                ["Apresentações que viraram venda", dados.conversoes.apresentacoesFechadas, dados.conversoes.apresentacoes, "apresentação marcada no período"],
              ] as const
            ).map(([titulo, parte, todo, base]) => (
              <div key={titulo} className="rounded-painel border border-borda bg-superficie p-4 shadow-painel">
                <p className="text-sm text-texto-suave">{titulo}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{taxa(parte, todo)}</p>
                <p className="mt-1 text-xs text-texto-fraco">
                  {todo ? `${parte.toLocaleString("pt-BR")} de ${todo.toLocaleString("pt-BR")} ${todo === 1 ? "lead" : "leads"} com ${base}` : `nenhum lead com ${base}`}
                </p>
                <div className="mt-2 h-2 rounded-pilula bg-superficie-suave">
                  <div className="h-2 rounded-pilula bg-sucesso transition-[width] duration-300" style={{ width: `${todo ? (parte / todo) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>

          <h2 className="-mb-1 text-xs font-semibold uppercase tracking-wide text-texto-fraco">Tempo de resposta</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Tempo médio de resposta", dados.tempos.geral, "bot ou consultor, o que responder primeiro"],
                ["Resposta do consultor", dados.tempos.consultor, "toda mensagem do cliente respondida pelo consultor, ignorando o bot"],
                ["1ª resposta após o repasse", dados.tempos.primeiraResposta, dados.tempos.primeiraResposta.aguardando ? `${dados.tempos.primeiraResposta.aguardando} ${dados.tempos.primeiraResposta.aguardando === 1 ? "lead aguarda" : "leads aguardam"} o consultor agora` : "da hora em que o bot passou o lead até a 1ª mensagem do consultor"],
                ["Resposta do bot", dados.tempos.bot, "só quando o bot respondeu primeiro"],
              ] as const
            ).map(([titulo, t, dica]) => (
              <div key={titulo} className="rounded-painel border border-borda bg-superficie p-4 shadow-painel">
                <p className="text-sm text-texto-suave">{titulo}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{formatarDuracao(t.mediaSegundos)}</p>
                <p className="mt-1 text-xs text-texto-fraco">
                  {t.quantidade ? `mediana ${formatarDuracao(t.medianaSegundos)} · ${t.quantidade.toLocaleString("pt-BR")} ${t.quantidade === 1 ? "resposta" : "respostas"}` : "sem respostas no período"}
                </p>
                <p className="text-xs text-texto-fraco">{dica}</p>
              </div>
            ))}
          </div>
          {dados.tempos.semResposta > 0 && (
            <p className="text-xs text-texto-suave">
              {dados.tempos.semResposta.toLocaleString("pt-BR")} {dados.tempos.semResposta === 1 ? "vez em que o cliente escreveu e ninguém respondeu" : "vezes em que o cliente escreveu e ninguém respondeu"} (não entram na média). O tempo corre o dia todo, inclusive à noite e aos domingos.
            </p>
          )}


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
              <h2 className="mb-4 font-semibold">Apresentações agendadas por consultor</h2>
              <ul className="space-y-3">
                {dados.apresentacoesPorConsultor.map((c) => (
                  <li key={c.nome}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{c.nome}</span>
                      <span className="tabular-nums font-medium">{c.total}</span>
                    </div>
                    <div className="h-3 rounded-pilula bg-superficie-suave">
                      <div className="h-3 rounded-pilula bg-etapa-apresentacao transition-[width] duration-300" style={{ width: `${(c.total / maiorConsultor) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-texto-fraco">{dados.vendedorId
                  ? "Com vendedor escolhido, os números vêm dos leads que são dele hoje (leads excluídos não contam). A etapa de cada lead só é registrada desde que esse histórico foi ativado."
                  : "Os números são contadores anônimos gravados na hora de cada evento: excluir leads não muda o painel. O tempo de resposta vem das conversas."}</p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
