import Anthropic from "@anthropic-ai/sdk";
import { ESQUEMA_ESPERA, LIMITE_DE_TEMPO_MS, MODELO_ESPERA, PEDIDO_ESPERA, lerVeredito, type Veredito } from "@/regras/espera-ia";
import { obterChave } from "./chaves-api";
import { registrarUso } from "./uso-api";

// Pergunta ao Claude (Haiku) se o cliente espera resposta do vendedor. Não é o bot: sem instruções da tela, sem ferramentas.
// LGPD: o trecho da conversa vai à Anthropic, a mesma empresa que atende o bot (política de privacidade). Nada é guardado nem vai para o log.
// Nunca lança e nunca devolve "nao_espera" por engano: qualquer problema (sem chave, rede, tempo, resposta torta) vira "espera".

export async function checagemDisponivel(): Promise<boolean> {
  return !!(await obterChave("anthropic"));
}

/** `conversa` já vem montada e com as tags de segurança (`montarConversa`). */
export async function classificarEspera(conversa: string): Promise<Veredito> {
  try {
    const chave = await obterChave("anthropic");
    if (!chave) return "espera";
    // Sem nova tentativa: se a API demorar, o lead continua marcado como esperando.
    const api = new Anthropic({ apiKey: chave, timeout: LIMITE_DE_TEMPO_MS, maxRetries: 0 });
    const resposta = await api.messages.create({
      model: MODELO_ESPERA,
      max_tokens: 1000,
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_ESPERA as unknown as Record<string, unknown> } },
      system: PEDIDO_ESPERA,
      messages: [{ role: "user", content: conversa }],
    });
    await registrarUso(resposta.usage);
    if (resposta.stop_reason !== "end_turn") return "espera";
    const bloco = resposta.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return lerVeredito(bloco?.text);
  } catch (erro) {
    // Só o tipo do erro vai para o log: a mensagem pode trazer pedaço da conversa.
    console.error("[espera-ia] falhou:", erro instanceof Error ? erro.name : "erro");
    return "espera";
  }
}
