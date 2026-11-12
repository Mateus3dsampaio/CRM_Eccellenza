import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { ErroHttp } from "@/lib/sessao";
import { resolverPeriodoPainel, datasDosAtalhos, INDICADORES_DO_PAINEL } from "@/regras/painel";
import { resumoDasJanelas } from "@/regras/janela24h";
import { ETAPAS_FUNIL, POSICAO_NO_FUNIL, type CodigoEtapa } from "@/regras/etapas";
import { nomesDasEtapas } from "./etapas";
import { motivosDePerda } from "./vendas";
import { compromissosDoPainel, encerradosDoPainel, painelZeradoEm, type CompromissoDoLead, type Encerrado } from "./painel-dados";
import { estatisticaDeTempos, primeiraRespostaDoConsultor, temposDoConsultor, turnosDoCliente } from "@/regras/tempo-resposta";

// Painel (MET-01/02). Sem vendedor escolhido: contadores anônimos (valem mesmo para leads excluídos).
// Com vendedor escolhido: dados dos leads que são dele hoje, porque os contadores não guardam de quem é cada lead (MET-03).
// Vendido, perdidos, descartados e conversões da agenda vêm de `painel-dados.ts`: contam também os leads já excluídos.
// "Zerar painel" grava uma data: nada anterior a ela aparece (os períodos são cortados nela).



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
  const { fim } = periodo;
  const zeradoEm = await painelZeradoEm();
  // Corta o período na data do reset (e nunca depois do fim, para período inteiro antes do reset dar zero).
  const limitar = (d: Date) => {
    const x = zeradoEm && d < zeradoEm ? zeradoEm : d;
    return x > fim ? fim : x;
  };
  const inicio = limitar(periodo.inicio);
  const anteriorInicio = limitar(periodo.anteriorInicio);
  const consultores = await db.usuario.findMany({ where: { perfil: "consultor" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const vendedor = pedido.vendedorId ? consultores.find((c) => c.id === pedido.vendedorId) : undefined;
  if (pedido.vendedorId && !vendedor) throw new ErroHttp(404, "Vendedor não encontrado.");

  const encerrados = await encerradosDoPainel();
  const eventos = await db.eventoMetrica.findMany({
    where: { ocorridoEm: { gte: anteriorInicio, lt: fim }, ...(vendedor ? { consultorId: vendedor.id } : {}) },
  });
  const contar = (tipo: string, de: Date, ate: Date) => eventos.filter((e) => e.tipo === tipo && e.ocorridoEm >= de && e.ocorridoEm < ate).length;

  // Mensagens do período, para o tempo de resposta (todos os leads, ou só os do vendedor).
  const leadsComMensagem = await db.lead.findMany({
    where: { ...(vendedor ? { consultorId: vendedor.id } : {}), mensagens: { some: { enviadaEm: { gte: inicio, lt: fim } } } },
    select: { repassadoEm: true, mensagens: { orderBy: { enviadaEm: "asc" }, select: { autor: true, enviadaEm: true, dispensadaEm: true } } },
  });
  const turnos = leadsComMensagem.flatMap((l) => turnosDoCliente(l.mensagens, inicio, fim));
  const respostasDoConsultor = leadsComMensagem.flatMap((l) => temposDoConsultor(l.mensagens, inicio, fim));
  const primeiras = leadsComMensagem.flatMap((l) => {
    const p = l.repassadoEm ? primeiraRespostaDoConsultor(l.repassadoEm, l.mensagens) : null;
    return p && p.consultorEm >= inicio && p.consultorEm < fim ? [p.segundos] : [];
  });
  // Leads que o bot passou e o consultor ainda não respondeu (situação de agora, não do período).
  const repassados = await db.lead.findMany({
    where: { ...(vendedor ? { consultorId: vendedor.id } : {}), arquivadoEm: null, etapa: { not: "perdido" }, aguardandoHumano: true, repassadoEm: { not: null } },
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
    // Contato que a loja descartou ("Não é lead") sai de "Leads novos": nunca foi lead de verdade.
    const descartadosNo = (de: Date, ate: Date) => encerrados.filter((e) => e.naoELead && e.quando >= de && e.quando < ate).length;
    indicadores = INDICADORES_DO_PAINEL.map(([tipo, nome]) => {
      const i = indicador(tipo, nome);
      return tipo === "lead_novo" ? { ...i, atual: Math.max(0, i.atual - descartadosNo(inicio, fim)), anterior: Math.max(0, i.anterior - descartadosNo(anteriorInicio, inicio)) } : i;
    });
    funil = FUNIL.map(([tipo, nome]) => ({ tipo, nome, total: contar(tipo, inicio, fim) }));
  } else {
    const leads = await db.lead.findMany({
      where: { consultorId: vendedor.id },
      select: { criadoEm: true, etapa: true, motivoPerda: true, mensagens: { where: { autor: "consultor" }, select: { enviadaEm: true } }, mudancasEtapa: { select: { para: true, criadoEm: true } } },
    });
    const dentro = (d: Date, de: Date, ate: Date) => d >= de && d < ate;
    const naoELead = new Set((await motivosDePerda()).filter((m) => m.naoELead).map((m) => m.codigo));
    const nos = (de: Date, ate: Date) => ({
      recebidos: leads.filter((l) => dentro(l.criadoEm, de, ate) && !(l.etapa === "perdido" && naoELead.has(l.motivoPerda ?? ""))).length,
      atendidos: leads.filter((l) => l.mensagens.some((m) => dentro(m.enviadaEm, de, ate))).length,
    });
    const atual = nos(inicio, fim);
    const anterior = nos(anteriorInicio, inicio);
    indicadores = [
      indicador("apresentacao_agendada", "Apresentações agendadas"),
      indicador("medicao_agendada", "Medições agendadas"),
      indicador("nao_compareceu", "Clientes que faltaram"),
      { tipo: "recebidos", nome: "Leads recebidos", atual: atual.recebidos, anterior: anterior.recebidos },
      { tipo: "atendidos", nome: "Leads atendidos", atual: atual.atendidos, anterior: anterior.atendidos },
    ];
    // Etapa mais avançada do funil que cada lead alcançou no período (quem chegou longe passou pelas anteriores).
    const alcance = leads.map((l) => Math.max(-1, ...l.mudancasEtapa.filter((m) => dentro(m.criadoEm, inicio, fim)).map((m) => POSICAO_NO_FUNIL[m.para as CodigoEtapa] ?? -1)));
    funil = FUNIL.map(([tipo, nome], i) => ({ tipo, nome, total: alcance.filter((a) => a >= i).length }));
  }

  const dono = (c: { consultorId: string | null }) => !vendedor || c.consultorId === vendedor.id;
  const vendas = await vendasDoPeriodo(inicio, fim, encerrados.filter(dono), vendedor?.id);
  const conversoes = conversoesDoPeriodo(inicio, fim, (await compromissosDoPainel()).filter(dono));
  // Situação de agora (não do período): leads ativos (etapa aberta, não arquivados) com a janela de 24h aberta.
  const ativos = await db.lead.findMany({ where: { arquivadoEm: null, etapa: { notIn: ["fechado", "perdido"] }, ...(vendedor ? { consultorId: vendedor.id } : {}) }, select: { ultimaMsgClienteEm: true } });
  const janelas = resumoDasJanelas(ativos, quando);

  return {
    de: periodo.de,
    ate: periodo.ate,
    dias: periodo.dias,
    zeradoEm: zeradoEm?.toISOString() ?? null,
    atalhos: datasDosAtalhos(quando),
    vendedores: consultores,
    vendedorId: vendedor?.id ?? null,
    vendedorNome: vendedor?.nome ?? null,
    indicadores,
    funil,
    vendas,
    conversoes,
    janelas,
    recuperacao: {
      primeira: contar("recuperacao_primeira", inicio, fim),
      segunda: contar("recuperacao_segunda", inicio, fim),
      respondeuPrimeira: contar("recuperacao_respondeu_primeira", inicio, fim),
      respondeuSegunda: contar("recuperacao_respondeu_segunda", inicio, fim),
      perdidos: contar("recuperacao_perdido", inicio, fim),
    },
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
 * Lead excluído continua contando (cópia em `painel-dados.ts`): marcou apresentação, sumiu e foi excluído = apresentação que não converteu.
 */
function conversoesDoPeriodo(inicio: Date, fim: Date, compromissos: CompromissoDoLead[]) {
  const noPeriodo = (d: Date | null) => !!d && d >= inicio && d < fim;
  const medicoes = compromissos.filter((c) => noPeriodo(c.medicao));
  const apresentacoes = compromissos.filter((c) => noPeriodo(c.apresentacao));
  return {
    medicoes: medicoes.length,
    medicoesComApresentacao: medicoes.filter((c) => c.apresentacao && c.medicao && c.apresentacao >= c.medicao).length,
    apresentacoes: apresentacoes.length,
    apresentacoesFechadas: apresentacoes.filter((c) => c.fechou).length,
  };
}

/** Colunas que entram em "Em negociação" (situação de agora). */
const ETAPAS_EM_NEGOCIACAO: CodigoEtapa[] = ["apresentacao", "negociacao"];

/**
 * Vendas (Bloco 2). "Em negociação" é a situação de agora: valor do orçamento dos leads em Apresentação agendada e Negociação.
 * "Vendido", "perdidos" e "descartados" são do período: leads cuja última entrada em Fechado/Perdido caiu dentro das datas,
 * inclusive os já excluídos. Descartado = perdido por um motivo "Não é lead" (não entra em perdidos). Dinheiro em centavos.
 */
async function vendasDoPeriodo(inicio: Date, fim: Date, encerrados: Encerrado[], vendedorId?: string) {
  const dono = vendedorId ? { consultorId: vendedorId } : {};
  const abertos = await db.lead.findMany({ where: { ...dono, arquivadoEm: null, etapa: { in: ETAPAS_EM_NEGOCIACAO } }, select: { valorOrcamento: true } });
  const noPeriodo = (e: Encerrado) => e.quando >= inicio && e.quando < fim;
  const fechados = encerrados.filter((e) => e.etapa === "fechado" && noPeriodo(e));
  const perdidos = encerrados.filter((e) => e.etapa === "perdido" && !e.naoELead && noPeriodo(e));
  const descartados = encerrados.filter((e) => e.etapa === "perdido" && e.naoELead && noPeriodo(e));
  // Motivos na ordem do admin (inclusive os desativados, que ainda têm lead). Código que não existe mais cai em "Sem motivo registrado".
  const cadastrados = await motivosDePerda();
  const conhecidos = new Set(cadastrados.map((m) => m.codigo));
  const porMotivo = (lista: Encerrado[]) =>
    [...cadastrados.map((m) => ({ codigo: m.codigo, nome: m.nome, pergunta: m.pergunta })), { codigo: "sem_motivo", nome: "Sem motivo registrado", pergunta: null }]
      .map((m) => {
        const doMotivo = lista.filter((l) => (conhecidos.has(l.motivo ?? "") ? l.motivo === m.codigo : m.codigo === "sem_motivo"));
        return { codigo: m.codigo, nome: m.nome, total: doMotivo.length, detalhes: m.pergunta ? [...new Set(doMotivo.map((l) => l.concorrente?.trim()).filter((c): c is string => !!c))] : [] };
      })
      .filter((m) => m.total > 0);
  return {
    emNegociacao: { quantidade: abertos.length, total: abertos.reduce((s, l) => s + (l.valorOrcamento ?? 0), 0), semValor: abertos.filter((l) => !l.valorOrcamento).length },
    vendido: { quantidade: fechados.length, total: fechados.reduce((s, l) => s + (l.valor ?? 0), 0) },
    perdidos: { quantidade: perdidos.length, motivos: porMotivo(perdidos) },
    descartados: { quantidade: descartados.length, motivos: porMotivo(descartados) },
  };
}
