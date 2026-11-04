// Classes de cor por código (o Tailwind precisa das classes escritas por extenso).
export const COR_ETAPA: Record<string, string> = {
  novo: "bg-etapa-novo",
  pronto: "bg-etapa-pronto",
  qualificacao: "bg-etapa-qualificacao",
  medicao: "bg-etapa-medicao",
  apresentacao: "bg-etapa-apresentacao",
  negociacao: "bg-etapa-negociacao",
  fechado: "bg-etapa-fechado",
  perdido: "bg-etapa-perdido",
};

export const COR_ETIQUETA: Record<string, string> = {
  outra_cidade: "bg-etiqueta-cidade text-etiqueta-cidade-texto",
  parceiro: "bg-etiqueta-parceiro text-etiqueta-parceiro-texto",
  pos_venda: "bg-etiqueta-posvenda text-etiqueta-posvenda-texto",
  ja_atendido: "bg-etiqueta-atendido text-etiqueta-atendido-texto",
  retomada: "bg-etiqueta-retomada text-etiqueta-retomada-texto",
  nao_receber: "bg-alerta-suave text-alerta",
};

export const COR_AVATAR = ["bg-avatar-0", "bg-avatar-1", "bg-avatar-2", "bg-avatar-3", "bg-avatar-4", "bg-avatar-5"];

export function juntar(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
