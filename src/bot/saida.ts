// Limpeza do texto do bot antes de chegar ao cliente.
// O modelo às vezes escreve uma anotação interna ("Segunda insistência: oferecer o caminho.") antes da resposta.
// Só remove padrões claramente internos, para não apagar falas normais ("Próximo passo: ...", "Obs: ...").
export const SEM_RESPOSTA = "[SEM RESPOSTA]";

/** Linha que é anotação interna e não fala com o cliente. */
export function linhaInterna(linha: string): boolean {
  const t = linha.trim();
  if (!t) return false;
  if (/^\[[^\]]*\]$/.test(t)) return true; // linha inteira entre colchetes
  if (/^\(?\s*nota interna\b/i.test(t) || /^nota\s*:/i.test(t)) return true;
  if (/<\/?(sistema|cliente)>/i.test(t)) return true;
  if (/\binsist[êe]ncia\s*:/i.test(t) || /^(primeira|segunda|terceira)\s+insist[êe]ncia\b/i.test(t)) return true;
  if (/^[*_(]*\s*instru[çc][ãa]o\s*\d{1,2}\b/i.test(t)) return true; // "Instrução 07: ...", "*Instrução 02 aplicada*"
  return false;
}

export function limparResposta(texto: string): string {
  return texto
    .replaceAll(SEM_RESPOSTA, "")
    .split("\n")
    .filter((linha) => !linhaInterna(linha))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** O modelo escreveu algo, mas o filtro apagou tudo (não era um [SEM RESPOSTA] de propósito). */
export function respostaDescartada(original: string, limpo: string): boolean {
  return !limpo && original.replaceAll(SEM_RESPOSTA, "").trim().length > 0;
}
