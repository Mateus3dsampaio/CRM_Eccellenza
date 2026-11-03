// Chaves de API guardadas no banco (Configurações > Chaves de API). Regras puras, sem banco.
// A chave é gravada CRIPTOGRAFADA (src/lib/cifra.ts) e nunca volta inteira para a tela.

export const TIPOS_CHAVE = ["texto", "audio"] as const;
export type TipoChave = (typeof TIPOS_CHAVE)[number];

export const ROTULOS_CHAVE: Record<TipoChave, string> = {
  texto: "Chave da API de texto (Claude)",
  audio: "Chave da API de transcrição de áudio (OpenAI/Whisper)",
};

export const VARIAVEL_DA_CHAVE: Record<TipoChave, string> = { texto: "ANTHROPIC_API_KEY", audio: "OPENAI_API_KEY" };

/** Devolve o motivo de a chave não servir, ou null. Só confere o formato; quem valida de verdade é o provedor. */
export function problemaNaChave(chave: string): string | null {
  const c = chave.trim();
  if (c.length < 20) return "A chave parece curta demais. Confira se copiou inteira.";
  if (c.length > 400) return "A chave parece longa demais. Confira se copiou só a chave.";
  if (/\s/.test(c)) return "A chave não pode ter espaço nem quebra de linha.";
  if (!/^[\x21-\x7e]+$/.test(c)) return "A chave tem caracteres estranhos. Copie de novo, direto do painel do provedor.";
  return null;
}

/** "…a1b2": o único pedaço da chave que a tela pode mostrar. */
export function finalDaChave(chave: string): string {
  return chave.slice(-4);
}
