import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { lerMidia } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { avaliarLimiteDoBot } from "@/regras/limite-bot";
import { formatarDataHora, formatarDiaSemana } from "@/regras/tempo";
import { registrarAlteracao } from "@/servicos/historico";
import { enviarMensagemLoja } from "@/servicos/mensagens";
import { registrarUso } from "@/servicos/uso-api";
import { executarFerramenta } from "./executor";
import { FERRAMENTAS } from "./ferramentas";
import { montarPromptSistema } from "./prompt";
import { limparResposta, respostaDescartada } from "./saida";

// Modelo do bot: o Sonnet mais recente (docs/briefing.md).
export const MODELO_BOT = "claude-sonnet-5-5";
const MAX_VOLTAS = 8;

type MensagemApi = Anthropic.Beta.Messages.BetaMessageParam;
type BlocoEntrada = Anthropic.Beta.Messages.BetaContentBlockParam;

let cliente: Anthropic | null = null;
function clienteApi(): Anthropic {
  // A chave vem só do .env (ANTHROPIC_API_KEY); nunca é lida, exibida ou registrada pelo sistema.
  cliente ??= new Anthropic({ timeout: 45_000, maxRetries: 2 });
  return cliente;
}

export class ErroBot extends Error {}

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

function escapar(texto: string): string {
  return texto.replace(/</g, "‹").replace(/>/g, "›");
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
  const contexto = [`Agora: ${formatarDiaSemana(quando)} ${formatarDataHora(quando)} (horário de Fortaleza).`];
  if (primeiraVez) contexto.push(`Nome do perfil do cliente no WhatsApp: ${lead.nomePerfil ? escapar(lead.nomePerfil) : "(sem nome)"}.`);
  blocos.push({ type: "text", text: `<sistema>${contexto.join(" ")}</sistema>` });

  for (const m of novas) {
    if (m.autor === "cliente") {
      if (m.midiaArquivo && m.midiaTipo) {
        const dados = await lerMidia(m.midiaArquivo).catch(() => null);
        if (dados) {
          blocos.push({
            type: "image",
            source: { type: "base64", media_type: m.midiaTipo as "image/png", data: dados.toString("base64") },
          });
          blocos.push({ type: "text", text: `<cliente>[enviou a imagem acima]${m.texto ? ` ${escapar(m.texto)}` : ""}</cliente>` });
          continue;
        }
      }
      blocos.push({ type: "text", text: `<cliente>${escapar(m.texto ?? "")}</cliente>` });
    } else {
      const quem = m.autor === "consultor" ? `o consultor ${m.autorNome ?? ""}`.trim() : "o sistema (mensagem automática)";
      blocos.push({ type: "text", text: `<sistema>Mensagem enviada ao cliente por ${quem}: "${escapar(m.texto ?? "")}"</sistema>` });
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

function textoDasRespostas(blocos: Anthropic.Beta.Messages.BetaContentBlock[]): string {
  return blocos
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
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
  if (erro instanceof Anthropic.AuthenticationError) return "a chave da API é inválida. Confira o .env.";
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

    const conversa = lead.conversaApi ?? (await db.conversaApi.create({ data: { leadId } }));
    const historico = JSON.parse(conversa.mensagens) as MensagemApi[];
    const { blocos, ids } = await montarTurno(leadId, historico.length === 0);
    historico.push({ role: "user", content: blocos });
    await db.mensagem.updateMany({ where: { id: { in: ids } }, data: { processadaPeloBot: true } });

    // O histórico só cresce (nunca é editado). Guardado a cada volta para ficar sempre consistente.
    const salvar = () => db.conversaApi.update({ where: { leadId }, data: { mensagens: JSON.stringify(historico) } });
    let interrompido = false;

    const textos: string[] = [];
    try {
      if (!process.env.ANTHROPIC_API_KEY) throw new ErroBot("a chave da API não está configurada no .env.");
      const sistema = await montarPromptSistema();

      for (let volta = 0; volta < MAX_VOLTAS; volta++) {
        const resposta = await clienteApi().beta.messages.create({
          model: MODELO_BOT,
          max_tokens: 8000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium" },
          // Cache de 1 hora (o máximo da API): cada uso renova o prazo, então com clientes escrevendo ao longo
          // do dia o prompt é gravado poucas vezes. Os dois pontos de cache usam o mesmo prazo.
          cache_control: { type: "ephemeral", ttl: "1h" },
          system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral", ttl: "1h" } }],
          tools: FERRAMENTAS,
          messages: historico,
        });

        await registrarUso(resposta.usage);
        if (resposta.stop_reason === "refusal") throw new ErroBot("o modelo recusou responder esta conversa.");
        historico.push({ role: "assistant", content: resposta.content as BlocoEntrada[] });
        const texto = textoDasRespostas(resposta.content);
        if (texto) textos.push(texto);

        if (resposta.stop_reason === "max_tokens") throw new ErroBot("a resposta do modelo ficou longa demais.");
        if (resposta.stop_reason !== "tool_use") break;

        const resultados: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
        for (const bloco of resposta.content) {
          if (bloco.type !== "tool_use") continue;
          // Consultor assumiu no meio: nada mais é gravado nem enviado pelo bot.
          if (interrompido || (await consultorAssumiu(leadId))) {
            interrompido = true;
            resultados.push({ type: "tool_result", tool_use_id: bloco.id, content: "Não executada: um consultor assumiu a conversa.", is_error: true });
            continue;
          }
          const r = await executarFerramenta(leadId, bloco.name, bloco.input);
          resultados.push({ type: "tool_result", tool_use_id: bloco.id, content: r.conteudo, is_error: r.erro });
        }
        historico.push({ role: "user", content: resultados });
        await salvar();
        if (interrompido) break;
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

    const original = textos.join("\n\n");
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
