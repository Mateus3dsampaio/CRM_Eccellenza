import { db } from "@/lib/db";
import { marcarMudanca } from "@/lib/versao";
import { escolherConsultor, type StatusConsultor } from "@/regras/distribuicao";
import { CHAVE_ULTIMO_RODIZIO, gravarConfig, lerConfig, modoDistribuicao } from "./configuracoes";
import { registrarAlteracao } from "./historico";

/** Escolhe quem recebe o próximo lead e, no rodízio, guarda quem foi. Sem consultor online: null. */
export async function escolherProximoConsultor(): Promise<string | null> {
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
    where: { consultorId: null, arquivadoEm: null, modoAtendimento: { not: "bot" }, aguardandoHumano: true },
    orderBy: { atualizadoEm: "asc" },
    select: { id: true },
  });
}

/** Entrega a fila para quem está online (chamada quando um consultor volta). */
export async function distribuirFila(): Promise<number> {
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
