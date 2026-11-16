import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { MOTIVOS_DESCLASSIFICADO } from "@/regras/desclassificados";
import { MOTIVO_SEM_RESPOSTA_AUTOMATICO, NOME_MOTIVO_SEM_RESPOSTA_AUTOMATICO } from "@/regras/recuperacao";
import { avaliarRede } from "@/regras/rede-seguranca";
import { regrasDaRedeDeSeguranca } from "./configuracoes";
import { registrarAlteracao } from "./historico";
import { arquivarLeads, moverEtapa } from "./leads";
import { registrarUmaVez } from "./metricas";
import { garantirMotivoAutomatico } from "./vendas";

export interface ResultadoRede {
  perdidos: number;
  arquivados: number;
}

/**
 * Rede de segurança (tarefa 41): lead com o bot há X dias sem mensagem do cliente vai para Perdido; pós-venda vai
 * direto para o arquivo. Roda a cada minuto (`rodarRotinas`). A regra fica em `regras/rede-seguranca.ts`.
 * O motivo é "Sem resposta (automático)"; outra cidade e curioso / sem perfil levam o motivo próprio deles.
 */
export async function rodarRedeDeSeguranca(): Promise<ResultadoRede> {
  const resultado: ResultadoRede = { perdidos: 0, arquivados: 0 };
  const regras = await regrasDaRedeDeSeguranca();
  if (!regras.ligado) return resultado;
  const quando = await agora();
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, etapa: { notIn: ["perdido", "fechado"] }, modoAtendimento: "bot", aguardandoHumano: false, ultimaMsgClienteEm: { not: null } },
    include: { visitas: { where: { status: "agendada", inicio: { gt: quando } }, select: { id: true } } },
  });
  for (const lead of leads) {
    const acao = avaliarRede({ ...lead, temVisitaFutura: lead.visitas.length > 0 }, regras, quando);
    if (!acao) continue;
    if (acao === "arquivar") {
      await registrarAlteracao(lead.id, "sistema", `Pós-venda parado há ${regras.dias} dias: arquivado automaticamente`);
      await arquivarLeads([lead.id], "sistema");
      await registrarUmaVez(lead.id, "rede_arquivado", lead.consultorId);
      resultado.arquivados++;
      continue;
    }
    const motivo = (lead.classificacao ? MOTIVOS_DESCLASSIFICADO[lead.classificacao] : undefined) ?? { codigo: MOTIVO_SEM_RESPOSTA_AUTOMATICO, nome: NOME_MOTIVO_SEM_RESPOSTA_AUTOMATICO };
    await garantirMotivoAutomatico(motivo.codigo, motivo.nome);
    await registrarAlteracao(lead.id, "sistema", `Cliente sem escrever há ${regras.dias} dias: movido automaticamente para Perdido`);
    await moverEtapa(lead.id, "perdido", "sistema", { guardarAnterior: true, semExigencias: true, dados: { motivoPerda: motivo.codigo } });
    await registrarUmaVez(lead.id, "rede_perdido", lead.consultorId);
    resultado.perdidos++;
  }
  if (resultado.perdidos || resultado.arquivados) await marcarMudanca();
  return resultado;
}
