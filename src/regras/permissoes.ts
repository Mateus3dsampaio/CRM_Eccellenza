// Permissões (USR-02, LIMP-05). Sempre verificadas no servidor.
export type Perfil = "admin" | "consultor";

export type Acao = "excluir_lead" | "arquivar_lead" | "editar_lead" | "ver_metricas" | "gerir_agenda" | "enviar_mensagem" | "remover_medida" | "configurar" | "apagar_midia";

const PERMISSOES: Record<Perfil, Acao[]> = {
  admin: ["excluir_lead", "arquivar_lead", "editar_lead", "ver_metricas", "gerir_agenda", "enviar_mensagem", "remover_medida", "configurar", "apagar_midia"],
  consultor: ["arquivar_lead", "editar_lead", "gerir_agenda", "enviar_mensagem"],
};

export function pode(perfil: string, acao: Acao): boolean {
  return (PERMISSOES[perfil as Perfil] ?? []).includes(acao);
}

/**
 * Agenda: o consultor vê a de todos, mas só altera a própria; o admin altera todas.
 * Notas e arquivos o consultor pode excluir (editar_lead). Dados de análise (histórico, métricas)
 * não têm ação de exclusão para ninguém, só o lead inteiro, e isso é do admin (excluir_lead).
 */
export function podeEditarAgendaDe(usuario: { id: string; perfil: string }, consultorId: string): boolean {
  return usuario.perfil === "admin" || usuario.id === consultorId;
}
