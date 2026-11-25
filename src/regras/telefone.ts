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

/** Lead do Instagram ainda não tem telefone (vem vazio): mostra "Sem telefone". */
export const SEM_TELEFONE = "Sem telefone";

export function formatarTelefone(e164: string | null | undefined): string {
  if (!e164) return SEM_TELEFONE;
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

/** Nome que aparece para o lead: o nome corrigido, senão o do perfil do WhatsApp, senão o telefone. */
export function nomeExibicao(lead: { nome: string | null; nomePerfil: string | null; telefone: string | null; igUsuario?: string | null }): string {
  return lead.nome || lead.nomePerfil || (!lead.telefone && lead.igUsuario ? `@${lead.igUsuario}` : formatarTelefone(lead.telefone));
}

/**
 * Brasil: o 9º dígito. Muitos números ainda são conhecidos pelo WhatsApp SEM o 9 (a Meta devolve o "wa_id" nesse formato),
 * enquanto a loja costuma digitar COM o 9. Devolve o número nas duas formas, para achar o mesmo cliente nas duas.
 * Outros países e números que não parecem celular brasileiro voltam como vieram.
 */
export function variantesTelefone(e164: string): string[] {
  const m = /^\+55(\d{2})(9?)([6-9]\d{7})$/.exec(e164);
  if (!m) return [e164];
  const [, ddd, nove, resto] = m;
  const com = `+55${ddd}9${resto}`;
  const sem = `+55${ddd}${resto}`;
  // O número digitado vem primeiro.
  return nove ? [com, sem] : [sem, com];
}
