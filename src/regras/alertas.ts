// Avisos para quem atende (Bloco 1, tarefa 3): textos, título da aba e preferências. Só regra, sem banco.

export type TipoAlerta = "mensagem" | "lead_passado" | "visita_marcada" | "prazo_vermelho" | "retorno" | "decisao_vencida" | "ausencia" | "compromisso_cedo";

export interface AlertaTela {
  id: number;
  tipo: TipoAlerta;
  leadId: string;
  leadNome: string;
  consultorId: string | null;
  consultorNome: string | null;
  texto: string | null;
  /** Aviso de presença (tarefa 35): todos recebem, não só o dono do lead e o admin. */
  paraTodos?: boolean;
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
    case "decisao_vencida":
      // Vai para o dono do lead e para o admin (pedido do Mateus 04/11/2026: avisar os atrasos na hora).
      return { titulo: `Decisão pendente: ${a.leadNome}`, corpo: `${a.texto ?? "Data vencida sem decisão."}${ehDono || !a.consultorNome ? "" : ` Consultor: ${a.consultorNome}.`}` };
    case "ausencia":
      // Para `ausencia`, `leadId` guarda o id do vendedor ausente e `leadNome` o nome dele.
      return { titulo: `${a.leadNome} não ficou online`, corpo: `Tem hoje: ${a.texto ?? "compromissos"}.` };
    case "compromisso_cedo":
      return { titulo: `${a.consultorNome ?? "O vendedor"} não está online`, corpo: `${a.texto ?? "Compromisso cedo"} com ${a.leadNome}.` };
    case "visita_marcada":
      return { titulo: `Visita marcada: ${a.leadNome}`, corpo: ehDono || !a.consultorNome ? (a.texto ?? "") : `${a.texto ?? ""} com ${a.consultorNome}`.trim() };
  }
}

/** Texto de um grupo de avisos do mesmo tipo que chegaram juntos (tarefa 25): um toast em vez de N. */
export function textoDoGrupo(tipo: TipoAlerta, total: number): string {
  const clientes = `${total} clientes`;
  switch (tipo) {
    case "mensagem":
      return `${total} mensagens novas de ${clientes}`;
    case "lead_passado":
      return `${clientes} passados pelo bot aguardam resposta`;
    case "prazo_vermelho":
      return `${clientes} passaram do prazo sem resposta`;
    case "retorno":
      return `${total} retornos para fazer agora`;
    case "decisao_vencida":
      return `${total} decisões pendentes (data vencida)`;
    case "visita_marcada":
      return `${total} visitas marcadas`;
    case "ausencia":
      return `${total} vendedores não ficaram online e têm compromissos hoje`;
    case "compromisso_cedo":
      return `${total} compromissos cedo sem vendedor online`;
  }
}

/**
 * Agrupa avisos que chegaram juntos: tipo com 2 ou mais vira um grupo (um toast só); os demais ficam soltos.
 * Devolve na ordem em que apareceram.
 */
export function agruparAlertas<T extends { tipo: TipoAlerta }>(novos: T[]): ({ grupo: false; alerta: T } | { grupo: true; tipo: TipoAlerta; total: number })[] {
  const porTipo = new Map<TipoAlerta, number>();
  novos.forEach((a) => porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1));
  const jaEmitido = new Set<TipoAlerta>();
  const saida: ({ grupo: false; alerta: T } | { grupo: true; tipo: TipoAlerta; total: number })[] = [];
  for (const a of novos) {
    const total = porTipo.get(a.tipo) ?? 1;
    if (total < 2) saida.push({ grupo: false, alerta: a });
    else if (!jaEmitido.has(a.tipo)) {
      jaEmitido.add(a.tipo);
      saida.push({ grupo: true, tipo: a.tipo, total });
    }
  }
  return saida;
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
