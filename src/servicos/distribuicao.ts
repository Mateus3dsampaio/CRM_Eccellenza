import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { escolherConsultor, type StatusConsultor } from "@/regras/distribuicao";
import { filaPodeSerEntregue, leadNovoPodeTerDono } from "@/regras/presenca";
import { CHAVE_ULTIMO_RODIZIO, gravarConfig, lerConfig, modoDistribuicao, regrasDaAgenda, regrasDePresenca } from "./configuracoes";
import { registrarAlteracao } from "./historico";

/** Escolhe quem recebe o próximo lead e, no rodízio, guarda quem foi. Sem consultor online: null. */
export async function escolherProximoConsultor(): Promise<string | null> {
  // Loja fechada: o lead é atendido pelo bot e fica na fila, sem dono (tarefa 35).
  if (!leadNovoPodeTerDono(await agora(), await regrasDePresenca(), await regrasDaAgenda())) return null;
  const consultores = await db.usuario.findMany({
    where: { perfil: "consultor", ativo: true },
    orderBy: [{ criadoEm: "asc" }, { nome: "asc" }],
    select: { id: true, status: true, _count: { select: { leads: { where: { arquivadoEm: null, etapa: { notIn: ["fechado", "perdido"] } } } } } },
  });
  const modo = await modoDistribuicao();
  const escolhido = escolherConsultor(
    modo,
    consultores.map((c) => ({ id: c.id, online: c.status === "online", leadsEmAndamento: c._count.leads })),
    await lerConfig(CHAVE_ULTIMO_RODIZIO),
  );
  if (escolhido && modo === "rodizio") await gravarConfig(CHAVE_ULTIMO_RODIZIO, escolhido);
  return escolhido;
}

/** Leads que o bot já passou, mas que ficaram sem consultor porque ninguém estava online. */
export function leadsNaFila() {
  return db.lead.findMany({
    where: { consultorId: null, arquivadoEm: null, etapa: { not: "perdido" }, modoAtendimento: { not: "bot" }, aguardandoHumano: true },
    orderBy: { atualizadoEm: "asc" },
    select: { id: true },
  });
}

/**
 * Entrega a fila para quem está online (chamada quando um consultor volta e pela rotina de repartir).
 * Com a loja fechada, ou antes do horário de repartir (Configurações > Presença e fila), não entrega nada.
 */
export async function distribuirFila(): Promise<number> {
  if (!filaPodeSerEntregue(await agora(), await regrasDePresenca(), await regrasDaAgenda())) return 0;
  let total = 0;
  for (const lead of await leadsNaFila()) {
    const consultorId = await escolherProximoConsultor();
    if (!consultorId) break;
    await db.lead.update({ where: { id: lead.id }, data: { consultorId } });
    await registrarAlteracao(lead.id, "sistema", "Lead da fila entregue ao consultor que ficou online");
    total++;
  }
  if (total) await marcarMudanca();
  return total;
}

const LEADS_EM_ANDAMENTO = { arquivadoEm: null, etapa: { notIn: ["fechado", "perdido"] } };

export function contarLeadsEmAndamento(consultorId: string): Promise<number> {
  return db.lead.count({ where: { consultorId, ...LEADS_EM_ANDAMENTO } });
}

async function consultorDestino(paraId: string) {
  const para = await db.usuario.findUnique({ where: { id: paraId } });
  if (!para || !para.ativo || para.perfil !== "consultor") throw new Error("Os leads só podem ir para um consultor ativo.");
  return para;
}

/**
 * Passa os leads em andamento (não arquivados, fora de Fechado e Perdido) de um consultor para outro.
 * A conversa, a espera do cliente e as não lidas seguem junto. Devolve quantos foram.
 */
export async function transferirLeads(deId: string, paraId: string, autor: string): Promise<number> {
  if (deId === paraId) throw new Error("Escolha um consultor diferente.");
  const de = await db.usuario.findUniqueOrThrow({ where: { id: deId } });
  const para = await consultorDestino(paraId);
  const leads = await db.lead.findMany({ where: { consultorId: deId, ...LEADS_EM_ANDAMENTO }, select: { id: true } });
  for (const lead of leads) {
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: paraId } });
    await registrarAlteracao(lead.id, autor, `Lead transferido de ${de.nome} para ${para.nome}`);
  }
  if (leads.length) await marcarMudanca();
  return leads.length;
}

/** Passa um lead só (qualquer etapa) para outro consultor ativo, mesmo que hoje não tenha dono. */
export async function transferirLead(leadId: string, paraId: string, autor: string): Promise<void> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { consultor: { select: { nome: true } } } });
  if (lead.consultorId === paraId) throw new Error("O lead já está com esse consultor.");
  const para = await consultorDestino(paraId);
  await db.lead.update({ where: { id: leadId }, data: { consultorId: paraId } });
  await registrarAlteracao(leadId, autor, `Lead transferido de ${lead.consultor?.nome ?? "ninguém (sem consultor)"} para ${para.nome}`);
  await marcarMudanca();
}

/** Muda a disponibilidade do consultor. Ao voltar (online) ele recebe a fila e volta ao rodízio. */
export async function definirStatusConsultor(usuarioId: string, status: StatusConsultor): Promise<void> {
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  if (usuario.status === status) return;
  await db.usuario.update({
    where: { id: usuarioId },
    // Cada almoço novo conta uma vez, para o aviso ao cliente sair uma vez por almoço.
    data: { status, almocoSeq: status === "almoco" ? usuario.almocoSeq + 1 : usuario.almocoSeq },
  });
  await marcarMudanca();
  if (status === "online") await distribuirFila();
}
