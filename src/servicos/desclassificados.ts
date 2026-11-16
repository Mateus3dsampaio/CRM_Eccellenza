import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { avaliarDesclassificado, MOTIVOS_DESCLASSIFICADO, type RegrasDesclassificados } from "@/regras/desclassificados";
import { regrasDeDesclassificados } from "./configuracoes";
import { moverEtapa } from "./leads";
import { registrarUmaVez } from "./metricas";
import { garantirMotivoAutomatico } from "./vendas";

/** Leads que a regra moveria agora, com o motivo de cada um. `regras` permite simular (prévia da tela). */
export async function desclassificadosVencidos(regras: RegrasDesclassificados, quando: Date): Promise<{ id: string; consultorId: string | null; motivo: string }[]> {
  if (!regras.ligado) return [];
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, etapa: { notIn: ["perdido", "fechado"] }, modoAtendimento: "bot", aguardandoHumano: false, classificacao: { in: Object.keys(MOTIVOS_DESCLASSIFICADO) }, ultimaMsgClienteEm: { not: null } },
    include: { visitas: { where: { status: "agendada", inicio: { gt: quando } }, select: { id: true } } },
  });
  const vencidos: { id: string; consultorId: string | null; motivo: string }[] = [];
  for (const lead of leads) {
    const motivo = avaliarDesclassificado({ ...lead, temVisitaFutura: lead.visitas.length > 0 }, regras, quando);
    if (motivo) vencidos.push({ id: lead.id, consultorId: lead.consultorId, motivo });
  }
  return vencidos;
}

/**
 * Desclassificados (tarefa 40): lead com o bot classificado como outra cidade ou curioso / sem perfil vai para Perdido
 * depois de X horas sem o cliente escrever, sem nenhuma mensagem. Roda a cada minuto (`rodarRotinas`).
 * A regra fica em `regras/desclassificados.ts`; aqui só se grava. Devolve quantos foram movidos.
 */
export async function rodarDesclassificados(): Promise<number> {
  const vencidos = await desclassificadosVencidos(await regrasDeDesclassificados(), await agora());
  for (const lead of vencidos) {
    await garantirMotivoAutomatico(lead.motivo, Object.values(MOTIVOS_DESCLASSIFICADO).find((m) => m.codigo === lead.motivo)!.nome);
    await moverEtapa(lead.id, "perdido", "sistema", { guardarAnterior: true, semExigencias: true, dados: { motivoPerda: lead.motivo } });
    await registrarUmaVez(lead.id, "desclassificado_perdido", lead.consultorId);
  }
  if (vencidos.length) await marcarMudanca();
  return vencidos.length;
}
