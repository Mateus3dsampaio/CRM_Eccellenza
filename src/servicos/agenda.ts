import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import {
  DURACAO_VISITA_MS,
  chaveVaga,
  horarioDentroDaRegra,
  horariosLivres,
  janelaDeAgendamento,
  vagaLivre,
  type Intervalo,
} from "@/regras/agenda";
import { formatarVisitaCurta } from "@/regras/tempo";
import { registrarAlteracao } from "./historico";
import { atualizarResumo, moverEtapa } from "./leads";
import { registrarUmaVez } from "./metricas";

export class ErroAgenda extends Error {}

async function consultoresAtivos(): Promise<string[]> {
  const lista = await db.usuario.findMany({ where: { perfil: "consultor", ativo: true }, orderBy: { nome: "asc" }, select: { id: true } });
  return lista.map((c) => c.id);
}

/** Visitas ativas e bloqueios no período. As visitas do próprio lead não contam (remarcação). */
async function ocupados(de: Date, ate: Date, ignorarLeadId?: string): Promise<Intervalo[]> {
  const [visitas, bloqueios] = await Promise.all([
    db.visita.findMany({ where: { status: "agendada", inicio: { lt: ate }, fim: { gt: de }, leadId: ignorarLeadId ? { not: ignorarLeadId } : undefined } }),
    db.bloqueio.findMany({ where: { inicio: { lt: ate }, fim: { gt: de } } }),
  ]);
  return [
    ...visitas.map((v) => ({ consultorId: v.consultorId, inicio: v.inicio, fim: v.fim, tipo: "visita" as const })),
    ...bloqueios.map((b) => ({ consultorId: b.consultorId, inicio: b.inicio, fim: b.fim, tipo: "bloqueio" as const })),
  ];
}

/** Horários livres que o bot pode oferecer (AGENDA-02). */
export async function horariosLivresParaLead(leadId: string, limite = 3, aPartirDe?: Date) {
  const quando = await agora();
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { consultorId: true } });
  const { de, ate } = janelaDeAgendamento(quando);
  const consultores = await consultoresAtivos();
  return horariosLivres({ agora: quando, consultores, ocupados: await ocupados(de, ate, leadId), consultorPreferido: lead?.consultorId, limite, aPartirDe });
}

/**
 * Marca a visita. A checagem e a gravação acontecem juntas; a chave única da vaga
 * garante que dois agendamentos simultâneos no mesmo horário da loja não passem.
 */
export async function agendarVisita(params: { leadId: string; inicio: Date; consultorId?: string | null; autor: string; validarJanelaDoBot?: boolean; tipo?: "visita" | "apresentacao" }) {
  const quando = await agora();
  const tipo = params.tipo ?? "visita";
  const nomeTipo = tipo === "apresentacao" ? "apresentação" : "visita";
  const { inicio } = params;
  if (!horarioDentroDaRegra(inicio)) throw new ErroAgenda("Horário fora do funcionamento da loja.");
  if (inicio.getTime() <= quando.getTime()) throw new ErroAgenda("Horário já passou.");
  if (params.validarJanelaDoBot) {
    const { de, ate } = janelaDeAgendamento(quando);
    if (inicio < de || inicio >= ate) throw new ErroAgenda("Horário fora da janela de agendamento (próximo dia útil até 14 dias).");
  }
  const fim = new Date(inicio.getTime() + DURACAO_VISITA_MS);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: params.leadId } });

  // Consultor escolhido; senão o consultor do lead; senão o primeiro livre.
  const ativos = await consultoresAtivos();
  const lista = params.consultorId
    ? [params.consultorId]
    : lead.consultorId
      ? [lead.consultorId, ...ativos.filter((c) => c !== lead.consultorId)]
      : ativos;
  const ocupado = await ocupados(inicio, fim, lead.id);
  const consultorId = lista.find((c) => vagaLivre({ consultorId: c, inicio, fim }, ocupado));
  if (!consultorId) throw new ErroAgenda("Esse horário não está mais livre.");

  // Um compromisso ativo de cada tipo por lead: o anterior do mesmo tipo é cancelado (remarcação).
  const anteriores = await db.visita.findMany({ where: { leadId: lead.id, status: "agendada", tipo } });

  let visita;
  try {
    visita = await db.$transaction(async (tx) => {
      for (const v of anteriores) await tx.visita.update({ where: { id: v.id }, data: { status: "cancelada", vagaChave: null } });
      return tx.visita.create({
        data: { leadId: lead.id, consultorId, inicio, fim, tipo, vagaChave: chaveVaga(consultorId, inicio), criadoPor: params.autor, criadoEm: quando },
        include: { consultor: { select: { nome: true } } },
      });
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") throw new ErroAgenda("Esse horário não está mais livre.");
    throw erro;
  }

  await db.lead.update({ where: { id: lead.id }, data: { consultorId } });
  // Conta uma visita por lead: remarcar não soma no painel. Apresentação na loja não entra nessa conta.
  if (tipo === "visita") await registrarUmaVez(lead.id, "visita_agendada", consultorId);
  await registrarAlteracao(lead.id, params.autor, `${anteriores.length ? "Remarcou" : "Agendou"} ${nomeTipo}: ${formatarVisitaCurta(inicio)} com ${visita.consultor.nome}`);
  // AGENDA-04: visita agendada move o card (sem voltar etapas mais avançadas).
  if (tipo === "visita" && ["novo", "pronto", "sem_resposta"].includes(lead.etapa)) await moverEtapa(lead.id, "visita", params.autor);
  await atualizarResumo(lead.id);
  await marcarMudanca();
  return visita;
}

export async function cancelarVisita(visitaId: string, autor: string) {
  if (!(await db.visita.findUnique({ where: { id: visitaId }, select: { id: true } }))) throw new ErroAgenda("Visita não encontrada.");
  const visita = await db.visita.update({ where: { id: visitaId }, data: { status: "cancelada", vagaChave: null } });
  await registrarAlteracao(visita.leadId, autor, `Cancelou ${visita.tipo === "apresentacao" ? "a apresentação" : "a visita"} de ${formatarVisitaCurta(visita.inicio)}`);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: visita.leadId } });
  const outra = await db.visita.count({ where: { leadId: lead.id, status: "agendada", tipo: "visita" } });
  if (visita.tipo === "visita" && !outra && lead.etapa === "visita") await moverEtapa(lead.id, "pronto", autor);
  await atualizarResumo(lead.id);
  await marcarMudanca();
}

export async function criarBloqueio(params: { consultorId: string; inicio: Date; fim: Date; motivo?: string; autor: string }) {
  if (params.fim <= params.inicio) throw new ErroAgenda("O fim do bloqueio precisa ser depois do início.");
  const conflito = await db.visita.findFirst({
    where: { consultorId: params.consultorId, status: "agendada", inicio: { lt: params.fim }, fim: { gt: params.inicio } },
  });
  if (conflito) throw new ErroAgenda("Já existe visita nesse período. Remarque ou cancele a visita antes de bloquear.");
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
