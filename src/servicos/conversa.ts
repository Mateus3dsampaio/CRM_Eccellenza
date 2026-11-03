import { responderCliente } from "@/bot/atendimento";
import { db } from "@/lib/db";
import { salvarMidia } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { janelaAberta } from "@/regras/janela24h";
import { normalizarTelefone } from "@/regras/telefone";
import { registrarAlteracao } from "./historico";
import { obterOuCriarLead } from "./leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "./mensagens";

export class ErroConversa extends Error {}

/** Chegada de mensagem do cliente (simulada): grava, aplica regras e chama o bot. */
export async function receberMensagemCliente(params: {
  telefone: string;
  nomePerfil?: string | null;
  texto?: string | null;
  imagem?: { dados: Buffer; tipo: string } | null;
}) {
  const telefone = normalizarTelefone(params.telefone);
  if (!telefone) throw new ErroConversa("Telefone inválido.");
  const texto = params.texto?.trim().slice(0, 4000) || null;
  if (!texto && !params.imagem) throw new ErroConversa("Mensagem vazia.");

  let midia: { arquivo: string; tipo: string } | undefined;
  if (params.imagem) {
    try {
      midia = { arquivo: await salvarMidia(params.imagem.dados, params.imagem.tipo), tipo: params.imagem.tipo };
    } catch (erro) {
      throw new ErroConversa(erro instanceof Error ? erro.message : "Imagem inválida.");
    }
  }
  const lead = await obterOuCriarLead(telefone, params.nomePerfil?.trim() || null);
  await registrarMensagemCliente(lead.id, texto, midia);
  const resultado = await responderCliente(lead.id);
  return { leadId: lead.id, ...resultado };
}

export async function assumirConversa(leadId: string, usuario: { nome: string }) {
  await db.lead.update({ where: { id: leadId }, data: { modoAtendimento: "humano" } });
  await registrarAlteracao(leadId, usuario.nome, "Assumiu a conversa (bot pausado)");
  await marcarMudanca();
}

export async function devolverAoBot(leadId: string, usuario: { nome: string }) {
  await db.lead.update({ where: { id: leadId }, data: { modoAtendimento: "bot", aguardandoHumano: false, esperandoDesde: null, naoLidas: 0, erroBot: null } });
  await registrarAlteracao(leadId, usuario.nome, "Devolveu a conversa ao bot");
  await marcarMudanca();
}

/** Alguém abriu a conversa: zera a bolinha de não lidas. A espera continua até o consultor responder. */
export async function marcarConversaVista(leadId: string) {
  const r = await db.lead.updateMany({ where: { id: leadId, naoLidas: { gt: 0 } }, data: { naoLidas: 0 } });
  if (r.count) await marcarMudanca();
}

/** Consultor responde pela tela da conversa (CHAT-03). Responder já assume a conversa. */
export async function responderComoConsultor(leadId: string, usuario: { nome: string }, texto?: string, modelo?: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  // Confere a regra das 24h antes de assumir a conversa: envio recusado não pausa o bot.
  if (!modelo && !janelaAberta(lead.ultimaMsgClienteEm, await agora())) {
    throw new Error("Fora da janela de 24h: só é possível enviar um modelo aprovado.");
  }
  if (lead.modoAtendimento !== "humano") await assumirConversa(leadId, usuario);
  return enviarMensagemLoja({ leadId, autor: "consultor", autorNome: usuario.nome, texto, modelo });
}
