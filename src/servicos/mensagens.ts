import { db } from "@/lib/db";
import { lerLista } from "@/lib/json";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { janelaAberta } from "@/regras/janela24h";
import { buscarModelo } from "@/regras/modelos";
import { AVISO_ALMOCO } from "@/regras/almoco";
import { temConsentimento } from "@/regras/consentimento";
import { simularSemWhatsapp } from "@/regras/telefone";
import { modoSimulador } from "@/lib/modo";
import { whatsappRealAtivo } from "@/lib/whatsapp-config";
import { enviarPelaMeta } from "./whatsapp";
import { registrarAlerta } from "./alertas";
import { registrarAlteracao } from "./historico";
import { alterarEtiqueta, moverEtapa, etapaOuErro } from "./leads";
import { registrarUmaVez } from "./metricas";

export type AutorLoja = "bot" | "consultor" | "sistema";
export type StatusMensagem = "enviado" | "entregue" | "lido" | "falhou";

// Status simulados (MSG-03): entregue alguns segundos depois do envio; lido quando o cliente abre ou responde.
const ATRASO_ENTREGA_MS = 3000;

export function statusEfetivo(
  m: { autor: string; status: string; enviadaEm: Date; lidaEm: Date | null },
  quando: Date,
): StatusMensagem | null {
  if (m.autor === "cliente") return null;
  if (m.status === "falhou") return "falhou";
  if (m.lidaEm) return "lido";
  // WhatsApp real: o status é o que a Meta contou (webhook); só o simulado "entrega" sozinho depois de uns segundos.
  if (whatsappRealAtivo()) return m.status === "entregue" ? "entregue" : "enviado";
  if (quando.getTime() - m.enviadaEm.getTime() >= ATRASO_ENTREGA_MS) return "entregue";
  return "enviado";
}

function previa(texto: string | null, temMidia: boolean): string {
  if (texto && texto.trim()) return texto.trim().slice(0, 140);
  return temMidia ? "📷 Imagem" : "";
}

/** Marca como lidas as mensagens da loja (cliente abriu a conversa ou respondeu). */
export async function marcarLidas(leadId: string): Promise<void> {
  const quando = await agora();
  const r = await db.mensagem.updateMany({
    where: { leadId, autor: { not: "cliente" }, lidaEm: null, status: { not: "falhou" } },
    data: { lidaEm: quando, status: "lido" },
  });
  if (r.count) await marcarMudanca();
}

/** Mensagem que chega do cliente (simulada). Aplica RET-02 e reabre arquivados. */
export async function registrarMensagemCliente(leadId: string, texto: string | null, midia?: { arquivo: string; tipo: string }, idExterno?: string) {
  const quando = await agora();
  await marcarLidas(leadId);
  const mensagem = await db.mensagem.create({
    data: { leadId, autor: "cliente", texto, midiaArquivo: midia?.arquivo, midiaTipo: midia?.tipo, enviadaEm: quando, status: "lido", idExterno },
  });
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  // Com consultor no comando (ou bot pausado), o cliente fica aguardando humano.
  const aguardando = lead.modoAtendimento !== "bot" ? true : lead.aguardandoHumano;
  await db.lead.update({
    where: { id: leadId },
    data: {
      ultimaMensagemEm: quando,
      ultimaMensagemPrevia: previa(texto, !!midia),
      ultimaMsgClienteEm: quando,
      arquivadoEm: null,
      aguardandoHumano: aguardando,
      // A espera conta desde a mensagem mais antiga ainda sem resposta humana; a bolinha conta as que ninguém abriu.
      ...(aguardando ? { esperandoDesde: lead.esperandoDesde ?? quando, naoLidas: { increment: 1 } } : {}),
    },
  });
  if (lead.arquivadoEm) await registrarAlteracao(leadId, "sistema", "Cliente escreveu: lead saiu do arquivo");
  await registrarAlerta({ tipo: "mensagem", leadId, texto: previa(texto, !!midia) });

  // RET-02: o cliente respondeu depois da retomada.
  if (lerLista(lead.etiquetas).includes("retomada")) {
    await alterarEtiqueta(leadId, "retomada", false, "sistema");
    await registrarUmaVez(leadId, "retomada_voltou");
    if (lead.etapa === "sem_resposta" && lead.etapaAnterior) {
      await moverEtapa(leadId, etapaOuErro(lead.etapaAnterior), "sistema", { semExigencias: true });
    }
  }
  await avisarAlmocoSeNecessario(leadId);
  await marcarMudanca();
  return mensagem;
}

/**
 * Cliente já passado ao consultor escreve enquanto ele está em almoço: avisa que ele retorna já.
 * Uma vez por almoço (o contador de almoços do consultor controla), nunca a cada mensagem.
 */
async function avisarAlmocoSeNecessario(leadId: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { consultor: { select: { status: true, almocoSeq: true } } } });
  if (lead.modoAtendimento === "bot" || !lead.consultor || lead.consultor.status !== "almoco") return;
  if (lead.avisoAlmocoSeq === lead.consultor.almocoSeq) return;
  await db.lead.update({ where: { id: leadId }, data: { avisoAlmocoSeq: lead.consultor.almocoSeq } });
  await enviarMensagemLoja({ leadId, autor: "sistema", texto: AVISO_ALMOCO });
  await registrarAlteracao(leadId, "sistema", "Aviso de horário de almoço enviado ao cliente");
}

/** Mensagem enviada pela loja (bot, consultor ou rotina). Respeita a regra das 24h (MSG-02). */
export async function enviarMensagemLoja(params: {
  leadId: string;
  autor: AutorLoja;
  autorNome?: string;
  texto?: string;
  modelo?: string;
}) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: params.leadId } });
  const quando = await agora();
  let texto = params.texto?.trim() ?? "";
  if (params.modelo) {
    const modelo = buscarModelo(params.modelo);
    if (!modelo) throw new Error("Modelo de mensagem não encontrado.");
    // Modelo é mensagem iniciada pela loja: nunca para quem pediu para parar, e só com consentimento registrado.
    if (lead.naoReceberEm) throw new Error("Este cliente pediu para parar de receber mensagens: não dá para enviar modelo.");
    if (!temConsentimento(lead)) throw new Error("Não há registro de que este cliente aceitou receber mensagens da loja. Registre como ele autorizou antes de enviar o modelo.");
    texto = modelo.texto;
  } else if (!janelaAberta(lead.ultimaMsgClienteEm, quando)) {
    throw new Error("Fora da janela de 24h: só é possível enviar um modelo aprovado.");
  }
  if (!texto) throw new Error("Mensagem vazia.");

  // WhatsApp real quando as chaves da Meta estão no ambiente; senão simulado. Em produção sem chaves nada "finge" ser enviado.
  let falhou: boolean;
  let idExterno: string | undefined;
  if (whatsappRealAtivo()) {
    // Envia para o número como a Meta o conhece (wa_id), que no Brasil pode ser sem o 9.
    const envio = await enviarPelaMeta({ para: lead.waId ?? lead.telefone, texto, modelo: params.modelo });
    falhou = !envio.ok;
    idExterno = envio.id;
    if (envio.ok && envio.waId && envio.waId !== lead.waId) await db.lead.update({ where: { id: lead.id }, data: { waId: envio.waId } });
  } else {
    falhou = !modoSimulador() || simularSemWhatsapp(lead.telefone);
  }
  const mensagem = await db.mensagem.create({
    data: {
      leadId: lead.id,
      autor: params.autor,
      autorNome: params.autorNome,
      texto,
      modelo: params.modelo,
      status: falhou ? "falhou" : "enviado",
      idExterno,
      enviadaEm: quando,
    },
  });
  await db.lead.update({
    where: { id: lead.id },
    data: {
      ultimaMensagemEm: quando,
      ultimaMensagemPrevia: previa(texto, false),
      ultimaMsgLojaEm: falhou ? lead.ultimaMsgLojaEm : quando,
      aguardandoHumano: params.autor === "consultor" ? false : lead.aguardandoHumano,
      // Consultor respondeu: o cliente não espera mais e a conversa conta como vista.
      ...(params.autor === "consultor" ? { esperandoDesde: null, naoLidas: 0 } : {}),
    },
  });
  await marcarMudanca();
  return mensagem;
}
