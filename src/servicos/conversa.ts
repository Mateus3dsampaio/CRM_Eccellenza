import { responderCliente } from "@/bot/atendimento";
import { db } from "@/lib/db";
import { apagarMidia, salvarMidia } from "@/lib/midias";
import { tipoCanonico } from "@/regras/midia";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { janelaAberta } from "@/regras/janela24h";
import { normalizarTelefone } from "@/regras/telefone";
import { registrarAlteracao } from "./historico";
import { obterOuCriarLead } from "./leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "./mensagens";
import { liberarPedidoParar, registrarPedidoParar } from "./lgpd";
import { pediuParaParar } from "@/regras/optout";
import { PREFIXO_AUDIO } from "@/regras/whatsapp";

export class ErroConversa extends Error {}

/** Chegada de mensagem do cliente (simulada): grava, aplica regras e chama o bot. */
export async function receberMensagemCliente(params: {
  telefone: string;
  nomePerfil?: string | null;
  texto?: string | null;
  /** Imagem, vídeo ou PDF que o cliente mandou. */
  midia?: { dados: Buffer; tipo: string; nome?: string | null } | null;
  /** Id da mensagem na Meta (WhatsApp real). Evita processar a mesma mensagem duas vezes. */
  idExterno?: string | null;
  /** Número como a Meta o conhece (wa_id). Guardado para as respostas irem para o formato certo. */
  waId?: string | null;
}) {
  const telefone = normalizarTelefone(params.telefone);
  if (!telefone) throw new ErroConversa("Telefone inválido.");
  const texto = params.texto?.trim().slice(0, 4000) || null;
  if (!texto && !params.midia) throw new ErroConversa("Mensagem vazia.");

  let midia: { arquivo: string; tipo: string; nome?: string | null; bytes: number } | undefined;
  if (params.midia) {
    try {
      const tipo = tipoCanonico(params.midia.tipo);
      midia = { arquivo: await salvarMidia(params.midia.dados, tipo, params.midia.nome), tipo, nome: params.midia.nome ?? null, bytes: params.midia.dados.length };
    } catch (erro) {
      throw new ErroConversa(erro instanceof Error ? erro.message : "Arquivo inválido.");
    }
  }
  let lead: Awaited<ReturnType<typeof obterOuCriarLead>>;
  try {
    lead = await obterOuCriarLead(telefone, params.nomePerfil?.trim() || null, params.waId ?? null);
    await registrarMensagemCliente(lead.id, texto, midia, params.idExterno ?? undefined);
  } catch (erro) {
    // Não deixa o arquivo solto no disco sem mensagem (nem a exclusão do cliente nem a limpeza de 180 dias chegariam nele).
    if (midia) await apagarMidia(midia.arquivo).catch(() => undefined);
    throw erro;
  }
  // LGPD: pedido claro para parar. Registra, confirma e não chama o bot.
  // (Áudio transcrito também vale: "parar" falado em voz alta é um pedido.)
  if (!midia && pediuParaParar(texto?.startsWith(PREFIXO_AUDIO) ? texto.slice(PREFIXO_AUDIO.length) : texto)) {
    await registrarPedidoParar(lead.id);
    return { leadId: lead.id, respostas: [] as string[] };
  }
  const resultado = await responderCliente(lead.id);
  return { leadId: lead.id, ...resultado };
}

/** Consultor manda imagem, vídeo ou PDF (com legenda opcional). Só dentro da janela de 24h. Responder já assume a conversa. */
export async function responderComoConsultorComArquivo(leadId: string, usuario: { nome: string }, anexo: { dados: Buffer; tipo: string; nome: string }, legenda?: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!janelaAberta(lead.ultimaMsgClienteEm, await agora())) {
    throw new Error("Fora da janela de 24h: só é possível enviar um modelo aprovado. Arquivos só dentro da janela.");
  }
  if (lead.modoAtendimento !== "humano") await assumirConversa(leadId, usuario);
  return enviarMensagemLoja({ leadId, autor: "consultor", autorNome: usuario.nome, texto: legenda, anexo });
}

export async function assumirConversa(leadId: string, usuario: { nome: string }) {
  await db.lead.update({ where: { id: leadId }, data: { modoAtendimento: "humano" } });
  await registrarAlteracao(leadId, usuario.nome, "Assumiu a conversa (bot pausado)");
  await marcarMudanca();
}

export async function devolverAoBot(leadId: string, usuario: { nome: string }) {
  await db.lead.update({ where: { id: leadId }, data: { modoAtendimento: "bot", aguardandoHumano: false, esperandoDesde: null, naoLidas: 0, erroBot: null } });
  await liberarPedidoParar(leadId);
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
