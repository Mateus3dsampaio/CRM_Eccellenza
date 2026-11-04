import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { ErroHttp } from "@/lib/sessao";
import { resolverPeriodoPainel, datasDosAtalhos } from "@/regras/painel";
import { ETAPAS_FUNIL, POSICAO_NO_FUNIL, type CodigoEtapa } from "@/regras/etapas";
import { nomesDasEtapas } from "./etapas";
import { motivosDePerda } from "./vendas";
import { estatisticaDeTempos, primeiraRespostaDoConsultor, temposDoConsultor, turnosDoCliente } from "@/regras/tempo-resposta";

// Painel (MET-01/02). Sem vendedor escolhido: contadores anônimos (valem mesmo para leads excluídos).
// Com vendedor escolhido: dados dos leads que são dele hoje, porque os contadores não guardam de quem é cada lead (MET-03).

// Tarefa 21: a métrica principal é trazer o cliente à loja (apresentações agendadas). "Sem resposta" virou motivo de perda.
const TIPOS_PAINEL = [
  ["apresentacao_agendada", "Apresentações agendadas"],
  ["medicao_agendada", "Medições agendadas"],
  ["lead_novo", "Leads novos"],
  ["qualificado", "Qualificados"],
  ["curioso", "Curiosos"],
  ["outra_cidade", "Outras cidades"],
  ["parceiro", "Arquitetos/parceiros"],
  ["retomada_voltou", "Retomadas que voltaram"],
] as const;

export interface PedidoPainel {
  atalho?: string | null;
  de?: string | null;
  ate?: string | null;
  /** Só o admin filtra por vendedor. */
  vendedorId?: string | null;
}

export async function dadosDoPainel(pedido: PedidoPainel) {
  const quando = await agora();
  let periodo;
  try {
    periodo = resolverPeriodoPainel(pedido, quando);
  } catch (e) {
    throw new ErroHttp(400, e instanceof Error ? e.message : "Período inválido.");
  }
  const { inicio, fim, anteriorInicio } = periodo;
  const consultores = await db.usuario.findMany({ where: { perfil: "consultor" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const vendedor = pedido.vendedorId ? consultores.find((c) => c.id === pedido.vendedorId) : undefined;
  if (pedido.vendedorId && !vendedor) throw new ErroHttp(404, "Vendedor não encontrado.");

  const eventos = await db.eventoMetrica.findMany({
    where: { ocorridoEm: { gte: anteriorInicio, lt: fim }, ...(vendedor ? { consultorId: vendedor.id } : {}) },
  });
  const contar = (tipo: string, de: Date, ate: Date) => eventos.filter((e) => e.tipo === tipo && e.ocorridoEm >= de && e.ocorridoEm < ate).length;

  // Mensagens do período, para o tempo de resposta (todos os leads, ou só os do vendedor).
  const leadsComMensagem = await db.lead.findMany({
    where: { ...(vendedor ? { consultorId: vendedor.id } : {}), mensagens: { some: { enviadaEm: { gte: inicio, lt: fim } } } },
    select: { repassadoEm: true, mensagens: { orderBy: { enviadaEm: "asc" }, select: { autor: true, enviadaEm: true } } },
  });
  const turnos = leadsComMensagem.flatMap((l) => turnosDoCliente(l.mensagens, inicio, fim));
  const respostasDoConsultor = leadsComMensagem.flatMap((l) => temposDoConsultor(l.mensagens, inicio, fim));
  const primeiras = leadsComMensagem.flatMap((l) => {
    const p = l.repassadoEm ? primeiraRespostaDoConsultor(l.repassadoEm, l.mensagens) : null;
    return p && p.consultorEm >= inicio && p.consultorEm < fim ? [p.segundos] : [];
  });
  // Leads que o bot passou e o consultor ainda não respondeu (situação de agora, não do período).
  const repassados = await db.lead.findMany({
    where: { ...(vendedor ? { consultorId: vendedor.id } : {}), arquivadoEm: null, aguardandoHumano: true, repassadoEm: { not: null } },
    select: { repassadoEm: true, mensagens: { where: { autor: "consultor" }, orderBy: { enviadaEm: "desc" }, take: 1, select: { enviadaEm: true } } },
  });
  const aguardando = repassados.filter((l) => !l.mensagens[0] || l.mensagens[0].enviadaEm < (l.repassadoEm as Date)).length;
  const segundos = (quem?: "bot" | "consultor") => turnos.filter((t) => t.segundos !== null && (!quem || t.respondidoPor === quem)).map((t) => t.segundos as number);
  const tempos = {
    geral: estatisticaDeTempos(segundos()),
    consultor: estatisticaDeTempos(respostasDoConsultor.map((r) => r.segundos)),
    primeiraResposta: { ...estatisticaDeTempos(primeiras), aguardando },
    bot: estatisticaDeTempos(segundos("bot")),
    semResposta: turnos.filter((t) => !t.respondidoPor).length,
  };

  let indicadores: { tipo: string; nome: string; atual: number; anterior: number }[];
  let funil: { tipo: string; nome: string; total: number }[];
  const nomes = await nomesDasEtapas();
  const FUNIL = ETAPAS_FUNIL.map((e: CodigoEtapa) => [`etapa_${e}`, nomes[e]] as const);
  const indicador = (tipo: string, nome: string) => ({ tipo, nome, atual: contar(tipo, inicio, fim), anterior: contar(tipo, anteriorInicio, inicio) });

  if (!vendedor) {
    indicadores = TIPOS_PAINEL.map(([tipo, nome]) => indicador(tipo, nome));
    funil = FUNIL.map(([tipo, nome]) => ({ tipo, nome, total: contar(tipo, inicio, fim) }));
  } else {
    const leads = await db.lead.findMany({
      where: { consultorId: vendedor.id },
      select: { criadoEm: true, mensagens: { where: { autor: "consultor" }, select: { enviadaEm: true } }, mudancasEtapa: { select: { para: true, criadoEm: true } } },
    });
    const dentro = (d: Date, de: Date, ate: Date) => d >= de && d < ate;
    const nos = (de: Date, ate: Date) => ({
      recebidos: leads.filter((l) => dentro(l.criadoEm, de, ate)).length,
      atendidos: leads.filter((l) => l.mensagens.some((m) => dentro(m.enviadaEm, de, ate))).length,
    });
    const atual = nos(inicio, fim);
    const anterior = nos(anteriorInicio, inicio);
    indicadores = [
      indicador("apresentacao_agendada", "Apresentações agendadas"),
      indicador("medicao_agendada", "Medições agendadas"),
      { tipo: "recebidos", nome: "Leads recebidos", atual: atual.recebidos, anterior: anterior.recebidos },
      { tipo: "atendidos", nome: "Leads atendidos", atual: atual.atendidos, anterior: anterior.atendidos },
    ];
    // Etapa mais avançada do funil que cada lead alcançou no período (quem chegou longe passou pelas anteriores).
    const alcance = leads.map((l) => Math.max(-1, ...l.mudancasEtapa.filter((m) => dentro(m.criadoEm, inicio, fim)).map((m) => POSICAO_NO_FUNIL[m.para as CodigoEtapa] ?? -1)));
    funil = FUNIL.map(([tipo, nome], i) => ({ tipo, nome, total: alcance.filter((a) => a >= i).length }));
  }

  const vendas = await vendasDoPeriodo(inicio, fim, vendedor?.id);
  const conversoes = await conversoesDoPeriodo(inicio, fim, vendedor?.id);

  return {
    de: periodo.de,
    ate: periodo.ate,
    dias: periodo.dias,
    atalhos: datasDosAtalhos(quando),
    vendedores: consultores,
    vendedorId: vendedor?.id ?? null,
    vendedorNome: vendedor?.nome ?? null,
    indicadores,
    funil,
    vendas,
    conversoes,
    tempos,
    apresentacoesPorConsultor: consultores.map((c) => ({
      nome: c.nome,
      total: eventos.filter((e) => e.tipo === "apresentacao_agendada" && e.consultorId === c.id && e.ocorridoEm >= inicio && e.ocorridoEm < fim).length,
    })),
  };
}

/**
 * Conversões (tarefa 21), por lead, a partir da agenda: das medições marcadas no período, quantas viraram apresentação;
 * das apresentações marcadas no período, quantas viraram venda. Compromisso cancelado sem remarcar não conta.
 * Leads excluídos somem (a agenda some com eles).
 */
async function conversoesDoPeriodo(inicio: Date, fim: Date, vendedorId?: string) {
  const compromissos = await db.visita.findMany({
    where: { status: "agendada", tipo: { in: ["medicao", "apresentacao"] }, ...(vendedorId ? { consultorId: vendedorId } : {}) },
    select: { leadId: true, tipo: true, criadoEm: true, lead: { select: { etapa: true } } },
  });
  const noPeriodo = (c: (typeof compromissos)[number]) => c.criadoEm >= inicio && c.criadoEm < fim;
  const medicoes = new Map<string, Date>();
  for (const c of compromissos) if (c.tipo === "medicao" && noPeriodo(c)) medicoes.set(c.leadId, c.criadoEm);
  const viraramApresentacao = [...medicoes].filter(([leadId, marcada]) => compromissos.some((c) => c.tipo === "apresentacao" && c.leadId === leadId && c.criadoEm >= marcada)).length;
  const apresentacoes = new Map(compromissos.filter((c) => c.tipo === "apresentacao" && noPeriodo(c)).map((c) => [c.leadId, c.lead.etapa]));
  const fechadas = [...apresentacoes.values()].filter((etapa) => etapa === "fechado").length;
  return {
    medicoes: medicoes.size,
    medicoesComApresentacao: viraramApresentacao,
    apresentacoes: apresentacoes.size,
    apresentacoesFechadas: fechadas,
  };
}

/** Colunas que entram em "Em negociação" (situação de agora). */
const ETAPAS_EM_NEGOCIACAO: CodigoEtapa[] = ["apresentacao", "negociacao"];

/**
 * Vendas (Bloco 2). "Em negociação" é a situação de agora: valor do orçamento dos leads em Apresentação agendada e Negociação.
 * "Vendido" e "perdidos" são do período: leads cuja última entrada em Fechado/Perdido caiu dentro das datas.
 * Dinheiro em centavos. Leads excluídos somem (o valor vem do lead); arquivados continuam contando.
 */
async function vendasDoPeriodo(inicio: Date, fim: Date, vendedorId?: string) {
  const dono = vendedorId ? { consultorId: vendedorId } : {};
  const abertos = await db.lead.findMany({ where: { ...dono, arquivadoEm: null, etapa: { in: ETAPAS_EM_NEGOCIACAO } }, select: { valorOrcamento: true } });
  const encerrados = await db.lead.findMany({
    where: { ...dono, etapa: { in: ["fechado", "perdido"] } },
    select: { etapa: true, valorFechado: true, motivoPerda: true, concorrente: true, mudancasEtapa: { where: { para: { in: ["fechado", "perdido"] } }, select: { para: true, criadoEm: true } } },
  });
  const noPeriodo = (l: (typeof encerrados)[number]) => {
    const quando = Math.max(0, ...l.mudancasEtapa.filter((m) => m.para === l.etapa).map((m) => m.criadoEm.getTime()));
    return quando >= inicio.getTime() && quando < fim.getTime();
  };
  const fechados = encerrados.filter((l) => l.etapa === "fechado" && noPeriodo(l));
  const perdidos = encerrados.filter((l) => l.etapa === "perdido" && noPeriodo(l));
  // Motivos na ordem do admin (inclusive os desativados, que ainda têm lead). Código que não existe mais cai em "Sem motivo registrado".
  const cadastrados = await motivosDePerda();
  const conhecidos = new Set(cadastrados.map((m) => m.codigo));
  const motivos = [...cadastrados.map((m) => ({ codigo: m.codigo, nome: m.nome, pergunta: m.pergunta })), { codigo: "sem_motivo", nome: "Sem motivo registrado", pergunta: null }].map((m) => {
    const lista = perdidos.filter((l) => (conhecidos.has(l.motivoPerda ?? "") ? l.motivoPerda === m.codigo : m.codigo === "sem_motivo"));
    return {
      codigo: m.codigo,
      nome: m.nome,
      total: lista.length,
      detalhes: m.pergunta ? [...new Set(lista.map((l) => l.concorrente?.trim()).filter((c): c is string => !!c))] : [],
    };
  });
  return {
    emNegociacao: { quantidade: abertos.length, total: abertos.reduce((s, l) => s + (l.valorOrcamento ?? 0), 0), semValor: abertos.filter((l) => !l.valorOrcamento).length },
    vendido: { quantidade: fechados.length, total: fechados.reduce((s, l) => s + (l.valorFechado ?? 0), 0) },
    perdidos: { quantidade: perdidos.length, motivos: motivos.filter((m) => m.total > 0) },
  };
}
