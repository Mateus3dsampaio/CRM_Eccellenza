import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { avaliarRecuperacao, montarTextoRecuperacao, MOTIVO_SEM_RESPOSTA_AUTOMATICO } from "@/regras/recuperacao";
import { regrasDeRecuperacao } from "./configuracoes";
import { idsQuePassaramPorHumano } from "./passou-por-humano";
import { registrarAlteracao } from "./historico";
import { moverEtapa } from "./leads";
import { enviarMensagemLoja } from "./mensagens";
import { registrarUmaVez } from "./metricas";
import { garantirMotivoSemRespostaAutomatico } from "./vendas";

export interface ResultadoRecuperacao {
  primeiras: number;
  segundas: number;
  perdidos: number;
}

/**
 * Recuperação de leads: cliente que abriu a conversa e sumiu recebe até 2 mensagens de texto fixo (dentro da janela
 * de 24h) e depois vai para Perdido com o motivo "Sem resposta (automático)". Roda a cada minuto (`rodarRotinas`).
 * As regras (quando, para quem, janela, horário) ficam em `regras/recuperacao.ts`; aqui só se grava e se envia.
 * No simulador nada vai de verdade; em produção sem chaves da Meta o envio "falha" e o ciclo para (`enviarMensagemLoja`).
 */
export async function rodarRecuperacao(): Promise<ResultadoRecuperacao> {
  const resultado: ResultadoRecuperacao = { primeiras: 0, segundas: 0, perdidos: 0 };
  const regras = await regrasDeRecuperacao();
  if (!regras.ligado) return resultado;
  const quando = await agora();

  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, naoReceberEm: null, etapa: { notIn: ["perdido", "fechado"] }, modoAtendimento: "bot", aguardandoHumano: false, recuperacaoFalhou: false, ultimaMsgClienteEm: { not: null } },
    include: { visitas: { where: { status: "agendada", inicio: { gt: quando } }, select: { id: true } } },
  });

  const humanos = await idsQuePassaramPorHumano(leads.map((l) => l.id));
  for (const lead of leads) {
    const acao = avaliarRecuperacao({ ...lead, temVisitaFutura: lead.visitas.length > 0, passouPorHumano: humanos.has(lead.id) }, regras, quando);
    if (!acao) continue;

    if (acao === "mover_perdido") {
      // Só chega aqui se a última mensagem do ciclo (2ª, ou 1ª com a 2ª desligada) foi enviada (recuperacaoFalhou = false).
      await garantirMotivoSemRespostaAutomatico();
      await moverEtapa(lead.id, "perdido", "sistema", { guardarAnterior: true, semExigencias: true, dados: { motivoPerda: MOTIVO_SEM_RESPOSTA_AUTOMATICO } });
      await registrarUmaVez(lead.id, "recuperacao_perdido", lead.consultorId);
      resultado.perdidos++;
      continue;
    }

    const primeira = acao === "enviar_primeira";
    // Reserva o envio: só uma rodada ganha (duas ao mesmo tempo não duplicam) e o lead nunca recomeça o ciclo.
    const reserva = await db.lead.updateMany({
      where: primeira ? { id: lead.id, recuperacaoPrimeiraEm: null } : { id: lead.id, recuperacaoPrimeiraEm: { not: null }, recuperacaoSegundaEm: null },
      data: primeira ? { recuperacaoPrimeiraEm: quando } : { recuperacaoSegundaEm: quando },
    });
    if (!reserva.count) continue;

    const texto = montarTextoRecuperacao(primeira ? regras.primeiraTexto : regras.segundaTexto, lead.nome);
    let enviada = false;
    let motivoFalha = "";
    try {
      const mensagem = await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", autorNome: "Recuperação automática", texto });
      enviada = mensagem.status !== "falhou";
      if (!enviada) motivoFalha = "o WhatsApp não aceitou o envio";
    } catch (erro) {
      motivoFalha = erro instanceof Error ? erro.message : "erro desconhecido";
    }
    const numero = primeira ? "1ª" : "2ª";
    if (enviada) {
      await registrarAlteracao(lead.id, "sistema", `Mensagem de recuperação enviada (${numero})`);
      await registrarUmaVez(lead.id, primeira ? "recuperacao_primeira" : "recuperacao_segunda", lead.consultorId);
      if (primeira) resultado.primeiras++;
      else resultado.segundas++;
    } else {
      // Sem envio não há 2ª mensagem nem Perdido: o lead fica onde está.
      await db.lead.update({ where: { id: lead.id }, data: { recuperacaoFalhou: true } });
      await registrarAlteracao(lead.id, "sistema", `Mensagem de recuperação (${numero}) não enviada: ${motivoFalha}`);
    }
  }
  if (resultado.primeiras || resultado.segundas || resultado.perdidos) await marcarMudanca();
  return resultado;
}
