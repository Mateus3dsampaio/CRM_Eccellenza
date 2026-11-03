// Regra de senha (decisão do Mateus, 03/11/2026): mínimo 6 caracteres, com letra, número e pelo menos uma maiúscula.
// Valor baixo de propósito: os dados são só contatos da loja. O login já tem limite de tentativas.
export const SENHA_MINIMA = 6;

export const TEXTO_REGRA_SENHA = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres, com letras, números e pelo menos uma letra maiúscula.`;

/** Devolve o motivo da recusa em português, ou null se a senha serve. */
export function problemaNaSenha(senha: string): string | null {
  if (senha.length < SENHA_MINIMA) return TEXTO_REGRA_SENHA;
  if (!/\p{Lu}/u.test(senha) || !/\p{L}/u.test(senha) || !/\d/.test(senha)) return TEXTO_REGRA_SENHA;
  return null;
}
