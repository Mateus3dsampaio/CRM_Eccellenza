import Anthropic from "@anthropic-ai/sdk";
import { LIMITE_REVISAO, MODELO_REVISAO, PEDIDO_REVISAO, limparRevisao, linksPreservados, numerosPreservados } from "@/regras/revisao-texto";
import { obterChave } from "./chaves-api";
import { registrarUso } from "./uso-api";

// Botão "Revisar texto" da conversa: o Claude (Haiku) corrige ortografia, concordância e pontuação do que o vendedor escreveu.
// Nunca envia nada e nunca troca o texto sozinho: devolve a sugestão e o vendedor escolhe.
// LGPD: o texto do vendedor vai à Anthropic, a mesma empresa que atende o bot (política de privacidade). O texto não é guardado nem vai para o log.

export type ResultadoDaRevisao =
  | { estado: "corrigido"; texto: string }
  | { estado: "igual" }
  | { estado: "indisponivel"; motivo: string };

/** Sem chave da Anthropic a revisão fica desligada (o bot pode estar no GPT). */
export async function revisaoDisponivel(): Promise<boolean> {
  return !!(await obterChave("anthropic"));
}

/** Nunca lança: qualquer problema vira "indisponível" com um motivo que o vendedor entende. */
export async function revisarTexto(original: string): Promise<ResultadoDaRevisao> {
  const texto = original.trim();
  if (!texto) return { estado: "indisponivel", motivo: "Escreva a mensagem primeiro." };
  if (texto.length > LIMITE_REVISAO) return { estado: "indisponivel", motivo: `O texto é grande demais para revisar (máximo ${LIMITE_REVISAO} caracteres).` };
  const chave = await obterChave("anthropic");
  if (!chave) return { estado: "indisponivel", motivo: "A revisão precisa da chave do Claude em Configurações > Chaves de API." };
  try {
    const api = new Anthropic({ apiKey: chave, timeout: 20_000, maxRetries: 1 });
    const resposta = await api.messages.create({
      model: MODELO_REVISAO,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: PEDIDO_REVISAO,
      messages: [{ role: "user", content: `<texto>${texto}</texto>` }],
    });
    await registrarUso(resposta.usage);
    if (resposta.stop_reason !== "end_turn") return { estado: "indisponivel", motivo: "Não consegui revisar este texto. Envie como está ou tente de novo." };
    const bloco = resposta.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const revisado = limparRevisao(bloco?.text ?? "");
    if (!revisado) return { estado: "indisponivel", motivo: "A revisão voltou vazia. Tente de novo." };
    // Trava: a revisão não pode mexer em número nem em link. Se mexeu, descarta e avisa.
    if (!numerosPreservados(texto, revisado) || !linksPreservados(texto, revisado)) {
      return { estado: "indisponivel", motivo: "A revisão mudou números ou links, então foi descartada. Confira o texto você mesmo." };
    }
    return revisado === texto ? { estado: "igual" } : { estado: "corrigido", texto: revisado };
  } catch (erro) {
    // Só o tipo do erro vai para o log: a mensagem pode trazer pedaço do texto.
    console.error("[revisao-texto] falhou:", erro instanceof Error ? erro.name : "erro");
    if (erro instanceof Anthropic.AuthenticationError) return { estado: "indisponivel", motivo: "A chave do Claude foi recusada. Peça ao administrador para conferir." };
    if (erro instanceof Anthropic.APIConnectionError) return { estado: "indisponivel", motivo: "Sem conexão com o Claude agora. Tente de novo." };
    return { estado: "indisponivel", motivo: "Não consegui revisar agora. Tente de novo." };
  }
}
