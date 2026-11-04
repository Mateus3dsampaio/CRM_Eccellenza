// Conversão entre o histórico do bot (formato da Anthropic, que é o que fica guardado no banco) e o da OpenAI (Chat Completions).
// Funções puras. Guardar sempre no formato da Anthropic permite trocar de provedor no meio de uma conversa.

type Bloco = { type: string; [k: string]: unknown };
export interface MensagemHistorico {
  role: "user" | "assistant";
  content: string | Bloco[];
}

export type PartePedido = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type MensagemOpenAI =
  | { role: "system"; content: string }
  | { role: "user"; content: string | PartePedido[] }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

function textoDoResultado(conteudo: unknown): string {
  if (typeof conteudo === "string") return conteudo;
  if (Array.isArray(conteudo)) return conteudo.map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text) : "")).join("\n");
  return "";
}

export function paraMensagensOpenAI(sistema: string, historico: MensagemHistorico[]): MensagemOpenAI[] {
  const saida: MensagemOpenAI[] = [{ role: "system", content: sistema }];
  for (const m of historico) {
    if (typeof m.content === "string") {
      saida.push({ role: m.role, content: m.content } as MensagemOpenAI);
      continue;
    }
    if (m.role === "assistant") {
      const texto = m.content.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("\n\n");
      const chamadas = m.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: String(b.id), type: "function" as const, function: { name: String(b.name), arguments: JSON.stringify(b.input ?? {}) } }));
      if (!texto && !chamadas.length) continue;
      saida.push({ role: "assistant", content: texto || null, ...(chamadas.length ? { tool_calls: chamadas } : {}) });
      continue;
    }
    // Usuário: resultados de ferramenta viram mensagens "tool" (têm que vir logo depois da chamada); o resto vira a fala do usuário.
    const partes: PartePedido[] = [];
    for (const b of m.content) {
      if (b.type === "tool_result") {
        const erro = b.is_error ? "ERRO: " : "";
        saida.push({ role: "tool", tool_call_id: String(b.tool_use_id), content: erro + textoDoResultado(b.content) });
      } else if (b.type === "text") {
        partes.push({ type: "text", text: String(b.text ?? "") });
      } else if (b.type === "image") {
        const fonte = b.source as { media_type?: string; data?: string } | undefined;
        if (fonte?.data) partes.push({ type: "image_url", image_url: { url: `data:${fonte.media_type ?? "image/jpeg"};base64,${fonte.data}` } });
      }
    }
    if (partes.length) saida.push({ role: "user", content: partes });
  }
  return saida;
}

export interface FerramentaAnthropic {
  name: string;
  description?: string;
  input_schema: unknown;
}

export function paraFerramentasOpenAI(ferramentas: FerramentaAnthropic[]) {
  return ferramentas.map((f) => ({ type: "function" as const, function: { name: f.name, description: f.description, parameters: f.input_schema as Record<string, unknown> } }));
}

export type MotivoDeParada = "end_turn" | "tool_use" | "max_tokens" | "refusal";

export interface RespostaOpenAI {
  choices: { finish_reason: string | null; message: { content: string | null; refusal?: string | null; tool_calls?: { id: string; type: string; function?: { name: string; arguments: string } }[] } }[];
}

/** Resposta da OpenAI → blocos no formato guardado (text e tool_use) e motivo de parada. */
export function deRespostaOpenAI(resposta: RespostaOpenAI): { content: Bloco[]; parada: MotivoDeParada } {
  const escolha = resposta.choices[0];
  if (!escolha) return { content: [], parada: "refusal" };
  const { message, finish_reason } = escolha;
  const content: Bloco[] = [];
  if (message.content?.trim()) content.push({ type: "text", text: message.content });
  for (const c of message.tool_calls ?? []) {
    if (c.type !== "function" || !c.function) continue;
    let input: unknown = {};
    try {
      input = JSON.parse(c.function.arguments || "{}");
    } catch {
      input = {}; // a ferramenta valida e devolve erro ao modelo
    }
    content.push({ type: "tool_use", id: c.id, name: c.function.name, input });
  }
  let parada: MotivoDeParada = "end_turn";
  if (message.refusal || finish_reason === "content_filter") parada = "refusal";
  else if (finish_reason === "length") parada = "max_tokens";
  else if (content.some((b) => b.type === "tool_use")) parada = "tool_use";
  return { content, parada };
}
