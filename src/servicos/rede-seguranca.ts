import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { MOTIVO_SEM_RESPOSTA_AUTOMATICO, NOME_MOTIVO_SEM_RESPOSTA_AUTOMATICO } from "@/regras/recuperacao";
import { avaliarRede, type AcaoRede, type RegrasRedeDeSeguranca } from "@/regras/rede-seguranca";
import { regrasDaRedeDeSeguranca } from "./configuracoes";
import { registrarAlteracao } from "./historico";
import { arquivarLeads, moverEtapa } from "./leads";
import { idsQuePassaramPorHumano } from "./passou-por-humano";
import { registrarUmaVez } from "./metricas";
import { garantirMotivoAutomatico } from "./vendas";

export interface ResultadoRede {
  perdidos: number;
  arquivados: number;
}

/** Leads que a rede tiraria do quadro agora, com a ação de cada um. `regras` permite simular (prévia da tela). */
export async function redeVencidos(regras: RegrasRedeDeSeguranca, quando: Date): Promise<{ id: string; consultorId: string | null; classificacao: string | null; acao: Exclude<AcaoRede, null> }[]> {
  if (!regras.ligado) return [];
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, etapa: { notIn: ["perdido", "fechado"] }, modoAtendimento: "bot", aguardandoHumano: false, ultimaMsgClienteEm: { not: null } },
    include: { visitas: { where: { status: "agendada", inicio: { gt: quando } }, select: { id: true } } },
  });
  const vencidos: { id: string; consultorId: string | null; classificacao: string | null; acao: Exclude<AcaoRede, null> }[] = [];
  const humanos = await idsQuePassaramPorHumano(leads.map((l) => l.id));
  for (const lead of leads) {
    const acao = avaliarRede({ ...lead, temVisitaFutura: lead.visitas.length > 0, passouPorHumano: humanos.has(lead.id) }, regras, quando);
    if (acao) vencidos.push({ id: lead.id, consultorId: lead.consultorId, classificacao: lead.classificacao, acao });
  }
  return vencidos;
}

/**
 * Rede de segurança (tarefa 41): lead com o bot há X dias sem mensagem do cliente vai para Perdido; pós-venda vai
 * direto para o arquivo. Roda a cada minuto (`rodarRotinas`). A regra fica em `regras/rede-seguranca.ts`.
 * O motivo é "Sem resposta (automático)". Lead que já passou por um consultor fica de fora.
 */
export async function rodarRedeDeSeguranca(): Promise<ResultadoRede> {
  const resultado: ResultadoRede = { perdidos: 0, arquivados: 0 };
  const regras = await regrasDaRedeDeSeguranca();
  for (const lead of await redeVencidos(regras, await agora())) {
    if (lead.acao === "arquivar") {
      await registrarAlteracao(lead.id, "sistema", `Pós-venda parado há ${regras.dias} dias: arquivado automaticamente`);
      await arquivarLeads([lead.id], "sistema");
      await registrarUmaVez(lead.id, "rede_arquivado", lead.consultorId);
      resultado.arquivados++;
      continue;
    }
    const motivo = { codigo: MOTIVO_SEM_RESPOSTA_AUTOMATICO, nome: NOME_MOTIVO_SEM_RESPOSTA_AUTOMATICO };
    await garantirMotivoAutomatico(motivo.codigo, motivo.nome);
    await registrarAlteracao(lead.id, "sistema", `Cliente sem escrever há ${regras.dias} dias: movido automaticamente para Perdido`);
    await moverEtapa(lead.id, "perdido", "sistema", { guardarAnterior: true, semExigencias: true, dados: { motivoPerda: motivo.codigo } });
    await registrarUmaVez(lead.id, "rede_perdido", lead.consultorId);
    resultado.perdidos++;
  }
  if (resultado.perdidos || resultado.arquivados) await marcarMudanca();
  return resultado;
}
