import { db } from "@/lib/db";
import { ETAPAS_ANTIGAS } from "@/regras/etapas";
import { MOTIVO_PAROU_DE_RESPONDER } from "@/regras/vendas";
import { garantirMotivoParouDeResponder } from "./vendas";

/**
 * Conversão única do funil antigo (tarefa 21), rodada ao subir o servidor. Não faz nada se não houver card antigo.
 * Visita agendada → Apresentação agendada; Orçamento apresentado → Negociação; Sem resposta → Perdido "Parou de responder".
 * O histórico de mudanças de etapa continua com os nomes antigos (é o que aconteceu).
 */
export async function converterFunilAntigo(): Promise<number> {
  const antigos = Object.keys(ETAPAS_ANTIGAS);
  if (!(await db.lead.count({ where: { etapa: { in: antigos } } }))) return 0;
  await garantirMotivoParouDeResponder();
  let total = 0;
  for (const [de, para] of Object.entries(ETAPAS_ANTIGAS)) {
    const r = await db.lead.updateMany({
      where: { etapa: de },
      data: de === "sem_resposta" ? { etapa: para, motivoPerda: MOTIVO_PAROU_DE_RESPONDER } : { etapa: para },
    });
    total += r.count;
  }
  return total;
}
