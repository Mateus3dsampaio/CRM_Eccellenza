import { db } from "@/lib/db";
import { lerLista } from "@/lib/json";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { janelaAberta } from "@/regras/janela24h";
import { buscarModelo, faltaParaLembrete, preencherModelo, proximoCompromisso, variaveisDoHorario } from "@/regras/modelos";
import { AVISO_ALMOCO } from "@/regras/almoco";
import { temConsentimento } from "@/regras/consentimento";
import { nomeSeguroDeArquivo, previaDaMidia, tipoCanonico, tipoPodeEnviar } from "@/regras/midia";
import { apagarMidia, salvarMidia } from "@/lib/midias";
import { limparNomeParaCliente, textoComNome } from "@/regras/nome-cliente";
import { simularSemWhatsapp } from "@/regras/telefone";
import { modoSimulador } from "@/lib/modo";
import { whatsappRealAtivo } from "@/lib/whatsapp-config";
import { enviarPelaMeta } from "./whatsapp";
import { registrarAlerta } from "./alertas";
import { registrarAlteracao } from "./historico";
import { alterarEtiqueta, etapaAntesDoPerdido, moverEtapa } from "./leads";
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

function previa(texto: string | null, temMidia: boolean, tipoMidia?: string | null): string {
  if (texto && texto.trim()) return texto.trim().slice(0, 140);
  return temMidia ? previaDaMidia(tipoMidia) : "";
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
export async function registrarMensagemCliente(leadId: string, texto: string | null, midia?: { arquivo: string; tipo: string; nome?: string | null; bytes?: number }, idExterno?: string) {
  const quando = await agora();
  await marcarLidas(leadId);
  const mensagem = await db.mensagem.create({
    data: { leadId, autor: "cliente", texto, midiaArquivo: midia?.arquivo, midiaTipo: midia?.tipo, midiaNome: midia?.nome ?? null, midiaBytes: midia?.bytes ?? null, enviadaEm: quando, status: "lido", idExterno },
  });
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  // Com consultor no comando (ou bot pausado), o cliente fica aguardando humano.
  const aguardando = lead.modoAtendimento !== "bot" ? true : lead.aguardandoHumano;
  await db.lead.update({
    where: { id: leadId },
    data: {
      ultimaMensagemEm: quando,
      ultimaMensagemPrevia: previa(texto, !!midia, midia?.tipo),
      ultimaMsgClienteEm: quando,
      arquivadoEm: null,
      aguardandoHumano: aguardando,
      // A espera conta desde a mensagem mais antiga ainda sem resposta humana; a bolinha conta as que ninguém abriu.
      ...(aguardando ? { esperandoDesde: lead.esperandoDesde ?? quando, naoLidas: { increment: 1 } } : {}),
    },
  });
  if (lead.arquivadoEm) await registrarAlteracao(leadId, "sistema", "Cliente escreveu: lead saiu do arquivo");
  await registrarAlerta({ tipo: "mensagem", leadId, texto: previa(texto, !!midia, midia?.tipo) });

  // Recuperação de leads: o cliente respondeu depois da 1ª ou da 2ª mensagem automática (conta uma vez; a rotina cancela o resto sozinha).
  const ultimoDoCliente = lead.ultimaMsgClienteEm?.getTime() ?? 0;
  if (lead.recuperacaoSegundaEm && !lead.recuperacaoFalhou && ultimoDoCliente < lead.recuperacaoSegundaEm.getTime()) await registrarUmaVez(leadId, "recuperacao_respondeu_segunda", lead.consultorId);
  else if (lead.recuperacaoPrimeiraEm && !lead.recuperacaoFalhou && !lead.recuperacaoSegundaEm && ultimoDoCliente < lead.recuperacaoPrimeiraEm.getTime()) await registrarUmaVez(leadId, "recuperacao_respondeu_primeira", lead.consultorId);

  // RET-02: o cliente respondeu depois da retomada.
  if (lerLista(lead.etiquetas).includes("retomada")) {
    await alterarEtiqueta(leadId, "retomada", false, "sistema");
    await registrarUmaVez(leadId, "retomada_voltou");
  }
  // Card em Perdido (por qualquer motivo, movido pelo consultor ou pela rotina): o cliente voltou a falar, o card volta
  // para a coluna em que estava (decisão do Mateus 04/11/2026). Lead excluído não passa aqui: a mensagem cria um lead novo.
  if (lead.etapa === "perdido") await moverEtapa(leadId, await etapaAntesDoPerdido(lead), "sistema", { semExigencias: true });
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
  /** Nome que o cliente vê na frente do texto (ou da legenda). Só vale para consultor/admin, sem modelo e com texto: bot, sistema e modelo da Meta nunca levam nome. */
  nomeParaCliente?: string;
  texto?: string; // com anexo, vira a legenda
  modelo?: string;
  /** Imagem, vídeo ou PDF para o cliente (só dentro da janela de 24h, como texto livre). */
  anexo?: { dados: Buffer; tipo: string; nome: string };
}) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: params.leadId } });
  const quando = await agora();
  let texto = params.texto?.trim() ?? "";
  let parametros: Record<string, string> | undefined;
  if (params.modelo) {
    const modelo = buscarModelo(params.modelo);
    if (!modelo) throw new Error("Modelo de mensagem não encontrado.");
    // Modelo é mensagem iniciada pela loja: nunca para quem pediu para parar, e só com consentimento registrado.
    if (lead.naoReceberEm) throw new Error("Este cliente pediu para parar de receber mensagens: não dá para enviar modelo.");
    if (!temConsentimento(lead)) throw new Error("Não há registro de que este cliente aceitou receber mensagens da loja. Registre como ele autorizou antes de enviar o modelo.");
    if (modelo.compromisso) {
      // Lembrete: data e hora do próximo compromisso deste tipo na agenda (variáveis {{data}} e {{hora}} do modelo na Meta).
      const visitas = await db.visita.findMany({ where: { leadId: lead.id, tipo: modelo.compromisso, status: "agendada" }, select: { tipo: true, inicio: true, status: true } });
      const compromisso = proximoCompromisso(visitas, modelo.compromisso, quando);
      const falta = faltaParaLembrete(modelo, compromisso);
      if (falta || !compromisso) throw new Error(falta ?? "Compromisso não encontrado.");
      parametros = variaveisDoHorario(compromisso.inicio);
    }
    texto = parametros ? preencherModelo(modelo.texto, parametros) : modelo.texto;
  } else if (!janelaAberta(lead.ultimaMsgClienteEm, quando)) {
    throw new Error("Fora da janela de 24h: só é possível enviar um modelo aprovado.");
  }
  if (!texto && !params.anexo) throw new Error("Mensagem vazia.");
  // O banco guarda o texto SEM o nome; o nome só entra no que vai para a Meta (arquivo sem legenda continua sem legenda).
  const nomeNoEnvio = params.autor === "consultor" && !params.modelo && texto ? limparNomeParaCliente(params.nomeParaCliente) || null : null;
  const textoParaMeta = nomeNoEnvio ? textoComNome(texto, nomeNoEnvio) : texto;
  if (params.anexo && params.modelo) throw new Error("Modelo e arquivo não vão juntos.");
  if (params.anexo && !tipoPodeEnviar(params.anexo.tipo)) throw new Error("Para enviar, use imagem JPG ou PNG, vídeo MP4, PDF, Word, Excel, DWG ou ZIP.");
  // Guarda o arquivo antes de enviar: confere tipo, tamanho e o começo do arquivo (lança se não servir).
  const nomeAnexo = params.anexo ? nomeSeguroDeArquivo(params.anexo.nome) : undefined;
  const arquivo = params.anexo ? await salvarMidia(params.anexo.dados, params.anexo.tipo) : undefined;

  // WhatsApp real quando as chaves da Meta estão no ambiente; senão simulado. Em produção sem chaves nada "finge" ser enviado.
  let falhou: boolean;
  let idExterno: string | undefined;
  let mensagem: Awaited<ReturnType<typeof db.mensagem.create>>;
  try {
    if (whatsappRealAtivo()) {
      // Envia para o número como a Meta o conhece (wa_id), que no Brasil pode ser sem o 9.
      const envio = await enviarPelaMeta({ para: lead.waId ?? lead.telefone, texto: textoParaMeta, modelo: params.modelo, parametros, anexo: params.anexo && nomeAnexo ? { ...params.anexo, nome: nomeAnexo } : undefined });
      falhou = !envio.ok;
      idExterno = envio.id;
      if (envio.ok && envio.waId && envio.waId !== lead.waId) await db.lead.update({ where: { id: lead.id }, data: { waId: envio.waId } });
    } else {
      falhou = !modoSimulador() || simularSemWhatsapp(lead.telefone);
    }
    mensagem = await db.mensagem.create({
      data: {
        leadId: lead.id,
        autor: params.autor,
        autorNome: params.autorNome,
        texto: texto || null,
        nomeNoEnvio,
        modelo: params.modelo,
        midiaArquivo: arquivo,
        midiaTipo: params.anexo ? tipoCanonico(params.anexo.tipo) : null,
        midiaNome: nomeAnexo ?? null,
        midiaBytes: params.anexo?.dados.length ?? null,
        status: falhou ? "falhou" : "enviado",
        idExterno,
        enviadaEm: quando,
      },
    });
  } catch (erro) {
    // Não deixa o arquivo solto no disco sem mensagem (nem a exclusão do cliente nem a limpeza de 180 dias chegariam nele).
    if (arquivo) await apagarMidia(arquivo).catch(() => undefined);
    throw erro;
  }
  await db.lead.update({
    where: { id: lead.id },
    data: {
      ultimaMensagemEm: quando,
      ultimaMensagemPrevia: previa(texto, !!arquivo, params.anexo?.tipo),
      ultimaMsgLojaEm: falhou ? lead.ultimaMsgLojaEm : quando,
      aguardandoHumano: params.autor === "consultor" ? false : lead.aguardandoHumano,
      // Consultor respondeu: o cliente não espera mais e a conversa conta como vista.
      ...(params.autor === "consultor" ? { esperandoDesde: null, naoLidas: 0 } : {}),
    },
  });
  await marcarMudanca();
  return mensagem;
}
