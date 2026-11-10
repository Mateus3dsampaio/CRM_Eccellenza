import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { ErroHttp } from "@/lib/sessao";
import { lerMetas, periodoDoPlacar, precisaConfirmarEstimativa, TEXTO_ESTIMATIVA, TEXTO_MEDICAO_PENDENTE, validarMeta, type ContagemDoVendedor, type MetasApresentacao } from "@/regras/apresentacao";
import { inicioDoDiaLocal, formatarVisitaCurta } from "@/regras/tempo";
import { gravarConfig, lerConfig } from "./configuracoes";
import { registrarAlteracao } from "./historico";

const CHAVE_METAS = "metas_apresentacao";
const ETAPAS_FORA = ["perdido", "fechado"];

export async function metasDeApresentacao(): Promise<MetasApresentacao> {
  return lerMetas(await lerConfig(CHAVE_METAS));
}

/** Grava a meta de cada vendedor (número inteiro; null ou 0 tira a meta). Só mexe nos ids enviados. */
export async function definirMetasDeApresentacao(novas: Record<string, number | null>): Promise<void> {
  for (const v of Object.values(novas)) {
    const erro = validarMeta(v);
    if (erro) throw new ErroHttp(400, erro);
  }
  const consultores = await db.usuario.findMany({ where: { perfil: "consultor" }, select: { id: true } });
  const validos = new Set(consultores.map((u) => u.id));
  const metas = await metasDeApresentacao();
  for (const [id, v] of Object.entries(novas)) {
    if (!validos.has(id)) continue;
    if (v) metas[id] = v;
    else delete metas[id];
  }
  await gravarConfig(CHAVE_METAS, JSON.stringify(metas));
  await marcarMudanca();
}

export interface PlacarDoMes {
  nomeDoMes: string;
  diasRestantes: number;
  vendedores: { id: string; nome: string }[];
  contagens: Record<string, ContagemDoVendedor>;
  metas: MetasApresentacao;
}

/**
 * Placar da apresentação no mês de Fortaleza. Consultor recebe só o dele; admin recebe todos.
 * Realizada: apresentação concluída com a data no mês (do consultor da apresentação). Agendada: do mês com data de hoje
 * em diante, mais as vencidas ainda sem decisão (só enquanto o lead está na coluna Apresentação).
 */
export async function placarDoMes(usuario: { id: string; perfil: string }): Promise<PlacarDoMes> {
  const quando = await agora();
  const per = periodoDoPlacar(quando);
  const hoje = inicioDoDiaLocal(quando);
  const admin = usuario.perfil === "admin";
  const vendedores = await db.usuario.findMany({ where: { perfil: "consultor", ativo: true, ...(admin ? {} : { id: usuario.id }) }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
  const visitas = await db.visita.findMany({
    where: {
      tipo: "apresentacao",
      consultorId: { in: vendedores.map((v) => v.id) },
      OR: [{ concluidaEm: { not: null }, inicio: { gte: per.inicio, lt: per.fim } }, { status: "agendada", concluidaEm: null }],
    },
    select: { consultorId: true, inicio: true, concluidaEm: true, lead: { select: { etapa: true, arquivadoEm: true } } },
  });
  const contagens: Record<string, ContagemDoVendedor> = Object.fromEntries(vendedores.map((v) => [v.id, { realizadas: 0, agendadas: 0 }]));
  for (const v of visitas) {
    const c = contagens[v.consultorId];
    if (!c) continue;
    if (v.concluidaEm) {
      c.realizadas++;
      continue;
    }
    if (v.lead.arquivadoEm || ETAPAS_FORA.includes(v.lead.etapa)) continue;
    const noMes = v.inicio >= per.inicio && v.inicio < per.fim;
    const vencidaSemDecisao = v.inicio < hoje && v.lead.etapa === "apresentacao";
    if ((noMes && v.inicio >= hoje) || vencidaSemDecisao) c.agendadas++;
  }
  const metas = await metasDeApresentacao();
  return {
    nomeDoMes: per.nomeDoMes,
    diasRestantes: per.diasRestantes,
    vendedores,
    contagens,
    metas: admin ? metas : Object.fromEntries(Object.entries(metas).filter(([id]) => id === usuario.id)),
  };
}

/** Medição concluída (sem obrigar a marcar a apresentação). O card fica em Medição agendada, pronto para marcar. */
export async function concluirMedicao(leadId: string, autor: string): Promise<void> {
  const quando = await agora();
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { etapa: true } });
  const medicao = await db.visita.findFirst({ where: { leadId, tipo: "medicao", status: "agendada", concluidaEm: null }, orderBy: { inicio: "desc" } });
  if (lead.etapa !== "medicao" || !medicao) throw new ErroHttp(400, "Este lead não tem medição marcada para concluir.");
  await db.visita.update({ where: { id: medicao.id }, data: { concluidaEm: quando } });
  await registrarAlteracao(leadId, autor, `Concluiu a medição de ${formatarVisitaCurta(medicao.inicio)}`);
  await marcarMudanca();
}

/** "Cliente tem projeto: pular medição" (ou desfazer). Só em Em qualificação. O lead fica pronto para marcar a apresentação. */
export async function pularMedicao(leadId: string, pular: boolean, autor: string): Promise<void> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { etapa: true, pulouMedicaoEm: true } });
  if (pular) {
    if (lead.etapa !== "qualificacao") throw new ErroHttp(400, "Só dá para pular a medição de quem está em Em qualificação.");
    if (lead.pulouMedicaoEm) return;
    await db.lead.update({ where: { id: leadId }, data: { pulouMedicaoEm: await agora() } });
    await registrarAlteracao(leadId, autor, "Marcou: cliente tem projeto, pulou a medição (pronto para marcar a apresentação)");
  } else {
    if (!lead.pulouMedicaoEm) return;
    await db.lead.update({ where: { id: leadId }, data: { pulouMedicaoEm: null, estimativaAlinhadaEm: null } });
    await registrarAlteracao(leadId, autor, "Desfez: cliente tem projeto (voltou a precisar de medição)");
  }
  await marcarMudanca();
}

/** O que falta para marcar a apresentação deste lead (a tela pergunta, o servidor confere). */
export async function preparoDaApresentacao(leadId: string): Promise<{ medicaoPendente: boolean; estimativaPendente: boolean; semMedicao: boolean }> {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { estimativaAlinhadaEm: true, visitas: { where: { status: "agendada", tipo: { in: ["medicao", "apresentacao"] } }, select: { tipo: true, concluidaEm: true } } } });
  if (!lead) return { medicaoPendente: false, estimativaPendente: false, semMedicao: false };
  const medicoes = lead.visitas.filter((v) => v.tipo === "medicao");
  const medicaoConcluida = medicoes.some((v) => v.concluidaEm);
  const jaApresentou = lead.visitas.some((v) => v.tipo === "apresentacao" && v.concluidaEm);
  return { medicaoPendente: medicoes.some((v) => !v.concluidaEm), estimativaPendente: precisaConfirmarEstimativa({ estimativaAlinhadaEm: lead.estimativaAlinhadaEm, medicaoConcluida, jaApresentou }), semMedicao: !medicaoConcluida };
}

/**
 * O vendedor respondeu "sim, já alinhei" à estimativa de valores: grava no histórico (quem e quando) e libera a agenda.
 * Sem medição concluída, o cliente passa a constar como "tem projeto" (é isso ou a medição que permite entrar em Apresentação).
 */
export async function confirmarEstimativa(leadId: string, autor: string): Promise<void> {
  const quando = await agora();
  const { semMedicao } = await preparoDaApresentacao(leadId);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { pulouMedicaoEm: true } });
  const marcarProjeto = semMedicao && !lead.pulouMedicaoEm;
  await db.lead.update({ where: { id: leadId }, data: { estimativaAlinhadaEm: quando, ...(marcarProjeto ? { pulouMedicaoEm: quando } : {}) } });
  await registrarAlteracao(leadId, autor, TEXTO_ESTIMATIVA.historico);
  if (marcarProjeto) await registrarAlteracao(leadId, autor, "Cliente tem projeto: segue sem medição");
  await marcarMudanca();
}

/** A agenda não marca a apresentação com medição pendente nem sem a estimativa de valores confirmada. */
export async function exigirPreparoDaApresentacao(leadId: string): Promise<void> {
  const p = await preparoDaApresentacao(leadId);
  if (p.medicaoPendente) throw new ErroHttp(409, TEXTO_MEDICAO_PENDENTE);
  if (p.estimativaPendente) throw new ErroHttp(409, "Confirme que a estimativa de valores foi alinhada com o cliente antes de marcar a apresentação.");
}

/** Lead que passa pela apresentação (Apresentação → Negociação/Fechado) tem a apresentação ativa concluída. */
export async function concluirApresentacao(leadId: string, autor: string, quando: Date): Promise<void> {
  const ativas = await db.visita.findMany({ where: { leadId, tipo: "apresentacao", status: "agendada", concluidaEm: null } });
  for (const v of ativas) {
    await db.visita.update({ where: { id: v.id }, data: { concluidaEm: quando } });
    await registrarAlteracao(leadId, autor, `Concluiu a apresentação de ${formatarVisitaCurta(v.inicio)}`);
  }
}

/**
 * Conversão única (ao subir o servidor): apresentações de antes desta mudança que o histórico mostra como realizadas
 * (card foi de Apresentação para Negociação/Fechado) recebem a conclusão na data dessa passagem. Devolve quantas converteu.
 */
export async function converterApresentacoesAntigas(): Promise<number> {
  const pendentes = await db.visita.findMany({
    where: { tipo: "apresentacao", status: "agendada", concluidaEm: null, lead: { etapa: { in: ["negociacao", "fechado"] } } },
    select: { id: true, leadId: true, criadoEm: true },
  });
  let total = 0;
  for (const v of pendentes) {
    const passou = await db.mudancaEtapa.findFirst({
      where: { leadId: v.leadId, de: "apresentacao", para: { in: ["negociacao", "fechado"] }, criadoEm: { gte: v.criadoEm } },
      orderBy: { criadoEm: "desc" },
    });
    if (!passou) continue;
    await db.visita.update({ where: { id: v.id }, data: { concluidaEm: passou.criadoEm } });
    total++;
  }
  return total;
}
