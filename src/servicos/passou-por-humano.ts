import { db } from "@/lib/db";

/**
 * Leads (dentre `ids`) em que um consultor já entrou na conversa em algum momento: o bot passou o lead (`repassadoEm`),
 * alguém assumiu a conversa (registro "Assumiu a conversa" na ficha) ou um consultor/admin escreveu ao cliente.
 * Decisão do Mateus 17/11/2026: esses leads nunca mais recebem mensagem automática nem são movidos pelas rotinas
 * (recuperação e rede de segurança), mesmo depois de "Devolver ao bot". Quem decide é o vendedor.
 */
export async function idsQuePassaramPorHumano(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const [repassados, assumidos, escritos] = await Promise.all([
    db.lead.findMany({ where: { id: { in: ids }, repassadoEm: { not: null } }, select: { id: true } }),
    db.alteracao.findMany({ where: { leadId: { in: ids }, descricao: { startsWith: "Assumiu a conversa" } }, select: { leadId: true }, distinct: ["leadId"] }),
    db.mensagem.findMany({ where: { leadId: { in: ids }, autor: "consultor" }, select: { leadId: true }, distinct: ["leadId"] }),
  ]);
  return new Set([...repassados.map((l) => l.id), ...assumidos.map((a) => a.leadId), ...escritos.map((m) => m.leadId)]);
}
