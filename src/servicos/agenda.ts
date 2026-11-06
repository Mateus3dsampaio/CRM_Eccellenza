import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import {
  chaveVaga,
  duracaoVisitaMs,
  horarioDentroDaRegra,
  horariosLivres,
  janelaDeAgendamento,
  naLoja,
  primeiroDiaAgendavel,
  primeiroHorarioPossivel,
  NOMES_COMPROMISSO,
  vagaLivre,
  type Intervalo,
  type TipoCompromisso,
} from "@/regras/agenda";
import { ETAPAS, type CodigoEtapa } from "@/regras/etapas";
import { venceu } from "@/regras/decisao";
import { formatarVisitaCurta, inicioDoDiaLocal, partesLocais, somarDias } from "@/regras/tempo";
import { regrasDaAgenda } from "./configuracoes";
import { registrarAlerta } from "./alertas";
import { registrarAlteracao } from "./historico";
import { atualizarResumo, moverEtapa } from "./leads";
import { registrarEvento, registrarUmaVez } from "./metricas";

export class ErroAgenda extends Error {}

async function consultoresAtivos(): Promise<string[]> {
  const lista = await db.usuario.findMany({ where: { perfil: "consultor", ativo: true }, orderBy: { nome: "asc" }, select: { id: true } });
  return lista.map((c) => c.id);
}

/**
 * Compromissos ativos e bloqueios no período. O compromisso do mesmo tipo do próprio lead não conta (é a remarcação);
 * os outros dele contam (a medição do lead não pode coincidir com a apresentação dele).
 */
async function ocupados(de: Date, ate: Date, remarcando?: { leadId: string; tipo: TipoCompromisso }): Promise<Intervalo[]> {
  const [visitas, bloqueios] = await Promise.all([
    db.visita.findMany({ where: { status: "agendada", inicio: { lt: ate }, fim: { gt: de } } }),
    db.bloqueio.findMany({ where: { inicio: { lt: ate }, fim: { gt: de } } }),
  ]);
  return [
    ...visitas
      .filter((v) => !(remarcando && v.leadId === remarcando.leadId && v.tipo === remarcando.tipo))
      .map((v) => ({ consultorId: v.consultorId, inicio: v.inicio, fim: v.fim, tipo: naLoja(v.tipo) ? ("visita" as const) : ("medicao" as const) })),
    ...bloqueios.map((b) => ({ consultorId: b.consultorId, inicio: b.inicio, fim: b.fim, tipo: "bloqueio" as const })),
  ];
}

/** Horários livres para o compromisso do lead (AGENDA-02), já com a duração e as regras do tipo. */
export async function horariosLivresParaLead(leadId: string, limite = 3, aPartirDe?: Date, tipo: TipoCompromisso = "visita") {
  const quando = await agora();
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { consultorId: true } });
  const regras = await regrasDaAgenda();
  const { de, ate } = janelaDeAgendamento(quando, regras);
  const consultores = await consultoresAtivos();
  return horariosLivres({ agora: quando, consultores, ocupados: await ocupados(de, ate, { leadId, tipo }), consultorPreferido: lead?.consultorId, limite, aPartirDe, regras, tipo });
}

/**
 * Horários livres do dia escolhido no calendário, com o dia anterior e o seguinte (para o consultor comparar).
 * Sem dia escolhido, centra no primeiro dia com horário livre. Vale para qualquer data futura (o limite de
 * `diasAFrente` é só da lista automática). `primeiroDia` = primeiro dia que pode ser marcado (o calendário bloqueia antes).
 */
export async function horariosLivresEmTorno(leadId: string, tipo: TipoCompromisso = "visita", dia?: Date | null) {
  const quando = await agora();
  const regras = await regrasDaAgenda();
  const primeiroDia = primeiroDiaAgendavel(quando, regras, tipo);
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { consultorId: true } });
  const consultores = await consultoresAtivos();
  const livresEm = async (periodo: { de: Date; ate: Date }, limite: number) =>
    horariosLivres({
      agora: quando,
      consultores,
      ocupados: await ocupados(periodo.de, periodo.ate, { leadId, tipo }),
      consultorPreferido: lead?.consultorId,
      limite,
      regras,
      tipo,
      periodo,
    });
  let centro = dia ? inicioDoDiaLocal(dia) : null;
  if (!centro) {
    // Sem dia escolhido: o primeiro dia com horário livre, contando hoje (depois da próxima hora cheia).
    const [primeira] = await livresEm({ de: primeiroDia, ate: janelaDeAgendamento(quando, regras).ate }, 1);
    centro = primeira ? inicioDoDiaLocal(primeira.inicio) : primeiroDia;
  }
  const livres = await livresEm({ de: somarDias(centro, -1), ate: somarDias(centro, 2) }, Number.POSITIVE_INFINITY);
  return { centro, primeiroDia, livres };
}

const ORDEM_ETAPA = Object.fromEntries(ETAPAS.map((e, i) => [e.codigo, i])) as Record<CodigoEtapa, number>;

/**
 * Para onde o card vai quando o compromisso é marcado (tarefa 21): medição → "Medição agendada", apresentação →
 * "Apresentação agendada". Nunca volta o card de etapa mais avançada (ex.: em Negociação continua em Negociação);
 * Perdido volta para o funil (o cliente voltou). Visita à loja não move o card (ele continua em qualificação).
 */
export function etapaAoAgendar(etapaAtual: string, tipo: TipoCompromisso): CodigoEtapa | null {
  if (tipo === "visita") return null;
  if (etapaAtual === "perdido") return tipo;
  const atual = ORDEM_ETAPA[etapaAtual as CodigoEtapa];
  return atual === undefined || atual < ORDEM_ETAPA[tipo] ? tipo : null;
}

/** Eventos do painel: conta um por lead (remarcar não soma). */
const EVENTO_DO_TIPO = { visita: "visita_agendada", medicao: "medicao_agendada", apresentacao: "apresentacao_agendada" } as const;

/**
 * Marca a visita. A checagem e a gravação acontecem juntas; a chave única da vaga
 * garante que dois agendamentos simultâneos no mesmo horário da loja não passem.
 */
export async function agendarVisita(params: { leadId: string; inicio: Date; consultorId?: string | null; autor: string; tipo?: TipoCompromisso }) {
  const quando = await agora();
  const tipo = params.tipo ?? "visita";
  const nomeTipo = NOMES_COMPROMISSO[tipo].toLowerCase();
  const { inicio } = params;
  const regras = await regrasDaAgenda();
  if (!horarioDentroDaRegra(inicio, regras, tipo)) throw new ErroAgenda(tipo === "medicao" ? "Horário fora do funcionamento da loja (a medição inteira precisa caber no horário)." : "Horário fora do funcionamento da loja.");
  // Dá para marcar no mesmo dia, a partir da próxima hora cheia (às 9h30, só 10h em diante).
  if (inicio.getTime() < primeiroHorarioPossivel(quando).getTime()) {
    throw new ErroAgenda(inicio.getTime() <= quando.getTime() ? "Horário já passou." : `Só dá para marcar a partir das ${partesLocais(primeiroHorarioPossivel(quando)).hora}h.`);
  }
  const fim = new Date(inicio.getTime() + duracaoVisitaMs(regras, tipo));
  const lead = await db.lead.findUniqueOrThrow({ where: { id: params.leadId } });

  // Consultor escolhido; senão o consultor do lead; senão o primeiro livre.
  const ativos = await consultoresAtivos();
  const lista = params.consultorId
    ? [params.consultorId]
    : lead.consultorId
      ? [lead.consultorId, ...ativos.filter((c) => c !== lead.consultorId)]
      : ativos;
  const ocupado = await ocupados(inicio, fim, { leadId: lead.id, tipo });
  const consultorId = lista.find((c) => vagaLivre({ consultorId: c, inicio, fim }, ocupado, regras, tipo));
  if (!consultorId) throw new ErroAgenda(params.consultorId ? "O consultor já tem compromisso nesse horário." : "Esse horário não está mais livre.");

  // Um compromisso ativo de cada tipo por lead: o anterior do mesmo tipo é cancelado (remarcação).
  const anteriores = await db.visita.findMany({ where: { leadId: lead.id, status: "agendada", tipo } });

  let visita;
  try {
    visita = await db.$transaction(async (tx) => {
      for (const v of anteriores) await tx.visita.update({ where: { id: v.id }, data: { status: "cancelada", vagaChave: null } });
      return tx.visita.create({
        data: { leadId: lead.id, consultorId, inicio, fim, tipo, vagaChave: chaveVaga(consultorId, inicio, regras, tipo), criadoPor: params.autor, criadoEm: quando },
        include: { consultor: { select: { nome: true } } },
      });
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") throw new ErroAgenda("Esse horário não está mais livre.");
    throw erro;
  }

  await db.lead.update({ where: { id: lead.id }, data: { consultorId } });
  await registrarUmaVez(lead.id, EVENTO_DO_TIPO[tipo], consultorId);
  // Remarcar medição ou apresentação depois que a data venceu = o compromisso não aconteceu (cliente faltou). Conta no Painel.
  const faltou = tipo !== "visita" ? anteriores.find((v) => venceu(v.inicio, quando)) : undefined;
  if (faltou) {
    await registrarEvento("nao_compareceu", faltou.consultorId);
    await registrarAlteracao(lead.id, params.autor, `Cliente não compareceu à ${nomeTipo} de ${formatarVisitaCurta(faltou.inicio)}`);
  }
  await registrarAlteracao(lead.id, params.autor, `${anteriores.length ? "Remarcou" : "Agendou"} ${nomeTipo}: ${formatarVisitaCurta(inicio)} com ${visita.consultor.nome}`);
  // AGENDA-04: medição e apresentação movem o card (sem voltar etapas mais avançadas).
  const destino = etapaAoAgendar(lead.etapa, tipo);
  if (destino) await moverEtapa(lead.id, destino, params.autor);
  await atualizarResumo(lead.id);
  // Aviso só quando o bot marca: quem marca pela tela já sabe que marcou.
  if (params.autor === "bot") await registrarAlerta({ tipo: "visita_marcada", leadId: lead.id, texto: formatarVisitaCurta(inicio) });
  await marcarMudanca();
  return visita;
}

export async function cancelarVisita(visitaId: string, autor: string) {
  if (!(await db.visita.findUnique({ where: { id: visitaId }, select: { id: true } }))) throw new ErroAgenda("Compromisso não encontrado.");
  const visita = await db.visita.update({ where: { id: visitaId }, data: { status: "cancelada", vagaChave: null } });
  await registrarAlteracao(visita.leadId, autor, `Cancelou ${NOMES_COMPROMISSO[visita.tipo as TipoCompromisso]?.toLowerCase() ?? "o compromisso"} de ${formatarVisitaCurta(visita.inicio)}`);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: visita.leadId } });
  // Card na coluna do compromisso cancelado, sem outro igual marcado: volta para a medição (se houver uma marcada) ou para Em qualificação.
  if (lead.etapa === visita.tipo && (visita.tipo === "medicao" || visita.tipo === "apresentacao")) {
    const ativos = await db.visita.findMany({ where: { leadId: lead.id, status: "agendada" }, select: { tipo: true } });
    if (!ativos.some((a) => a.tipo === visita.tipo)) {
      const volta: CodigoEtapa = visita.tipo === "apresentacao" && ativos.some((a) => a.tipo === "medicao") ? "medicao" : "qualificacao";
      await moverEtapa(lead.id, volta, autor, { semExigencias: true });
    }
  }
  await atualizarResumo(lead.id);
  await marcarMudanca();
}

export async function criarBloqueio(params: { consultorId: string; inicio: Date; fim: Date; motivo?: string; autor: string }) {
  if (params.fim <= params.inicio) throw new ErroAgenda("O fim do bloqueio precisa ser depois do início.");
  const conflito = await db.visita.findFirst({
    where: { consultorId: params.consultorId, status: "agendada", inicio: { lt: params.fim }, fim: { gt: params.inicio } },
  });
  if (conflito) throw new ErroAgenda("Já existe compromisso nesse período. Remarque ou cancele antes de bloquear.");
  const bloqueio = await db.bloqueio.create({
    data: { consultorId: params.consultorId, inicio: params.inicio, fim: params.fim, motivo: params.motivo, criadoEm: await agora() },
  });
  await marcarMudanca();
  return bloqueio;
}

export async function removerBloqueio(id: string) {
  const r = await db.bloqueio.deleteMany({ where: { id } });
  if (!r.count) throw new ErroAgenda("Bloqueio não encontrado.");
  await marcarMudanca();
}
