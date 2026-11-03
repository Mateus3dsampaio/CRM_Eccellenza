import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { DIAS_ALERTA_GUARDADO, type TipoAlerta } from "@/regras/alertas";
import { nomeExibicao } from "@/regras/telefone";
import { DIA } from "@/regras/tempo";

const LIMITE_POR_CONSULTA = 50;

/**
 * Guarda um aviso para quem atende. O dono é o consultor do lead nesta hora; sem dono, só o admin recebe.
 * Quem chama já vai marcar a mudança (as telas então buscam os avisos novos).
 */
export async function registrarAlerta(params: { tipo: TipoAlerta; leadId: string; texto?: string | null }): Promise<void> {
  const lead = await db.lead.findUnique({ where: { id: params.leadId }, include: { consultor: { select: { id: true, nome: true } } } });
  if (!lead) return;
  const quando = await agora();
  await db.alerta.create({
    data: {
      tipo: params.tipo,
      leadId: lead.id,
      leadNome: nomeExibicao(lead),
      consultorId: lead.consultor?.id ?? null,
      consultorNome: lead.consultor?.nome ?? null,
      texto: params.texto ?? null,
      criadoEm: quando,
    },
  });
  // Aviso velho não serve para nada: limpa junto.
  await db.alerta.deleteMany({ where: { criadoEm: { lt: new Date(quando.getTime() - DIAS_ALERTA_GUARDADO * DIA) } } });
}

/**
 * Avisos novos para o usuário. Sem `depois` (primeira consulta da tela) não devolve aviso nenhum, só o ponto de partida:
 * quem abre o CRM não recebe de uma vez o que aconteceu antes. O consultor recebe só os dos seus leads; o admin, todos.
 */
export async function alertasDesde(usuario: { id: string; perfil: string }, depois?: number) {
  const ultimo = (await db.alerta.aggregate({ _max: { id: true } }))._max.id ?? 0;
  if (depois === undefined) return { eventos: [], ultimoId: ultimo };
  const linhas = await db.alerta.findMany({
    where: { id: { gt: depois }, ...(usuario.perfil === "admin" ? {} : { consultorId: usuario.id }) },
    orderBy: { id: "asc" },
    take: LIMITE_POR_CONSULTA,
  });
  const cheio = linhas.length === LIMITE_POR_CONSULTA;
  return {
    eventos: linhas.map((a) => ({
      id: a.id,
      tipo: a.tipo as TipoAlerta,
      leadId: a.leadId,
      leadNome: a.leadNome,
      consultorId: a.consultorId,
      consultorNome: a.consultorNome,
      texto: a.texto,
    })),
    // Se veio muita coisa de uma vez, a próxima consulta continua de onde esta parou.
    ultimoId: cheio ? linhas[linhas.length - 1].id : ultimo,
  };
}
