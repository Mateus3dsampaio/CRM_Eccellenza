import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { ErroHttp } from "@/lib/sessao";
import { resolverPeriodoPainel, datasDosAtalhos } from "@/regras/painel";
import { estatisticaDeTempos, primeiraRespostaDoConsultor, temposDoConsultor, turnosDoCliente } from "@/regras/tempo-resposta";

// Painel (MET-01/02). Sem vendedor escolhido: contadores anônimos (valem mesmo para leads excluídos).
// Com vendedor escolhido: dados dos leads que são dele hoje, porque os contadores não guardam de quem é cada lead (MET-03).

const TIPOS_PAINEL = [
  ["lead_novo", "Leads novos"],
  ["qualificado", "Qualificados"],
  ["curioso", "Curiosos"],
  ["outra_cidade", "Outras cidades"],
  ["parceiro", "Arquitetos/parceiros"],
  ["sem_resposta", "Sem resposta"],
  ["retomada_voltou", "Retomadas que voltaram"],
  ["visita_agendada", "Visitas agendadas"],
] as const;

const FUNIL = [
  ["etapa_novo", "Novo"],
  ["etapa_pronto", "Pronto para o consultor"],
  ["etapa_visita", "Visita agendada"],
  ["etapa_orcamento", "Orçamento apresentado"],
  ["etapa_fechado", "Fechado"],
] as const;

/** Posição da etapa no funil; "Negociação" conta como Orçamento (vem depois dele). Fora do funil: -1. */
const POSICAO_NO_FUNIL: Record<string, number> = { novo: 0, pronto: 1, visita: 2, orcamento: 3, negociacao: 3, fechado: 4 };

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

  if (!vendedor) {
    indicadores = TIPOS_PAINEL.map(([tipo, nome]) => ({ tipo, nome, atual: contar(tipo, inicio, fim), anterior: contar(tipo, anteriorInicio, inicio) }));
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
      semResposta: leads.filter((l) => l.mudancasEtapa.some((m) => m.para === "sem_resposta" && dentro(m.criadoEm, de, ate))).length,
    });
    const atual = nos(inicio, fim);
    const anterior = nos(anteriorInicio, inicio);
    indicadores = [
      { tipo: "recebidos", nome: "Leads recebidos", atual: atual.recebidos, anterior: anterior.recebidos },
      { tipo: "atendidos", nome: "Leads atendidos", atual: atual.atendidos, anterior: anterior.atendidos },
      { tipo: "visita_agendada", nome: "Visitas agendadas", atual: contar("visita_agendada", inicio, fim), anterior: contar("visita_agendada", anteriorInicio, inicio) },
      { tipo: "sem_resposta", nome: "Sem resposta", atual: atual.semResposta, anterior: anterior.semResposta },
    ];
    // Etapa mais avançada do funil que cada lead alcançou no período (quem chegou longe passou pelas anteriores).
    const alcance = leads.map((l) => Math.max(-1, ...l.mudancasEtapa.filter((m) => dentro(m.criadoEm, inicio, fim)).map((m) => POSICAO_NO_FUNIL[m.para] ?? -1)));
    funil = FUNIL.map(([tipo, nome], i) => ({ tipo, nome, total: alcance.filter((a) => a >= i).length }));
  }

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
    tempos,
    visitasPorConsultor: consultores.map((c) => ({
      nome: c.nome,
      total: eventos.filter((e) => e.tipo === "visita_agendada" && e.consultorId === c.id && e.ocorridoEm >= inicio && e.ocorridoEm < fim).length,
    })),
  };
}
