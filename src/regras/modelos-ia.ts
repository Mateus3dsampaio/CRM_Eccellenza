// Modelos de IA que aparecem para escolha em Configurações > Chaves de API. Regras puras, sem rede.
// A lista real vem da conta de cada empresa (servicos/modelos-ia.ts); aqui ficam o filtro, a ordem,
// a frase de cada família e a lista de reserva usada quando a busca falha.

export interface ModeloIa {
  id: string;
  nome: string;
  descricao: string;
}

/** Modelo do Claude usado quando o admin ainda não escolheu (o que o bot usava antes da escolha existir). */
export const MODELO_CLAUDE_PADRAO = "claude-sonnet-5-5";
/** PROVISÓRIO: nome não testado com o bot real. O Mateus escolhe na lista vinda da conta OpenAI. */
export const MODELO_OPENAI_PADRAO = "gpt-5.5";

const FAMILIAS_CLAUDE: { familia: string; descricao: string }[] = [
  { familia: "sonnet", descricao: "Equilíbrio entre qualidade e custo. Bom para o dia a dia." },
  { familia: "haiku", descricao: "O mais rápido e barato. Pode errar mais em conversas difíceis." },
  { familia: "opus", descricao: "Mais inteligente, mais caro e mais lento." },
  { familia: "fable", descricao: "Topo de linha. O mais caro." },
];

/** Só a geração 5 em diante: o bot manda parâmetros (esforço, reserva automática) que modelos antigos recusam. */
const ID_CLAUDE_ACEITO = /^claude-(fable|opus|sonnet|haiku)-([5-9]|\d{2,})(-\d+)?$/;

/** Reserva quando a lista da Anthropic não chega (sem chave, sem rede). */
export const RESERVA_CLAUDE: { id: string; nome: string }[] = [
  { id: "claude-sonnet-5-5", nome: "Claude Sonnet 5.5" },
  { id: "claude-haiku-5-5", nome: "Claude Haiku 5.5" },
  { id: "claude-opus-5-5", nome: "Claude Opus 5.5" },
  { id: "claude-fable-5-1", nome: "Claude Fable 5.1" },
];

/**
 * Da lista da Anthropic (mais novo primeiro), fica o mais novo de cada família, na ordem
 * Sonnet, Haiku, Opus, Fable. Modelos antigos e desconhecidos ficam de fora.
 */
export function filtrarModelosClaude(lista: { id: string; nome?: string | null }[]): ModeloIa[] {
  const porFamilia = new Map<string, { id: string; nome: string }>();
  for (const m of lista) {
    const achou = ID_CLAUDE_ACEITO.exec(m.id);
    if (!achou || porFamilia.has(achou[1])) continue;
    porFamilia.set(achou[1], { id: m.id, nome: m.nome?.trim() || m.id });
  }
  return FAMILIAS_CLAUDE.flatMap(({ familia, descricao }) => {
    const m = porFamilia.get(familia);
    return m ? [{ ...m, descricao }] : [];
  });
}

/** Família do Claude pelo id (para o bot saber se pode pedir a reserva automática). */
export function familiaClaude(id: string): string | null {
  return ID_CLAUDE_ACEITO.exec(id)?.[1] ?? null;
}

// GPT: a conta da OpenAI lista também áudio, imagem, voz, busca, embeddings e versões datadas. Só os de conversa entram.
const ID_GPT = /^gpt-\d/;
const FORA_GPT = /(audio|realtime|transcribe|tts|image|search|embedding|instruct|moderation|codex|computer|\d{4}-\d{2}-\d{2}|preview)/;
const MAX_GPT = 8;

export function descricaoGpt(id: string): string {
  if (/nano/.test(id)) return "O mais barato e rápido. Pode errar mais em conversas difíceis.";
  if (/mini/.test(id)) return "Mais barato. Bom para o dia a dia.";
  if (/pro/.test(id)) return "Mais caro e mais lento.";
  return "O modelo principal da OpenAI nesta versão.";
}

/** Da lista da OpenAI: só modelos de conversa, sem versão datada, mais novos primeiro, no máximo 8. */
export function filtrarModelosGpt(lista: { id: string; criado?: number | null }[]): ModeloIa[] {
  return lista
    .filter((m) => ID_GPT.test(m.id) && !FORA_GPT.test(m.id))
    .sort((a, b) => (b.criado ?? 0) - (a.criado ?? 0) || a.id.localeCompare(b.id))
    .slice(0, MAX_GPT)
    .map((m) => ({ id: m.id, nome: m.id, descricao: descricaoGpt(m.id) }));
}

/** O modelo salvo sempre aparece na lista, mesmo que a conta não o devolva (para a escolha atual ficar visível). */
export function garantirNaLista(lista: ModeloIa[], id: string, descricao: string): ModeloIa[] {
  return lista.some((m) => m.id === id) ? lista : [{ id, nome: id, descricao }, ...lista];
}

export function problemaNoModelo(modelo: string): string | null {
  return /^[A-Za-z0-9._:-]{2,80}$/.test(modelo.trim()) ? null : "Nome de modelo inválido (use só letras, números, ponto e hífen).";
}
