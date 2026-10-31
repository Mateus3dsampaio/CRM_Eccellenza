import { db } from "@/lib/db";
import { lerLista } from "@/lib/json";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { janelaAberta } from "@/regras/janela24h";
import { buscarModelo } from "@/regras/modelos";
import { simularSemWhatsapp } from "@/regras/telefone";
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
export async function registrarMensagemCliente(leadId: string, texto: string | null, midia?: { arquivo: string; tipo: string }) {
  const quando = await agora();
  await marcarLidas(leadId);
  const mensagem = await db.mensagem.create({
    data: { leadId, autor: "cliente", texto, midiaArquivo: midia?.arquivo, midiaTipo: midia?.tipo, enviadaEm: quando, status: "lido" },
  });
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  await db.lead.update({
    where: { id: leadId },
    data: {
      ultimaMensagemEm: quando,
      ultimaMensagemPrevia: previa(texto, !!midia),
      ultimaMsgClienteEm: quando,
      arquivadoEm: null,
      // Com consultor no comando (ou bot pausado), o cliente fica aguardando humano.
      aguardandoHumano: lead.modoAtendimento !== "bot" ? true : lead.aguardandoHumano,
    },
  });
  if (lead.arquivadoEm) await registrarAlteracao(leadId, "sistema", "Cliente escreveu: lead saiu do arquivo");

  // RET-02: o cliente respondeu depois da retomada.
  if (lerLista(lead.etiquetas).includes("retomada")) {
    await alterarEtiqueta(leadId, "retomada", false, "sistema");
    await registrarUmaVez(leadId, "retomada_voltou");
    if (lead.etapa === "sem_resposta" && lead.etapaAnterior) {
      await moverEtapa(leadId, etapaOuErro(lead.etapaAnterior), "sistema");
    }
  }
  await marcarMudanca();
  return mensagem;
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
    texto = modelo.texto;
  } else if (!janelaAberta(lead.ultimaMsgClienteEm, quando)) {
    throw new Error("Fora da janela de 24h: só é possível enviar um modelo aprovado.");
  }
  if (!texto) throw new Error("Mensagem vazia.");

  const falhou = simularSemWhatsapp(lead.telefone);
  const mensagem = await db.mensagem.create({
    data: {
      leadId: lead.id,
      autor: params.autor,
      autorNome: params.autorNome,
      texto,
      modelo: params.modelo,
      status: falhou ? "falhou" : "enviado",
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
    },
  });
  await marcarMudanca();
  return mensagem;
}
