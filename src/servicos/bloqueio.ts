import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { registrarAlteracao } from "./historico";
import { acharLeadPorTelefone, arquivarLeads } from "./leads";
import { registrarUmaVez } from "./metricas";

/** O que fica na conversa quando um contato bloqueado manda áudio ou arquivo (não é transcrito nem baixado). */
export const AUDIO_DE_BLOQUEADO = "[áudio de contato bloqueado: não foi transcrito]";
export const ARQUIVO_DE_BLOQUEADO = "[arquivo de contato bloqueado: não foi baixado]";

/**
 * Bloqueia um contato que não é cliente (tarefa 44, decisão do Mateus 16/11/2026): vai direto para o arquivo, sem passar
 * por Perdido, e sai da espera. A partir daí mensagem nova só fica guardada (`registrarMensagemCliente`), sem IA, sem
 * transcrição e sem aviso. Dura até o arquivo excluir o lead (30 dias) ou alguém restaurar (`restaurarLead` desbloqueia).
 * `autor`: "bot" ou o nome de quem bloqueou. Devolve false se já estava bloqueado.
 */
export async function bloquearContato(leadId: string, autor: string, motivo?: string): Promise<boolean> {
  const quando = await agora();
  const r = await db.lead.updateMany({
    where: { id: leadId, bloqueadoEm: null },
    data: { bloqueadoEm: quando, bloqueadoPor: autor, aguardandoHumano: false, esperandoDesde: null, respondeuSemEsperaEm: null, naoLidas: 0, erroBot: null },
  });
  if (!r.count) return false;
  // O que o bot ainda não leu não é respondido se o contato for desbloqueado depois.
  await db.mensagem.updateMany({ where: { leadId, processadaPeloBot: false }, data: { processadaPeloBot: true } });
  await registrarAlteracao(leadId, autor, `Bloqueou o contato${motivo ? ` (${motivo})` : ""}: a IA não responde mais e as mensagens novas não geram aviso`);
  // Já arquivado (bloqueio feito a partir do arquivo): mantém a data, para a exclusão de 30 dias não recomeçar.
  await arquivarLeads([leadId], autor);
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { consultorId: true } });
  await registrarUmaVez(leadId, "contato_bloqueado", lead?.consultorId);
  await marcarMudanca();
  return true;
}

/** O telefone é de um contato bloqueado? Usado antes de transcrever áudio ou baixar arquivo (`servicos/whatsapp.ts`). */
export async function contatoBloqueado(telefone: string): Promise<boolean> {
  return !!(await acharLeadPorTelefone(telefone))?.bloqueadoEm;
}
