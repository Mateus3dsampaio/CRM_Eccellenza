import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { temConsentimento } from "@/regras/consentimento";
import { deveExcluirArquivado, deveExcluirFechado, DIAS_ARQUIVADO_ATE_EXCLUIR, DIAS_FECHADO_ATE_EXCLUIR } from "@/regras/limpeza";
import { avaliarRetomada, DIAS_PARA_RETOMADA, DIAS_PARA_SEM_RESPOSTA } from "@/regras/retomada";
import { MOTIVO_PAROU_DE_RESPONDER } from "@/regras/vendas";
import { formatarDataHora } from "@/regras/tempo";
import { avisarPrazosVermelhos, avisarRetornos } from "./alertas";
import { registrarAlteracao } from "./historico";
import { alterarEtiqueta, excluirLeads, moverEtapa } from "./leads";
import { enviarMensagemLoja } from "./mensagens";
import { registrarUmaVez } from "./metricas";
import { apagarMidiasAntigas, apagarMidiasSoltas } from "./midias";
import { garantirMotivoParouDeResponder } from "./vendas";
import { limparLogsAntigos, reprocessarEventosPendentes } from "./whatsapp";

export interface ResultadoRotinas {
  retomadas: number;
  semResposta: number;
  excluidos: number;
  /** Parte de `excluidos` que foi por passar 180 dias do fechamento. */
  fechadosExcluidos?: number;
}

/** Leads em "Fechado" há 180 dias ou mais. A data é a última vez que entraram em Fechado; sem esse registro (dado antigo), vale a última alteração. */
async function leadsFechadosVencidos(quando: Date): Promise<string[]> {
  const fechados = await db.lead.findMany({ where: { etapa: "fechado" }, select: { id: true, atualizadoEm: true } });
  if (!fechados.length) return [];
  const mudancas = await db.mudancaEtapa.groupBy({ by: ["leadId"], where: { leadId: { in: fechados.map((l) => l.id) }, para: "fechado" }, _max: { criadoEm: true } });
  const fechadoEm = new Map(mudancas.map((m) => [m.leadId, m._max.criadoEm]));
  return fechados.filter((l) => deveExcluirFechado(fechadoEm.get(l.id) ?? l.atualizadoEm, quando)).map((l) => l.id);
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
      // Retomada é mensagem iniciada pela loja: só com consentimento (regras/consentimento.ts).
      if (!temConsentimento(lead)) continue;
      // Marca antes de enviar: garante uma retomada só, mesmo se o envio falhar.
      const r = await db.lead.updateMany({ where: { id: lead.id, retomadaEnviadaEm: null }, data: { retomadaEnviadaEm: quando } });
      if (!r.count) continue;
      await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", autorNome: "Retomada automática", modelo: "retomada" });
      await alterarEtiqueta(lead.id, "retomada", true, "sistema");
      await registrarAlteracao(lead.id, "sistema", `Retomada enviada (${DIAS_PARA_RETOMADA} dias sem resposta)`);
      await registrarUmaVez(lead.id, "retomada_enviada");
      resultado.retomadas++;
    } else if (acao === "mover_sem_resposta") {
      // Tarefa 21: não existe mais a coluna "Sem resposta"; o lead vai para Perdido com o motivo "Parou de responder"
      // e volta para onde estava se o cliente escrever de novo (servicos/mensagens.ts).
      await garantirMotivoParouDeResponder();
      await moverEtapa(lead.id, "perdido", "sistema", { guardarAnterior: true, semExigencias: true, dados: { motivoPerda: MOTIVO_PAROU_DE_RESPONDER } });
      resultado.semResposta++;
    }
  }

  // Cliente que fechou projeto segue a regra dos 180 dias (abaixo), mesmo arquivado; os demais arquivados saem em 30 dias.
  const arquivados = await db.lead.findMany({ where: { arquivadoEm: { not: null }, etapa: { not: "fechado" } }, select: { id: true, arquivadoEm: true } });
  const vencidos = arquivados.filter((l) => deveExcluirArquivado(l.arquivadoEm, quando)).map((l) => l.id);
  if (vencidos.length) resultado.excluidos = await excluirLeads(vencidos);

  const fechadosVencidos = await leadsFechadosVencidos(quando);
  if (fechadosVencidos.length) {
    const telefones = await db.lead.findMany({ where: { id: { in: fechadosVencidos } }, select: { telefone: true } });
    const apagados = await excluirLeads(fechadosVencidos);
    if (apagados) {
      // Mesmo registro da exclusão pedida por pessoa: só a ação, quem e os 4 últimos dígitos.
      await db.pedidoLgpd.createMany({ data: telefones.map((l) => ({ acao: "exclusao", quem: `sistema (${DIAS_FECHADO_ATE_EXCLUIR} dias após fechar)`, telefoneFim: l.telefone.replace(/\D/g, "").slice(-4) })) });
      resultado.excluidos += apagados;
      resultado.fechadosExcluidos = apagados;
    }
  }

  // A limpeza de arquivos nunca pode derrubar o resto das rotinas.
  try {
    const midiasApagadas = await apagarMidiasAntigas();
    if (midiasApagadas) await registrar(`${formatarDataHora(quando)}: ${midiasApagadas} arquivo(s) apagado(s) por terem mais de 180 dias.`);
    await apagarMidiasSoltas();
  } catch {
    console.error("[rotinas] a limpeza de arquivos falhou");
  }
  await limparLogsAntigos();
  await reprocessarEventosPendentes();

  // O relógio simulado pode ter andado: confere os prazos de espera.
  await avisarPrazosVermelhos();
  await avisarRetornos();

  const partes: string[] = [];
  if (resultado.retomadas) partes.push(`${resultado.retomadas} retomada(s) enviada(s) após ${DIAS_PARA_RETOMADA} dias sem resposta`);
  if (resultado.semResposta) partes.push(`${resultado.semResposta} lead(s) movido(s) para "Perdido – Parou de responder" (${DIAS_PARA_SEM_RESPOSTA} dias após a retomada)`);
  if (resultado.excluidos) partes.push(`${resultado.excluidos} arquivado(s) excluído(s) de vez (${DIAS_ARQUIVADO_ATE_EXCLUIR} dias no arquivo)`);
  if (resultado.fechadosExcluidos) partes.push(`${resultado.fechadosExcluidos} cliente(s) que fecharam projeto excluído(s) de vez (${DIAS_FECHADO_ATE_EXCLUIR} dias após fechar)`);
  if (partes.length) {
    await registrar(`${formatarDataHora(quando)}: ${partes.join("; ")}.`);
    await marcarMudanca();
  }
  return resultado;
}

export async function registrarAvanco(texto: string) {
  await registrar(texto);
}
