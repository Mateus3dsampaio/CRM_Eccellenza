import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { lerMidia } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { avaliarLimiteDoBot } from "@/regras/limite-bot";
import { descricaoDoTipo } from "@/regras/midia";
import { situacaoDaLoja } from "@/regras/presenca";
import { formatarDataHora, formatarDiaSemana } from "@/regras/tempo";
import { regrasDaAgenda } from "@/servicos/configuracoes";
import { registrarAlteracao } from "@/servicos/historico";
import { enviarMensagemLoja } from "@/servicos/mensagens";
import { obterChave } from "@/servicos/chaves-api";
import { atendimentoDaIaLigado } from "@/servicos/configuracoes";
import { instrucoesAtivas } from "@/servicos/instrucoes";
import { familiaClaude } from "@/regras/modelos-ia";
import { configDoBot } from "@/servicos/provedor-bot";
import { registrarUso } from "@/servicos/uso-api";
import { executarFerramenta } from "./executor";
import { avisoArquivoNaoLido, avisoDoTurno, avisoImagem, avisoMensagemEnviada, mensagemDoCliente } from "./avisos";
import { FERRAMENTAS, NOME_ENCERRAR_CONTATO } from "./ferramentas";
import { deRespostaOpenAI, paraFerramentasOpenAI, paraMensagensOpenAI, type MotivoDeParada } from "./openai-conversao";
import { montarPromptSistema } from "./prompt";
import { juntarTextos, limparResposta, respostaDescartada } from "./saida";

// O modelo do bot é escolhido pelo admin (Configurações > Chaves de API; padrão em regras/modelos-ia.ts).
const MAX_VOLTAS = 8;

type MensagemApi = Anthropic.Beta.Messages.BetaMessageParam;
type BlocoEntrada = Anthropic.Beta.Messages.BetaContentBlockParam;

let cliente: { chave: string; api: Anthropic } | null = null;
function clienteApi(chave: string): Anthropic {
  // A chave vem de Configurações > Chaves de API (ou da variável ANTHROPIC_API_KEY); nunca é exibida nem registrada.
  // O cliente é refeito quando a chave muda, para uma troca pela tela valer na próxima mensagem.
  if (cliente?.chave !== chave) cliente = { chave, api: new Anthropic({ apiKey: chave, timeout: 45_000, maxRetries: 2 }) };
  return cliente.api;
}

export class ErroBot extends Error {}

/** Uma volta com o modelo, no mesmo formato para os dois provedores (o histórico guardado é sempre o da Anthropic). */
interface VoltaDoModelo {
  content: BlocoEntrada[];
  parada: MotivoDeParada;
}

// Reserva automática quando o modelo recusa: só nas famílias que aceitam (o Haiku não tem).
const FAMILIAS_COM_RESERVA = new Set(["sonnet", "opus", "fable"]);

async function voltaComClaude(chave: string, modelo: string, sistema: string, historico: MensagemApi[]): Promise<VoltaDoModelo> {
  const reserva = FAMILIAS_COM_RESERVA.has(familiaClaude(modelo) ?? "");
  const resposta = await clienteApi(chave).beta.messages.create({
    model: modelo,
    max_tokens: 8000,
    ...(reserva ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    output_config: { effort: "medium" },
    // Cache de 1 hora (o máximo da API): cada uso renova o prazo, então com clientes escrevendo ao longo
    // do dia o prompt é gravado poucas vezes. Os dois pontos de cache usam o mesmo prazo.
    cache_control: { type: "ephemeral", ttl: "1h" },
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral", ttl: "1h" } }],
    tools: FERRAMENTAS,
    messages: historico,
  });
  await registrarUso(resposta.usage);
  const parada: MotivoDeParada =
    resposta.stop_reason === "refusal" ? "refusal" : resposta.stop_reason === "max_tokens" ? "max_tokens" : resposta.stop_reason === "tool_use" ? "tool_use" : "end_turn";
  return { content: resposta.content as BlocoEntrada[], parada };
}

let clienteOpenAI: { chave: string; api: OpenAI } | null = null;
async function voltaComGpt(chave: string, modelo: string, sistema: string, historico: MensagemApi[]): Promise<VoltaDoModelo> {
  if (clienteOpenAI?.chave !== chave) clienteOpenAI = { chave, api: new OpenAI({ apiKey: chave, timeout: 60_000, maxRetries: 2 }) };
  const resposta = await clienteOpenAI.api.chat.completions.create({
    model: modelo,
    max_completion_tokens: 8000,
    messages: paraMensagensOpenAI(sistema, historico as never) as OpenAI.Chat.ChatCompletionMessageParam[],
    tools: paraFerramentasOpenAI(FERRAMENTAS),
  });
  const cacheado = resposta.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  await registrarUso({ input_tokens: Math.max(0, (resposta.usage?.prompt_tokens ?? 0) - cacheado), output_tokens: resposta.usage?.completion_tokens ?? 0, cache_read_input_tokens: cacheado });
  const { content, parada } = deRespostaOpenAI(resposta as never);
  return { content: content as BlocoEntrada[], parada };
}

// Uma resposta por vez em cada conversa (evita o bot responder duas vezes em paralelo).
const filas = new Map<string, Promise<unknown>>();
function naFila<T>(leadId: string, tarefa: () => Promise<T>): Promise<T> {
  const anterior = filas.get(leadId) ?? Promise.resolve();
  const atual = anterior.catch(() => undefined).then(tarefa);
  filas.set(leadId, atual);
  void atual.finally(() => {
    if (filas.get(leadId) === atual) filas.delete(leadId);
  });
  return atual;
}

/** Monta o turno do usuário com tudo o que aconteceu na conversa desde a última resposta do bot. */
async function montarTurno(leadId: string, primeiraVez: boolean): Promise<{ blocos: BlocoEntrada[]; ids: string[] }> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  // Progresso marcado por mensagem (não por horário), porque o relógio simulado pode mudar.
  const novas = await db.mensagem.findMany({
    where: { leadId, autor: { not: "bot" }, processadaPeloBot: false },
    orderBy: [{ enviadaEm: "asc" }, { id: "asc" }],
  });
  const quando = await agora();
  const blocos: BlocoEntrada[] = [];
  const situacaoLoja = situacaoDaLoja(quando, await regrasDaAgenda());
  blocos.push({ type: "text", text: avisoDoTurno({ diaSemana: formatarDiaSemana(quando), dataHora: formatarDataHora(quando), situacaoLoja, primeiraVez, nomePerfil: lead.nomePerfil }) });

  for (const m of novas) {
    if (m.autor === "cliente") {
      // Vídeo e documento (PDF, Word, Excel, DWG, ZIP) ficam guardados para o consultor; o bot só é avisado de que chegaram (não "vê" o conteúdo).
      if (m.midiaArquivo && m.midiaTipo && !m.midiaTipo.startsWith("image/")) {
        blocos.push({ type: "text", text: avisoArquivoNaoLido(descricaoDoTipo(m.midiaTipo), m.midiaNome, m.texto) });
        continue;
      }
      if (m.midiaArquivo && m.midiaTipo) {
        const dados = await lerMidia(m.midiaArquivo).catch(() => null);
        if (dados) {
          blocos.push({
            type: "image",
            source: { type: "base64", media_type: m.midiaTipo as "image/png", data: dados.toString("base64") },
          });
          blocos.push({ type: "text", text: avisoImagem(m.texto) });
          continue;
        }
      }
      blocos.push({ type: "text", text: mensagemDoCliente(m.texto) });
    } else {
      blocos.push({
        type: "text",
        text: avisoMensagemEnviada({ autor: m.autor === "consultor" ? "consultor" : "sistema", autorNome: m.autorNome, rotuloArquivo: m.midiaTipo ? descricaoDoTipo(m.midiaTipo) : null, texto: m.texto }),
      });
    }
  }
  return { blocos, ids: novas.map((m) => m.id) };
}

/** Toda chamada de ferramenta sem resultado recebe um resultado de erro, para o histórico continuar válido. */
function fecharFerramentasPendentes(historico: MensagemApi[], motivo: string) {
  const ultima = historico[historico.length - 1];
  if (ultima?.role !== "assistant" || !Array.isArray(ultima.content)) return;
  const pendentes = ultima.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlockParam => b.type === "tool_use");
  if (!pendentes.length) return;
  historico.push({ role: "user", content: pendentes.map((b) => ({ type: "tool_result" as const, tool_use_id: b.id, content: motivo, is_error: true })) });
}

/** O consultor assumiu a conversa enquanto o bot pensava? (BOT-05) */
async function consultorAssumiu(leadId: string): Promise<boolean> {
  const atual = await db.lead.findUnique({ where: { id: leadId }, select: { modoAtendimento: true } });
  return atual?.modoAtendimento === "humano";
}

function textoDasRespostas(blocos: BlocoEntrada[]): string {
  return blocos
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlockParam => b.type === "text")
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

async function marcarErro(leadId: string, mensagem: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { esperandoDesde: true, naoLidas: true } });
  await db.lead.update({
    where: { id: leadId },
    data: { aguardandoHumano: true, erroBot: mensagem, esperandoDesde: lead.esperandoDesde ?? (await agora()), naoLidas: Math.max(lead.naoLidas, 1) },
  });
  await registrarAlteracao(leadId, "sistema", `Bot não respondeu: ${mensagem}`);
  await marcarMudanca();
}

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroBot) return erro.message;
  if (erro instanceof OpenAI.AuthenticationError) return "a chave da OpenAI é inválida. Confira em Configurações > Chaves de API.";
  if (erro instanceof OpenAI.NotFoundError) return "a OpenAI não achou o modelo configurado (ou a conta não tem acesso). Confira o nome em Configurações > Chaves de API.";
  if (erro instanceof OpenAI.RateLimitError) return "limite de uso ou saldo da OpenAI atingido. Confira a conta da OpenAI.";
  if (erro instanceof OpenAI.BadRequestError) return "a OpenAI recusou a requisição.";
  if (erro instanceof OpenAI.APIConnectionError) return "sem conexão com a API da OpenAI.";
  if (erro instanceof OpenAI.APIError) return `a API da OpenAI está com problema (código ${erro.status ?? "?"}).`;
  if (erro instanceof Anthropic.AuthenticationError) return "a chave da API do Claude é inválida. Confira em Configurações > Chaves de API.";
  if (erro instanceof Anthropic.NotFoundError) return "a Anthropic não achou o modelo escolhido (ou a conta não tem acesso). Escolha outro em Configurações > Chaves de API.";
  if (erro instanceof Anthropic.RateLimitError) return "limite de uso da API atingido. Tente de novo em instantes.";
  if (erro instanceof Anthropic.BadRequestError) return "a API recusou a requisição.";
  if (erro instanceof Anthropic.APIConnectionError) return "sem conexão com a API do Claude.";
  if (erro instanceof Anthropic.APIError) return `a API do Claude está com problema (código ${erro.status ?? "?"}).`;
  return "erro inesperado no atendimento automático.";
}

/**
 * Bot responde ao cliente (BOT-02/03). Devolve os textos enviados.
 * Falha da API não derruba o sistema: a conversa fica "aguardando humano" com aviso (BOT-06).
 */
export function responderCliente(leadId: string): Promise<{ respostas: string[]; erro?: string }> {
  return naFila(leadId, async () => {
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { conversaApi: true } });
    if (lead.modoAtendimento !== "bot") return { respostas: [] };
    // Cliente que pediu para parar (LGPD): o bot não responde e a mensagem fica para um humano.
    if (lead.naoReceberEm) return { respostas: [] };
    // Contato bloqueado (tarefa 44): nenhuma chamada à API.
    if (lead.bloqueadoEm) return { respostas: [] };

    // Proteção de custo (tarefa 14): excesso de mensagens do cliente não chama a API, passa para um humano.
    const recentes = await db.mensagem.findMany({
      where: { leadId, autor: "cliente", enviadaEm: { gte: new Date((await agora()).getTime() - 24 * 60 * 60 * 1000) } },
      select: { enviadaEm: true },
    });
    const limite = avaliarLimiteDoBot(recentes.map((m) => m.enviadaEm), await agora());
    if (limite.excedeu) {
      const mensagem = `${limite.motivo}; o bot pausou para não gastar a API à toa.`;
      await db.mensagem.updateMany({ where: { leadId, autor: { not: "bot" }, processadaPeloBot: false }, data: { processadaPeloBot: true } });
      await marcarErro(leadId, mensagem);
      return { respostas: [], erro: mensagem };
    }

    // Chave geral desligada pelo admin: nenhuma chamada à API, o cliente vai direto ao consultor.
    if (!(await atendimentoDaIaLigado())) {
      const mensagem = "o atendimento da IA está desligado (Configurações > Instruções de atendimento).";
      await db.mensagem.updateMany({ where: { leadId, autor: { not: "bot" }, processadaPeloBot: false }, data: { processadaPeloBot: true } });
      await executarFerramenta(leadId, "passar_para_consultor", { motivo: "atendimento da IA desligado" });
      await db.lead.update({ where: { id: leadId }, data: { erroBot: mensagem } });
      await marcarMudanca();
      return { respostas: [], erro: mensagem };
    }

    // Sem instruções cadastradas o bot não atende sem roteiro: o cliente vai direto ao consultor (decisão do Mateus 04/11/2026).
    if ((await instrucoesAtivas()).length === 0) {
      const mensagem = "o bot está sem instruções cadastradas (Configurações > Instruções de atendimento).";
      await db.mensagem.updateMany({ where: { leadId, autor: { not: "bot" }, processadaPeloBot: false }, data: { processadaPeloBot: true } });
      await executarFerramenta(leadId, "passar_para_consultor", { motivo: "bot sem instruções cadastradas" });
      await db.lead.update({ where: { id: leadId }, data: { erroBot: mensagem } });
      await marcarMudanca();
      return { respostas: [], erro: mensagem };
    }

    const conversa = lead.conversaApi ?? (await db.conversaApi.create({ data: { leadId } }));
    const historico = JSON.parse(conversa.mensagens) as MensagemApi[];
    const { blocos, ids } = await montarTurno(leadId, historico.length === 0);
    historico.push({ role: "user", content: blocos });
    await db.mensagem.updateMany({ where: { id: { in: ids } }, data: { processadaPeloBot: true } });

    // O histórico só cresce (nunca é editado). Guardado a cada volta para ficar sempre consistente.
    const salvar = () => db.conversaApi.update({ where: { leadId }, data: { mensagens: JSON.stringify(historico) } });
    let interrompido = false;
    // O bot encerrou o contato (ferramenta encerrar_contato): nada é enviado ao cliente, nem o texto que veio junto.
    let encerrado = false;

    const textos: string[] = [];
    try {
      const { provedor, modeloClaude, modeloOpenai } = await configDoBot();
      const chaveApi = await obterChave(provedor === "openai" ? "openai" : "anthropic");
      if (!chaveApi) throw new ErroBot(`a chave ${provedor === "openai" ? "da OpenAI" : "do Claude"} não está configurada (Configurações > Chaves de API).`);
      const sistema = await montarPromptSistema();

      for (let volta = 0; volta < MAX_VOLTAS; volta++) {
        const resposta = provedor === "openai" ? await voltaComGpt(chaveApi, modeloOpenai, sistema, historico) : await voltaComClaude(chaveApi, modeloClaude, sistema, historico);
        if (resposta.parada === "refusal") throw new ErroBot("o modelo recusou responder esta conversa.");
        historico.push({ role: "assistant", content: resposta.content });
        const texto = textoDasRespostas(resposta.content);
        if (texto) textos.push(texto);

        if (resposta.parada === "max_tokens") throw new ErroBot("a resposta do modelo ficou longa demais.");
        if (resposta.parada !== "tool_use") break;

        const resultados: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
        for (const bloco of resposta.content) {
          if (bloco.type !== "tool_use") continue;
          // Consultor assumiu no meio: nada mais é gravado nem enviado pelo bot.
          if (interrompido || (await consultorAssumiu(leadId))) {
            interrompido = true;
            resultados.push({ type: "tool_result", tool_use_id: bloco.id, content: "Não executada: um consultor assumiu a conversa.", is_error: true });
            continue;
          }
          if (encerrado) {
            resultados.push({ type: "tool_result", tool_use_id: bloco.id, content: "Não executada: o contato foi encerrado.", is_error: true });
            continue;
          }
          const r = await executarFerramenta(leadId, bloco.name, bloco.input);
          resultados.push({ type: "tool_result", tool_use_id: bloco.id, content: r.conteudo, is_error: r.erro });
          if (bloco.name === NOME_ENCERRAR_CONTATO && !r.erro) encerrado = true;
        }
        historico.push({ role: "user", content: resultados });
        await salvar();
        if (interrompido || encerrado) break;
        if (volta === MAX_VOLTAS - 1) throw new ErroBot("o atendimento automático entrou em repetição.");
      }
      await salvar();
    } catch (erro) {
      fecharFerramentasPendentes(historico, "Resposta interrompida; ferramenta não executada.");
      await salvar().catch(() => undefined);
      const mensagem = mensagemDeErro(erro);
      console.error("[bot] falha:", mensagem);
      await marcarErro(leadId, mensagem);
      return { respostas: [], erro: mensagem };
    }

    if (encerrado) {
      await marcarMudanca();
      return { respostas: [] };
    }
    const original = juntarTextos(textos);
    const final = limparResposta(original);
    // Confere de novo antes de enviar: se o consultor assumiu enquanto o bot pensava, o bot não envia.
    if (interrompido || (await consultorAssumiu(leadId))) {
      await marcarMudanca();
      return { respostas: [] };
    }
    // O filtro apagou a resposta inteira: o cliente não pode ficar sem resposta sem ninguém saber.
    if (respostaDescartada(original, final)) {
      const mensagem = "a resposta do bot foi descartada por parecer uma anotação interna.";
      await marcarErro(leadId, mensagem);
      return { respostas: [], erro: mensagem };
    }
    if (final) {
      const enviada = await enviarMensagemLoja({ leadId, autor: "bot", autorNome: "Bot", texto: final });
      // A Meta recusou (token vencido, modelo, janela...): o cliente ficou sem resposta e alguém precisa saber.
      if (enviada.status === "falhou") {
        const mensagem = "o WhatsApp não entregou a resposta do bot.";
        await marcarErro(leadId, mensagem);
        return { respostas: [], erro: mensagem };
      }
    }
    if (lead.erroBot) await db.lead.update({ where: { id: leadId }, data: { erroBot: null } });
    await marcarMudanca();
    return { respostas: final ? [final] : [] };
  });
}
