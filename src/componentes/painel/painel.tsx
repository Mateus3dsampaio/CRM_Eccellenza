"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, FileArchive, Loader2, Minus, MoreHorizontal, RotateCcw } from "lucide-react";
import { MOTIVO_SEM_RESPOSTA_AUTOMATICO } from "@/regras/recuperacao";
import { ATALHOS_PAINEL, type AtalhoPainel } from "@/regras/painel";
import { formatarReais } from "@/regras/vendas";
import { formatarDuracao, type EstatisticaTempo } from "@/regras/tempo-resposta";
import { chamarApi, useAviso, useDados } from "../dados";
import { Abas } from "../entalhe/abas";
import { juntar } from "../estilos";
import { Botao, Carregando, EstadoErro, Modal, Popover, classeEntrada } from "../ui";
import { ExportarDesempenho } from "../configuracoes/exportar-desempenho";
import { useUsuario } from "../usuario";
import { NumeroContando } from "./numero-contando";
import { TituloComDica } from "../dica";
import { dicaDoPainel } from "@/regras/painel-dicas";

interface DadosPainel {
  de: string;
  ate: string;
  dias: number;
  /** Quando o admin zerou o painel pela última vez (nada anterior aparece). */
  zeradoEm: string | null;
  vendedores: { id: string; nome: string }[];
  vendedorId: string | null;
  vendedorNome: string | null;
  indicadores: { tipo: string; nome: string; atual: number; anterior: number }[];
  funil: { tipo: string; nome: string; total: number }[];
  tempos: { geral: EstatisticaTempo; consultor: EstatisticaTempo; primeiraResposta: EstatisticaTempo & { aguardando: number }; bot: EstatisticaTempo; semResposta: number };
  apresentacoesPorConsultor: { nome: string; total: number }[];
  conversoes: { medicoes: number; medicoesComApresentacao: number; apresentacoes: number; apresentacoesFechadas: number };
  janelas: { total: number; abertas: number; fechando: number; atencao: number };
  /** Recuperação de leads no período: mensagens enviadas, quem respondeu depois de cada uma e quem foi para Perdido sozinho. */
  recuperacao: { primeira: number; segunda: number; respondeuPrimeira: number; respondeuSegunda: number; perdidos: number };
  /** Automação de leads no período (rede de segurança, arquivar perdidos, bloqueio): cards que as regras tiraram do quadro sozinhas. */
  automacao: { redePerdidos: number; redeArquivados: number; perdidosArquivados: number; bloqueados: number };
  vendas: {
    emNegociacao: { quantidade: number; total: number; semValor: number };
    vendido: { quantidade: number; total: number };
    perdidos: { quantidade: number; motivos: { codigo: string; nome: string; total: number; detalhes: string[] }[] };
    /** Contatos que não eram lead (motivo "Não é lead"): não entram em perdidos. */
    descartados: { quantidade: number; motivos: { codigo: string; nome: string; total: number; detalhes: string[] }[] };
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
  // Os números contam de zero só na abertura da tela; em troca de filtro e atualização automática mudam direto.
  const [contarNumeros, setContarNumeros] = useState(true);
  const chegou = dados !== null;
  useEffect(() => {
    if (!chegou) return;
    const t = setTimeout(() => setContarNumeros(false), 700);
    return () => clearTimeout(t);
  }, [chegou]);
  const maiorFunil = Math.max(1, ...(dados?.funil.map((f) => f.total) ?? [1]));
  // Exportar desempenho (tarefa 30): saiu de Configurações; é uma ação do painel, só do admin. Dados só ao abrir a janela.
  const [exportar, setExportar] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const avisar = useAviso();
  const [zerando, setZerando] = useState(false);
  const [entendi, setEntendi] = useState(false);
  const [ocupado, setOcupado] = useState<"html" | "zerar" | null>(null);

  // Baixa o painel inteiro (tudo desde o último reset) num arquivo HTML com filtro de período.
  async function baixarHtml() {
    setOcupado("html");
    try {
      const resposta = await fetch("/api/painel/exportar");
      if (!resposta.ok) throw new Error((await resposta.json().catch(() => ({}))).erro ?? "Não foi possível exportar.");
      const arquivo = /filename="([^"]+)"/.exec(resposta.headers.get("Content-Disposition") ?? "")?.[1] ?? "painel.html";
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = arquivo;
      link.click();
      URL.revokeObjectURL(url);
      avisar("Painel exportado. Abra o arquivo para conferir.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível exportar.", "erro");
    } finally {
      setOcupado(null);
    }
  }

  async function zerarPainel() {
    setOcupado("zerar");
    try {
      await chamarApi("/api/painel/zerar", { method: "POST", json: { confirmar: true } });
      avisar("Painel zerado. Os números recomeçam daqui.");
      setZerando(false);
      setEntendi(false);
      await recarregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível zerar.", "erro");
    } finally {
      setOcupado(null);
    }
  }
  const { dados: dadosExportar } = useDados<{ equipe: { id: string; nome: string; perfil: string; ativo: boolean }[]; periodoExportacao: { de: string; ate: string } }>(exportar ? "/api/configuracoes" : null);
  // "Clientes que faltaram" fica junto da conversão da agenda (é sobre compromisso marcado), não entre os leads do período.
  const faltaram = dados?.indicadores.find((i) => i.tipo === "nao_compareceu");
  const indicadoresDoPeriodo = dados?.indicadores.filter((i) => i.tipo !== "nao_compareceu") ?? [];
  const maiorConsultor = Math.max(1, ...(dados?.apresentacoesPorConsultor.map((c) => c.total) ?? [1]));

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 p-4 md:pt-3">
      {/* No PC é uma linha só, na mesma faixa do primeiro item do menu lateral: os rótulos ficam ao lado dos campos e as ações vão para o menu "…". */}
      <div className="flex flex-wrap items-end gap-3 md:items-center md:gap-2">
        <h1 className="sr-only">Painel</h1>
        <Abas
          itens={ATALHOS_PAINEL.map((a) => ({ codigo: a.codigo, rotulo: a.nome }))}
          valor={filtro.atalho}
          aoMudar={(codigo) => setFiltro({ ...filtro, atalho: codigo })}
          rotuloAria="Atalhos de período"
        />
        <label className="space-y-1 text-xs text-texto-suave md:space-y-0">
          <span className="md:sr-only">De</span>
          <input type="date" className={juntar(classeEntrada, "w-auto md:w-[8.5rem]")} value={de} max={ate || undefined} onChange={(e) => mudarData("de", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-texto-suave md:flex md:items-center md:gap-2 md:space-y-0">
          Até
          <input type="date" className={juntar(classeEntrada, "w-auto md:w-[8.5rem]")} value={ate} min={de || undefined} onChange={(e) => mudarData("ate", e.target.value)} />
        </label>
        {admin && dados && (
          <label className="space-y-1 text-xs text-texto-suave md:space-y-0">
            <span className="md:sr-only">Vendedor</span>
            <select className={juntar(classeEntrada, "w-auto")} value={filtro.vendedorId} onChange={(e) => setFiltro({ ...filtro, vendedorId: e.target.value })}>
              <option value="">Todos os vendedores</option>
              {dados.vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {admin && (
          <div className="ml-auto">
            <Popover
              aberto={menuAberto}
              aoFechar={() => setMenuAberto(false)}
              titulo="Ações do painel"
              largura="sm:w-72"
              gatilho={
                <button type="button" onClick={() => setMenuAberto((m) => !m)} aria-expanded={menuAberto} aria-haspopup="dialog" aria-label="Ações do painel" title="Ações do painel" className="tecla inline-flex size-toque items-center justify-center rounded-controle">
                  {ocupado === "html" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <MoreHorizontal className="size-5" aria-hidden />}
                </button>
              }
            >
              <div className="-mt-2 grid gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    setExportar(true);
                  }}
                  className="flex min-h-toque items-center gap-3 rounded-controle px-3 text-left text-sm hover:bg-superficie-suave"
                  title="Exportar desempenho do vendedor (.zip)"
                >
                  <FileArchive className="size-4 text-texto-suave" aria-hidden /> Desempenho do vendedor (.zip)
                </button>
                <button
                  type="button"
                  disabled={ocupado === "html"}
                  onClick={() => {
                    setMenuAberto(false);
                    void baixarHtml();
                  }}
                  className="flex min-h-toque items-center gap-3 rounded-controle px-3 text-left text-sm hover:bg-superficie-suave disabled:opacity-55"
                  title="Baixar o painel inteiro num arquivo HTML, com filtro de período"
                >
                  <Download className="size-4 text-texto-suave" aria-hidden /> Exportar painel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    setZerando(true);
                  }}
                  className="mt-1 flex min-h-toque items-center gap-3 rounded-controle border-t border-borda px-3 text-left text-sm text-alerta hover:bg-alerta-suave"
                  title="Apagar o histórico do painel e recomeçar a contar"
                >
                  <RotateCcw className="size-4" aria-hidden /> Zerar painel
                </button>
              </div>
            </Popover>
          </div>
        )}
      </div>
      {dados && (
        <p className="text-sm text-texto-suave">
          {dados.dias} {dados.dias === 1 ? "dia" : "dias"} · comparação com os {dados.dias} {dados.dias === 1 ? "dia" : "dias"} anteriores
          {dados.vendedorNome && <> · números dos leads de <strong className="text-texto">{dados.vendedorNome}</strong></>}
          {dados.zeradoEm && <> · painel zerado em {new Date(dados.zeradoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}: não há dados anteriores</>}
        </p>
      )}
      {erro && dados && <p className="rounded-controle bg-alerta-suave px-3 py-2 text-sm text-alerta">{erro}</p>}

      {carregando && !dados ? (
        <Carregando linhas={3} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : dados ? (
        <>
          <h2 className="-mb-1 rotulo-secao">Resultado</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-painel border border-borda bg-superficie p-5 luz-marca-fio">
              <TituloComDica className="text-sm text-texto-suave" titulo="Total em negociação" dica={dicaDoPainel("em_negociacao")} />
              <p className="mt-1 text-4xl font-semibold tabular-nums"><NumeroContando valor={dados.vendas.emNegociacao.total} formatar={formatarReais} animar={contarNumeros} /></p>
              <p className="mt-1 text-xs text-texto-fraco">
                {dados.vendas.emNegociacao.quantidade} {dados.vendas.emNegociacao.quantidade === 1 ? "lead" : "leads"} em Apresentação agendada ou Negociação, agora
                {dados.vendas.emNegociacao.semValor > 0 && ` · ${dados.vendas.emNegociacao.semValor} sem valor informado`}
              </p>
            </div>
            <div className="rounded-painel border border-borda bg-superficie p-5 luz-marca-fio">
              <TituloComDica className="text-sm text-texto-suave" titulo="Total vendido" dica={dicaDoPainel("vendido")} />
              <p className={juntar("mt-1 text-4xl font-semibold tabular-nums", dados.vendas.vendido.total > 0 && "text-sucesso")}><NumeroContando valor={dados.vendas.vendido.total} formatar={formatarReais} animar={contarNumeros} /></p>
              <p className="mt-1 text-xs text-texto-fraco">
                {dados.vendas.vendido.quantidade} {dados.vendas.vendido.quantidade === 1 ? "venda fechada" : "vendas fechadas"} no período
              </p>
            </div>
          </div>

          <h2 className="-mb-1 rotulo-secao">Leads no período</h2>
          {/* 8 contadores + motivos de perda = 9 cards: grade de 3 fecha sem card órfão (tarefa 30). */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {indicadoresDoPeriodo.map((i) => {
              const v = variacao(i.tipo, i.atual, i.anterior);
              return (
                <div key={i.tipo} className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
                  <TituloComDica className="text-sm text-texto-suave" titulo={i.nome} dica={dicaDoPainel(i.tipo)} />
                  <p className="mt-1 text-3xl font-semibold tabular-nums"><NumeroContando valor={i.atual} animar={contarNumeros} /></p>
                  <p className={juntar("mt-1 inline-flex items-center gap-1 text-xs", v.cor)}>
                    {v.diferenca > 0 ? <ArrowUpRight className="size-3.5 shrink-0" aria-hidden /> : v.diferenca < 0 ? <ArrowDownRight className="size-3.5 shrink-0" aria-hidden /> : <Minus className="size-3.5 shrink-0" aria-hidden />}
                    {v.texto}
                  </p>
                </div>
              );
            })}
            <section className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
              <TituloComDica className="text-sm text-texto-suave" titulo="Motivos de perda" dica={dicaDoPainel("motivos_perda")} />
              {dados.vendas.perdidos.quantidade === 0 ? (
                <p className="mt-2 text-xs text-texto-fraco">Nenhum lead perdido no período.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {dados.vendas.perdidos.motivos.filter((m) => m.codigo !== MOTIVO_SEM_RESPOSTA_AUTOMATICO).map((m) => (
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
              {dados.vendas.perdidos.motivos.filter((m) => m.codigo === MOTIVO_SEM_RESPOSTA_AUTOMATICO).map((m) => (
                <div key={m.codigo} className="mt-3 border-t border-borda pt-2">
                  <p className="flex justify-between gap-2 text-xs font-medium text-texto-suave">
                    <span>{m.nome}</span>
                    <span className="tabular-nums">{m.total}</span>
                  </p>
                  <p className="text-xs text-texto-fraco">Recuperação de leads (já contado nos perdidos)</p>
                </div>
              ))}
              {dados.vendas.descartados.quantidade > 0 && (
                <div className="mt-3 border-t border-borda pt-2">
                  <p className="text-xs font-medium text-texto-suave">
                    Descartados · {dados.vendas.descartados.quantidade} <span className="font-normal text-texto-fraco">(não eram lead, não contam como perdidos)</span>
                  </p>
                  <ul className="mt-1 space-y-1">
                    {dados.vendas.descartados.motivos.map((m) => (
                      <li key={m.codigo} className="flex justify-between gap-2 text-xs text-texto-suave">
                        <span>{m.nome}</span>
                        <span className="tabular-nums">{m.total}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <h2 className="-mb-1 rotulo-secao">Recuperação de leads</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {(
              [
                ["Receberam a 1ª mensagem", dados.recuperacao.primeira, null, "recuperacao_primeira"],
                ["Receberam a 2ª mensagem", dados.recuperacao.segunda, null, "recuperacao_segunda"],
                ["Responderam depois da 1ª", dados.recuperacao.respondeuPrimeira, dados.recuperacao.primeira, "recuperacao_respondeu_primeira"],
                ["Responderam depois da 2ª", dados.recuperacao.respondeuSegunda, dados.recuperacao.segunda, "recuperacao_respondeu_segunda"],
                ["Foram para Perdido (automático)", dados.recuperacao.perdidos, null, "recuperacao_perdido"],
              ] as const
            ).map(([nome, valor, de, chave]) => (
              <div key={nome} className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
                <TituloComDica className="text-sm text-texto-suave" titulo={nome} dica={dicaDoPainel(chave)} />
                <p className="mt-1 text-3xl font-semibold tabular-nums"><NumeroContando valor={valor} animar={contarNumeros} /></p>
                {de !== null && <p className="mt-1 text-xs text-texto-fraco">de {de.toLocaleString("pt-BR")} {de === 1 ? "mensagem enviada" : "mensagens enviadas"}</p>}
              </div>
            ))}
          </div>

          <h2 className="-mb-1 rotulo-secao">Automação de leads</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["Rede de segurança: para Perdido", dados.automacao.redePerdidos, "parados com a IA além do prazo", "rede_perdido"],
                ["Rede de segurança: arquivados", dados.automacao.redeArquivados, "pós-venda parado", "rede_arquivado"],
                ["Perdidos arquivados", dados.automacao.perdidosArquivados, "saíram da coluna Perdido sozinhos", "perdido_arquivado"],
                ["Contatos bloqueados", dados.automacao.bloqueados, "não eram clientes (pela IA ou à mão)", "contato_bloqueado"],
              ] as const
            ).map(([nome, valor, nota, chave]) => (
              <div key={nome} className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
                <TituloComDica className="text-sm text-texto-suave" titulo={nome} dica={dicaDoPainel(chave)} />
                <p className="mt-1 text-3xl font-semibold tabular-nums"><NumeroContando valor={valor} animar={contarNumeros} /></p>
                <p className="mt-1 text-xs text-texto-fraco">{nota}</p>
              </div>
            ))}
          </div>

          <h2 className="-mb-1 rotulo-secao">Conversão da agenda</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Medições que viraram apresentação", dados.conversoes.medicoesComApresentacao, dados.conversoes.medicoes, "medição marcada no período", "conversao_medicao"],
                ["Apresentações que viraram venda", dados.conversoes.apresentacoesFechadas, dados.conversoes.apresentacoes, "apresentação marcada no período", "conversao_apresentacao"],
              ] as const
            ).map(([titulo, parte, todo, base, chave]) => (
              <div key={titulo} className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
                <TituloComDica className="text-sm text-texto-suave" titulo={titulo} dica={dicaDoPainel(chave)} />
                <p className="mt-1 text-3xl font-semibold tabular-nums">{todo ? <NumeroContando valor={Math.round((parte / todo) * 100)} formatar={(n) => `${n.toLocaleString("pt-BR")}%`} animar={contarNumeros} /> : "–"}</p>
                <p className="mt-1 text-xs text-texto-fraco">
                  {todo ? `${parte.toLocaleString("pt-BR")} de ${todo.toLocaleString("pt-BR")} ${todo === 1 ? "lead" : "leads"} com ${base}` : `nenhum lead com ${base}`}
                </p>
                <div className="mt-2 h-2 rounded-pilula bg-superficie-suave">
                  <div className="h-2 rounded-pilula bg-sucesso transition-[width] duration-300" style={{ width: `${todo ? (parte / todo) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {faltaram && (() => {
              const v = variacao(faltaram.tipo, faltaram.atual, faltaram.anterior);
              return (
                <div className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
                  <TituloComDica className="text-sm text-texto-suave" titulo={faltaram.nome} dica={dicaDoPainel(faltaram.tipo)} />
                  <p className="mt-1 text-3xl font-semibold tabular-nums"><NumeroContando valor={faltaram.atual} animar={contarNumeros} /></p>
                  <p className={juntar("mt-1 inline-flex items-center gap-1 text-xs", v.cor)}>
                    {v.diferenca > 0 ? <ArrowUpRight className="size-3.5 shrink-0" aria-hidden /> : v.diferenca < 0 ? <ArrowDownRight className="size-3.5 shrink-0" aria-hidden /> : <Minus className="size-3.5 shrink-0" aria-hidden />}
                    {v.texto}
                  </p>
                  <p className="mt-1 text-xs text-texto-fraco">medição ou apresentação marcada em que o cliente não apareceu</p>
                </div>
              );
            })()}
          </div>

          <h2 className="-mb-1 rotulo-secao">Janela de 24h da Meta (agora)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
              <TituloComDica className="text-sm text-texto-suave" titulo="Leads com a janela aberta" dica={dicaDoPainel("janelas_abertas")} />
              <p className="mt-1 text-3xl font-semibold tabular-nums">{dados.janelas.total ? <NumeroContando valor={Math.round((dados.janelas.abertas / dados.janelas.total) * 100)} formatar={(n) => `${n.toLocaleString("pt-BR")}%`} animar={contarNumeros} /> : "–"}</p>
              <p className="mt-1 text-xs text-texto-fraco">
                {dados.janelas.total ? `${dados.janelas.abertas.toLocaleString("pt-BR")} de ${dados.janelas.total.toLocaleString("pt-BR")} ${dados.janelas.total === 1 ? "lead ativo" : "leads ativos"} (só o cliente reabre a janela)` : "nenhum lead ativo"}
              </p>
              <div className="mt-2 h-2 rounded-pilula bg-superficie-suave">
                <div className="h-2 rounded-pilula bg-sucesso transition-[width] duration-300" style={{ width: `${dados.janelas.total ? (dados.janelas.abertas / dados.janelas.total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
              <TituloComDica className="text-sm text-texto-suave" titulo="Janelas fechando em menos de 2 h" dica={dicaDoPainel("janelas_fechando")} />
              <p className={juntar("mt-1 text-3xl font-semibold tabular-nums", dados.janelas.fechando > 0 && "text-alerta")}><NumeroContando valor={dados.janelas.fechando} animar={contarNumeros} /></p>
              <p className="mt-1 text-xs text-texto-fraco">
                {dados.janelas.atencao.toLocaleString("pt-BR")} {dados.janelas.atencao === 1 ? "lead" : "leads"} com 2 a 6 h sobrando
              </p>
            </div>
          </div>

          <h2 className="-mb-1 rotulo-secao">Tempo de resposta</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Tempo médio de resposta", dados.tempos.geral, "bot ou consultor, o que responder primeiro", "tempo_geral"],
                ["Resposta do consultor", dados.tempos.consultor, "toda mensagem do cliente respondida pelo consultor, ignorando o bot", "tempo_consultor"],
                ["1ª resposta após o repasse", dados.tempos.primeiraResposta, dados.tempos.primeiraResposta.aguardando ? `${dados.tempos.primeiraResposta.aguardando} ${dados.tempos.primeiraResposta.aguardando === 1 ? "lead aguarda" : "leads aguardam"} o consultor agora` : "da hora em que o bot passou o lead até a 1ª mensagem do consultor", "tempo_primeira_resposta"],
                ["Resposta do bot", dados.tempos.bot, "só quando o bot respondeu primeiro", "tempo_bot"],
              ] as const
            ).map(([titulo, t, dica, chave]) => (
              <div key={titulo} className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
                <TituloComDica className="text-sm text-texto-suave" titulo={titulo} dica={dicaDoPainel(chave)} />
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
            <section className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
              <h2 className="font-semibold"><TituloComDica como="span" titulo="Funil" dica={dicaDoPainel(dados.vendedorId ? "funil_vendedor" : "funil")} /></h2>
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
            <section className="rounded-painel border border-borda bg-superficie p-4 luz-marca-fio">
              <h2 className="mb-4 font-semibold"><TituloComDica como="span" titulo="Apresentações agendadas por consultor" dica={dicaDoPainel("apresentacoes_por_consultor")} /></h2>
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
                  ? "Com vendedor escolhido, os números de funil e leads recebidos vêm dos leads que são dele hoje (leads excluídos não contam); vendido, perdidos e agenda contam também os excluídos. A etapa de cada lead só é registrada desde que esse histórico foi ativado."
                  : "Os números são contadores anônimos gravados na hora de cada evento, e o que foi vendido, perdido ou marcado na agenda é guardado antes de o lead ser excluído: apagar, arquivar ou limpar colunas não muda o painel. Só o tempo de resposta vem das conversas."}</p>
            </section>
          </div>
        </>
      ) : null}
      <Modal
        aberto={zerando}
        aoFechar={() => {
          setZerando(false);
          setEntendi(false);
        }}
        titulo="Zerar o painel"
        largura="max-w-lg"
      >
        <div className="space-y-3 text-sm text-texto-suave">
          <p>
            Isso <strong className="text-texto">apaga o histórico do painel</strong> (contadores, vendido, perdidos, descartados e conversões da agenda) e recomeça a contar daqui. A partir daí, o que entrar não sai mais, mesmo se você apagar, arquivar ou excluir o lead.
          </p>
          <p>
            Os leads, as conversas e a agenda <strong className="text-texto">não são apagados</strong>. Só o painel volta a zero. Não dá para desfazer.
          </p>
          <p>Quer guardar o que existe hoje? Baixe o arquivo antes e abra para conferir.</p>
          <Botao onClick={() => void baixarHtml()} carregando={ocupado === "html"} icone={<Download className="size-4" aria-hidden />}>
            Exportar painel agora
          </Botao>
          <label className="flex min-h-toque cursor-pointer items-start gap-3 text-texto">
            <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-marca)]" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} />
            <span>Entendo que o histórico será apagado e não dá para desfazer.</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Botao
            variante="fantasma"
            onClick={() => {
              setZerando(false);
              setEntendi(false);
            }}
          >
            Cancelar
          </Botao>
          <Botao variante="perigo" disabled={!entendi} carregando={ocupado === "zerar"} onClick={() => void zerarPainel()}>
            Zerar painel
          </Botao>
        </div>
      </Modal>
      <Modal aberto={exportar} aoFechar={() => setExportar(false)} titulo="Exportar desempenho" largura="max-w-2xl">
        {dadosExportar ? <ExportarDesempenho equipe={dadosExportar.equipe} periodoPadrao={dadosExportar.periodoExportacao} /> : <Carregando linhas={2} />}
      </Modal>
    </div>
  );
}
