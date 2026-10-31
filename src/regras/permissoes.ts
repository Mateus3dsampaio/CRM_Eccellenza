// Permissões (USR-02, LIMP-05). Sempre verificadas no servidor.
export type Perfil = "admin" | "consultor";

export type Acao = "excluir_lead" | "arquivar_lead" | "editar_lead" | "ver_metricas" | "gerir_agenda" | "enviar_mensagem";

const PERMISSOES: Record<Perfil, Acao[]> = {
  admin: ["excluir_lead", "arquivar_lead", "editar_lead", "ver_metricas", "gerir_agenda", "enviar_mensagem"],
  consultor: ["arquivar_lead", "editar_lead", "ver_metricas", "gerir_agenda", "enviar_mensagem"],
};

export function pode(perfil: string, acao: Acao): boolean {
  return (PERMISSOES[perfil as Perfil] ?? []).includes(acao);
}
