import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { janelaAberta } from "@/regras/janela24h";
import { registrarAlerta } from "./alertas";
import { regrasDeRetorno } from "./configuracoes";
import { escolherProximoConsultor } from "./distribuicao";
import { registrarAlteracao } from "./historico";
import { enviarMensagemLoja } from "./mensagens";

/**
 * Retorno automático do lead que chegou com a loja fechada (tarefa 36). No horário do retorno marcado pelo bot, se a janela de
 * 24h já fechou, o modelo de retorno sai sozinho, mas só se o lead tiver dono online:
 * - dono online: envia;
 * - sem dono online: passa para quem estiver online e envia;
 * - ninguém online: espera e todos recebem aviso (uma vez).
 * Cliente que pediu para parar nunca recebe. Roda a cada minuto (`rodarRotinas`).
 */
export async function enviarRetornosAutomaticos(): Promise<number> {
  const quando = await agora();
  const regras = await regrasDeRetorno();
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, retornoModeloEm: { not: null }, proximoContatoEm: { not: null, lte: quando } },
    include: { consultor: { select: { id: true, status: true, ativo: true } } },
  });
  let enviados = 0;
  for (const lead of leads) {
    const limpar = () => db.lead.updateMany({ where: { id: lead.id, retornoModeloEm: lead.retornoModeloEm }, data: { retornoModeloEm: null } });
    // Uma pessoa mudou a data do retorno: o envio automático não vale mais.
    if (lead.retornoModeloEm?.getTime() !== lead.proximoContatoEm?.getTime()) {
      await limpar();
      continue;
    }
    // Pediu para parar, ou a janela de 24h está aberta (o vendedor responde normalmente): não precisa de modelo.
    if (lead.naoReceberEm || janelaAberta(lead.ultimaMsgClienteEm, quando) || !regras.automatico) {
      await limpar();
      continue;
    }
    let donoId = lead.consultor?.ativo && lead.consultor.status === "online" ? lead.consultor.id : null;
    if (!donoId) {
      donoId = await escolherProximoConsultor();
      if (!donoId) {
        // Ninguém online: espera (a rotina tenta de novo a cada minuto) e avisa todos uma vez.
        if (!(await db.alerta.count({ where: { tipo: "retorno_sem_online", leadId: lead.id } }))) {
          await registrarAlerta({ tipo: "retorno_sem_online", leadId: lead.id, paraTodos: true });
          await marcarMudanca();
        }
        continue;
      }
      await db.lead.update({ where: { id: lead.id }, data: { consultorId: donoId } });
      await registrarAlteracao(lead.id, "sistema", "Lead passado para quem está online (retorno de atendimento)");
    }
    // Reserva o envio: só quem conseguir limpar a marca envia (duas rodadas ao mesmo tempo não duplicam).
    if (!(await limpar()).count) continue;
    try {
      await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", autorNome: "Retorno automático", modelo: regras.modelo });
      await registrarAlteracao(lead.id, "sistema", `Modelo de retorno enviado (${regras.modelo})`);
      enviados++;
    } catch (erro) {
      await registrarAlteracao(lead.id, "sistema", `Modelo de retorno não enviado: ${erro instanceof Error ? erro.message : "erro desconhecido"}`);
    }
  }
  if (enviados) await marcarMudanca();
  return enviados;
}
