import { db } from "@/lib/db";
import { lerLista } from "@/lib/json";
import { agora } from "@/lib/relogio";

// Contadores anônimos (MET-03, LIMP-06): gravados no momento do evento, sem nome, telefone ou texto.
export type TipoEvento =
  | "lead_novo"
  | "qualificado"
  | "curioso"
  | "outra_cidade"
  | "parceiro"
  | "pos_venda"
  | "ja_atendido"
  | "sem_resposta"
  | "retomada_enviada"
  | "retomada_voltou"
  | "visita_agendada"
  | "medicao_agendada"
  | "apresentacao_agendada"
  | "nao_compareceu"
  | "recuperacao_primeira"
  | "recuperacao_segunda"
  | "recuperacao_respondeu_primeira"
  | "recuperacao_respondeu_segunda"
  | "recuperacao_perdido"
  | `etapa_${string}`;

export async function registrarEvento(tipo: TipoEvento, consultorId?: string | null, quando?: Date): Promise<void> {
  await db.eventoMetrica.create({ data: { tipo, consultorId: consultorId ?? null, ocorridoEm: quando ?? (await agora()) } });
}

/** Registra o evento só uma vez por lead (a marca fica no lead e some com ele). */
export async function registrarUmaVez(leadId: string, tipo: TipoEvento, consultorId?: string | null): Promise<void> {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { marcasMetricas: true } });
  if (!lead) return;
  const marcas = lerLista(lead.marcasMetricas);
  if (marcas.includes(tipo)) return;
  await db.lead.update({ where: { id: leadId }, data: { marcasMetricas: JSON.stringify([...marcas, tipo]) } });
  await registrarEvento(tipo, consultorId);
}
