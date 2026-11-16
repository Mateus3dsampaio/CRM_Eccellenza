import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { avaliarDesclassificado, MOTIVOS_DESCLASSIFICADO } from "@/regras/desclassificados";
import { regrasDeDesclassificados } from "./configuracoes";
import { moverEtapa } from "./leads";
import { registrarUmaVez } from "./metricas";
import { garantirMotivoAutomatico } from "./vendas";

/**
 * Desclassificados (tarefa 40): lead com o bot classificado como outra cidade ou curioso / sem perfil vai para Perdido
 * depois de X horas sem o cliente escrever, sem nenhuma mensagem. Roda a cada minuto (`rodarRotinas`).
 * A regra fica em `regras/desclassificados.ts`; aqui só se grava. Devolve quantos foram movidos.
 */
export async function rodarDesclassificados(): Promise<number> {
  const regras = await regrasDeDesclassificados();
  if (!regras.ligado) return 0;
  const quando = await agora();
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, etapa: { notIn: ["perdido", "fechado"] }, modoAtendimento: "bot", aguardandoHumano: false, classificacao: { in: Object.keys(MOTIVOS_DESCLASSIFICADO) }, ultimaMsgClienteEm: { not: null } },
    include: { visitas: { where: { status: "agendada", inicio: { gt: quando } }, select: { id: true } } },
  });
  let movidos = 0;
  for (const lead of leads) {
    const motivo = avaliarDesclassificado({ ...lead, temVisitaFutura: lead.visitas.length > 0 }, regras, quando);
    if (!motivo) continue;
    await garantirMotivoAutomatico(motivo, Object.values(MOTIVOS_DESCLASSIFICADO).find((m) => m.codigo === motivo)!.nome);
    await moverEtapa(lead.id, "perdido", "sistema", { guardarAnterior: true, semExigencias: true, dados: { motivoPerda: motivo } });
    await registrarUmaVez(lead.id, "desclassificado_perdido", lead.consultorId);
    movidos++;
  }
  if (movidos) await marcarMudanca();
  return movidos;
}
