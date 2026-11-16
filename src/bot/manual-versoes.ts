import { createHash } from "node:crypto";

// Atualização automática do Manual do CRM (tarefa 38, decisão do Mateus 08/11/2026: o Manual só muda junto com o código).
// Guardamos a "impressão digital" (sha256) de TODA versão que o código já teve, inclusive a atual. Assim o sistema sabe se o
// Manual do banco é uma versão antiga do código, que ninguém mexeu (troca sozinho), ou se foi editado na tela (não mexe e avisa).
// Ao mudar manual-inicial.ts: ACRESCENTE a impressão nova no fim da lista e nunca apague as antigas (o teste avisa).
export const VERSOES_DO_MANUAL: readonly string[] = [
  "8c860bdd3731b4e4d667cec347cbe014786c6889cd05d5e157c03ecccdb77c55", // 04/11/2026
  "a16d829e9a7096b22210260daf1730df219bb1a7d50ecb9921bcc549336e0d9a", // 04/11/2026
  "4fadc6e9820c9c365a807b6c8c32ef8146567bb6f32007ca3fb1b92621a5687a", // 04/11/2026
  "1a9b452d5b57c0669a4082a738283a8520446dc9ec0cdf9792b3e0be3012fa7e", // 08/11/2026: seção LOJA FECHADA (registrar_retorno)
  "4ba1e41db546e843120d9b6ab849776ee696d28101c5a633577feed8ce594cd9", // 08/11/2026: Manual aprovado, sem as marcas de provisório
  "2df3c6e74937724c052214baa11ce4188b69434080392d788d4037a0ce8e3cb4", // 08/11/2026: sem citar instruções nem regras de roteiro
  "2d28c83ef2e738843d8214f960171a0a17c3bf379754c52d3ea35acce590ed1a", // 16/11/2026: curioso inclui cliente sem perfil (tarefa 40)
];

/** sha256 do texto sem espaços nas pontas e com quebras de linha do Windows trocadas por \n. */
export function impressaoDoManual(texto: string): string {
  return createHash("sha256").update(texto.replace(/\r\n/g, "\n").trim()).digest("hex");
}

/**
 * - `igual`: o banco tem o texto do código.
 * - `voltou`: o admin usou "Voltar para a anterior" depois da versão do código; respeita a escolha e não troca de novo.
 * - `desatualizado`: o banco tem uma versão antiga do código, sem edição na tela; o sistema troca sozinho.
 * - `editado`: o texto foi mudado na tela; o sistema não mexe e a tela avisa.
 */
export type SituacaoManual = "igual" | "voltou" | "desatualizado" | "editado";

export function situacaoDoManual(banco: { texto: string; anteriorTexto: string | null }, codigo: string): SituacaoManual {
  const doCodigo = impressaoDoManual(codigo);
  const doBanco = impressaoDoManual(banco.texto);
  if (doBanco === doCodigo) return "igual";
  // Texto do banco é de uma versão antiga do código, sem edição: ou o admin voltou de propósito (a do código está como anterior) ou falta atualizar.
  if (VERSOES_DO_MANUAL.includes(doBanco)) return banco.anteriorTexto !== null && impressaoDoManual(banco.anteriorTexto) === doCodigo ? "voltou" : "desatualizado";
  return "editado";
}
