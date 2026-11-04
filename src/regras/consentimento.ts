// Consentimento para mensagens iniciadas pela loja (modelos, fora da janela de 24h).
// A Meta pede que a pessoa tenha aceitado receber mensagens da loja, e escrever para a loja pode não bastar para
// "avisos" (ver docs/colocar-no-ar.md). Esta regra só deixa a decisão num lugar.

/**
 * Decisão do Mateus em 05/11/2026: o cliente que escreveu primeiro conta como consentimento (a revisão jurídica da LGPD segue aberta).
 * true  = sim (mais simples; a retomada continua funcionando para quem conversou com a loja).
 * false = não (só vale o consentimento registrado por uma pessoa; a retomada para de funcionar até haver esse registro).
 */
export const CLIENTE_ESCREVER_VALE_COMO_CONSENTIMENTO = true;

export const ORIGENS_CONSENTIMENTO = [
  { codigo: "formulario", nome: "Autorizou em formulário ou no site" },
  { codigo: "balcao", nome: "Autorizou pessoalmente (loja) ou por telefone" },
  { codigo: "outro", nome: "Outro (explique numa nota da ficha)" },
] as const;

export type OrigemConsentimento = (typeof ORIGENS_CONSENTIMENTO)[number]["codigo"];

export const CODIGOS_ORIGEM_CONSENTIMENTO = ORIGENS_CONSENTIMENTO.map((o) => o.codigo) as [OrigemConsentimento, ...OrigemConsentimento[]];

export function temConsentimento(lead: { consentimentoEm: Date | null; ultimaMsgClienteEm: Date | null }): boolean {
  if (lead.consentimentoEm) return true;
  return CLIENTE_ESCREVER_VALE_COMO_CONSENTIMENTO && lead.ultimaMsgClienteEm !== null;
}
