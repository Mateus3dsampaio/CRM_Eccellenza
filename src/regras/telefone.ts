// Telefone no formato E.164 (+DDI DDD número). Validação do MSG-01.
export function normalizarTelefone(entrada: string): string | null {
  const digitos = entrada.replace(/\D/g, "");
  if (!digitos) return null;
  const temDdi = entrada.trim().startsWith("+");
  // Número brasileiro sem DDI (DDD + 8 ou 9 dígitos).
  const completo = !temDdi && (digitos.length === 10 || digitos.length === 11) ? `55${digitos}` : digitos;
  if (completo.startsWith("55")) {
    const resto = completo.slice(2);
    const ddd = Number(resto.slice(0, 2));
    if (resto.length !== 10 && resto.length !== 11) return null;
    if (ddd < 11 || ddd > 99) return null;
    if (resto.length === 11 && resto[2] !== "9") return null;
    return `+${completo}`;
  }
  // Outros países: 8 a 15 dígitos no total.
  if (completo.length < 8 || completo.length > 15) return null;
  return `+${completo}`;
}

export function formatarTelefone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const numero = d.slice(4);
    const meio = numero.length === 9 ? 5 : 4;
    return `+55 (${ddd}) ${numero.slice(0, meio)}-${numero.slice(meio)}`;
  }
  return `+${d}`;
}

/**
 * Regra do simulador: números terminados em 0000 "não têm WhatsApp",
 * para demonstrar o status "falhou" (MSG-03).
 */
export function simularSemWhatsapp(e164: string): boolean {
  return e164.endsWith("0000");
}
