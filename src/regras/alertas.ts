// Avisos para quem atende (Bloco 1, tarefa 3): textos, título da aba e preferências. Só regra, sem banco.

export type TipoAlerta = "mensagem" | "lead_passado" | "visita_marcada" | "prazo_vermelho" | "retorno";

export interface AlertaTela {
  id: number;
  tipo: TipoAlerta;
  leadId: string;
  leadNome: string;
  consultorId: string | null;
  consultorNome: string | null;
  texto: string | null;
}

/** Quanto tempo um aviso fica guardado no banco. */
export const DIAS_ALERTA_GUARDADO = 1;

export interface PreferenciasAlertas {
  som: boolean;
  notificacoes: boolean;
}
export const PREFERENCIAS_PADRAO: PreferenciasAlertas = { som: true, notificacoes: true };

/**
 * Título e corpo do aviso, do ponto de vista de quem lê: o dono do lead vê "para você",
 * o admin (que recebe todos) vê o nome do consultor.
 */
export function textoDoAlerta(a: Pick<AlertaTela, "tipo" | "leadNome" | "consultorId" | "consultorNome" | "texto">, usuarioId: string): { titulo: string; corpo: string } {
  const ehDono = a.consultorId !== null && a.consultorId === usuarioId;
  const consultor = a.consultorNome ?? "a fila (sem consultor)";
  switch (a.tipo) {
    case "mensagem":
      return { titulo: `Nova mensagem de ${a.leadNome}`, corpo: a.texto ?? "" };
    case "lead_passado":
      return {
        titulo: ehDono ? `${a.leadNome} foi passado para você` : `${a.leadNome} foi passado para ${consultor}`,
        corpo: "O bot passou o atendimento. O cliente aguarda resposta.",
      };
    case "prazo_vermelho":
      return {
        titulo: `${a.leadNome} passou do prazo sem resposta`,
        corpo: `Espera de ${a.texto ?? "mais que o prazo"}. ${a.consultorNome ? `Consultor: ${a.consultorNome}.` : "Sem consultor: lead na fila."}`,
      };
    case "retorno":
      return { titulo: `Hora de retornar para ${a.leadNome}`, corpo: `Próximo contato marcado para ${a.texto ?? "agora"}.${ehDono || !a.consultorNome ? "" : ` Consultor: ${a.consultorNome}.`}` };
    case "visita_marcada":
      return { titulo: `Visita marcada: ${a.leadNome}`, corpo: ehDono || !a.consultorNome ? (a.texto ?? "") : `${a.texto ?? ""} com ${a.consultorNome}`.trim() };
  }
}

const CONTADOR_NO_INICIO = /^\(\d+\)\s*/;

/** "(3) CRM Eccellenza". Sem ninguém esperando, volta ao título normal. */
export function tituloDaAba(titulo: string, esperando: number): string {
  const base = titulo.replace(CONTADOR_NO_INICIO, "");
  // trim: o navegador tira o espaço do fim do título; sem isso, título vazio dava "(3) " ≠ "(3)" e a aba travava num laço.
  return (esperando > 0 ? `(${esperando}) ${base}` : base).trim();
}

/** Lê as preferências guardadas no navegador; qualquer coisa estranha vira o padrão. */
export function lerPreferencias(bruto: string | null): PreferenciasAlertas {
  try {
    const o = bruto ? JSON.parse(bruto) : null;
    return { som: typeof o?.som === "boolean" ? o.som : PREFERENCIAS_PADRAO.som, notificacoes: typeof o?.notificacoes === "boolean" ? o.notificacoes : PREFERENCIAS_PADRAO.notificacoes };
  } catch {
    return { ...PREFERENCIAS_PADRAO };
  }
}
