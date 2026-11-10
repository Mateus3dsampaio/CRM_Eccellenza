/**
 * Nome do vendedor na frente da mensagem que o cliente lê no WhatsApp (decisão do Mateus, 10/11/2026).
 * Só mensagem escrita por humano (consultor ou admin). Bot, sistema e modelos da Meta nunca levam nome.
 * O texto gravado no banco continua SEM o nome; o nome só entra no que vai para a Meta e no chat do simulador.
 */

const TAMANHO_MAXIMO = 40;

/** Tira o que quebraria o negrito do WhatsApp (* _ ~ `), quebras de linha e espaços repetidos. */
export function limparNomeParaCliente(nome: string | null | undefined): string {
  return (nome ?? "").replace(/[*_~`\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, TAMANHO_MAXIMO).trim();
}

/** Nome para o cliente: o campo preenchido; senão o primeiro nome do cadastro. */
export function nomeParaCliente(usuario: { nome: string; nomeCliente?: string | null }): string {
  return limparNomeParaCliente(usuario.nomeCliente) || limparNomeParaCliente(usuario.nome.trim().split(/\s+/)[0]);
}

/** `*Ana:*` + quebra de linha + texto. Sem texto (arquivo sem legenda) ou sem nome, devolve o texto como veio. */
export function textoComNome(texto: string | null | undefined, nome: string | null | undefined): string {
  const t = texto?.trim() ?? "";
  const n = limparNomeParaCliente(nome);
  if (!t || !n) return t;
  return `*${n}:*\n${t}`;
}
