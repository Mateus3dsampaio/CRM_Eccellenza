import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { deveExcluirArquivado, DIAS_ARQUIVADO_ATE_EXCLUIR } from "@/regras/limpeza";
import { avaliarRetomada, DIAS_PARA_RETOMADA, DIAS_PARA_SEM_RESPOSTA } from "@/regras/retomada";
import { formatarDataHora } from "@/regras/tempo";
import { avisarPrazosVermelhos, avisarRetornos } from "./alertas";
import { registrarAlteracao } from "./historico";
import { alterarEtiqueta, excluirLeads, moverEtapa } from "./leads";
import { enviarMensagemLoja } from "./mensagens";
import { registrarUmaVez } from "./metricas";
import { limparLogsAntigos } from "./whatsapp";

export interface ResultadoRotinas {
  retomadas: number;
  semResposta: number;
  excluidos: number;
}

async function registrar(texto: string) {
  await db.registroRotina.create({ data: { texto, criadoEm: await agora() } });
}

// Evita duas execuções ao mesmo tempo (ex.: duas abas avançando o relógio).
let emExecucao: Promise<ResultadoRotinas> | null = null;

/** Rotinas de tempo (RET-01, RET-03, LIMP-04). Rodam ao avançar o relógio e ao abrir o kanban. */
export function rodarRotinas(): Promise<ResultadoRotinas> {
  if (!emExecucao) emExecucao = executar().finally(() => (emExecucao = null));
  return emExecucao;
}

async function executar(): Promise<ResultadoRotinas> {
  const quando = await agora();
  const resultado: ResultadoRotinas = { retomadas: 0, semResposta: 0, excluidos: 0 };

  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, etapa: "novo", modoAtendimento: "bot", ultimaMsgLojaEm: { not: null }, naoReceberEm: null },
    include: { visitas: { where: { status: "agendada", inicio: { gt: quando } }, select: { id: true } } },
  });
  for (const lead of leads) {
    const acao = avaliarRetomada({ ...lead, temVisitaFutura: lead.visitas.length > 0 }, quando);
    if (acao === "enviar_retomada") {
      // Marca antes de enviar: garante uma retomada só, mesmo se o envio falhar.
      const r = await db.lead.updateMany({ where: { id: lead.id, retomadaEnviadaEm: null }, data: { retomadaEnviadaEm: quando } });
      if (!r.count) continue;
      await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", autorNome: "Retomada automática", modelo: "retomada" });
      await alterarEtiqueta(lead.id, "retomada", true, "sistema");
      await registrarAlteracao(lead.id, "sistema", `Retomada enviada (${DIAS_PARA_RETOMADA} dias sem resposta)`);
      await registrarUmaVez(lead.id, "retomada_enviada");
      resultado.retomadas++;
    } else if (acao === "mover_sem_resposta") {
      await moverEtapa(lead.id, "sem_resposta", "sistema", { guardarAnterior: true });
      resultado.semResposta++;
    }
  }

  const arquivados = await db.lead.findMany({ where: { arquivadoEm: { not: null } }, select: { id: true, arquivadoEm: true } });
  const vencidos = arquivados.filter((l) => deveExcluirArquivado(l.arquivadoEm, quando)).map((l) => l.id);
  if (vencidos.length) resultado.excluidos = await excluirLeads(vencidos);

  await limparLogsAntigos();

  // O relógio simulado pode ter andado: confere os prazos de espera.
  await avisarPrazosVermelhos();
  await avisarRetornos();

  const partes: string[] = [];
  if (resultado.retomadas) partes.push(`${resultado.retomadas} retomada(s) enviada(s) após ${DIAS_PARA_RETOMADA} dias sem resposta`);
  if (resultado.semResposta) partes.push(`${resultado.semResposta} lead(s) movido(s) para "Sem resposta" (${DIAS_PARA_SEM_RESPOSTA} dias após a retomada)`);
  if (resultado.excluidos) partes.push(`${resultado.excluidos} arquivado(s) excluído(s) de vez (${DIAS_ARQUIVADO_ATE_EXCLUIR} dias no arquivo)`);
  if (partes.length) {
    await registrar(`${formatarDataHora(quando)}: ${partes.join("; ")}.`);
    await marcarMudanca();
  }
  return resultado;
}

export async function registrarAvanco(texto: string) {
  await registrar(texto);
}
