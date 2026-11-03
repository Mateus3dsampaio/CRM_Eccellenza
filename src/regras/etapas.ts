// Colunas do kanban (KAN-01). Nomes finais ainda PENDENTES de confirmação do Mateus.
export const ETAPAS = [
  { codigo: "novo", nome: "Novo / bot atendendo" },
  { codigo: "pronto", nome: "Pronto para o consultor" },
  { codigo: "visita", nome: "Visita agendada" },
  { codigo: "orcamento", nome: "Orçamento apresentado" },
  { codigo: "negociacao", nome: "Negociação" },
  { codigo: "fechado", nome: "Fechado" },
  { codigo: "perdido", nome: "Perdido" },
  { codigo: "sem_resposta", nome: "Sem resposta" },
] as const;

export type CodigoEtapa = (typeof ETAPAS)[number]["codigo"];

export const CODIGOS_ETAPA = ETAPAS.map((e) => e.codigo) as CodigoEtapa[];

export function nomeEtapa(codigo: string): string {
  return ETAPAS.find((e) => e.codigo === codigo)?.nome ?? codigo;
}

export function etapaValida(codigo: string): codigo is CodigoEtapa {
  return (CODIGOS_ETAPA as string[]).includes(codigo);
}

/** Colunas que têm o botão "Limpar coluna" (LIMP-02). */
export const ETAPAS_LIMPAVEIS: CodigoEtapa[] = ["sem_resposta", "perdido"];

/** Etapas em que a retomada não se aplica. */
export const ETAPAS_ENCERRADAS: CodigoEtapa[] = ["fechado", "perdido", "sem_resposta"];

/** Etapas do funil (MET-02), na ordem. */
export const ETAPAS_FUNIL: CodigoEtapa[] = ["novo", "pronto", "visita", "orcamento", "fechado"];

// Etiquetas (KAN-04).
export const ETIQUETAS = [
  { codigo: "outra_cidade", nome: "Outra cidade" },
  { codigo: "parceiro", nome: "Arquiteto/parceiro" },
  { codigo: "pos_venda", nome: "Pós-venda" },
  { codigo: "ja_atendido", nome: "Já atendido" },
  { codigo: "retomada", nome: "Retomada enviada" },
  { codigo: "nao_receber", nome: "Pediu para parar" },
] as const;

export type CodigoEtiqueta = (typeof ETIQUETAS)[number]["codigo"];

export function etiquetaValida(codigo: string): codigo is CodigoEtiqueta {
  return ETIQUETAS.some((e) => e.codigo === codigo);
}

export function nomeEtiqueta(codigo: string): string {
  return ETIQUETAS.find((e) => e.codigo === codigo)?.nome ?? codigo;
}

export const CLASSIFICACOES = {
  qualificado: "Qualificado",
  curioso: "Curioso",
  outra_cidade: "Outra cidade",
  parceiro: "Arquiteto/designer/construtora",
  pos_venda: "Cliente antigo/pós-venda",
  ja_atendido: "Já atendido",
} as const;

export type Classificacao = keyof typeof CLASSIFICACOES;

export const CODIGOS_CLASSIFICACAO = Object.keys(CLASSIFICACOES) as Classificacao[];

/** Etiqueta aplicada automaticamente por classificação. */
export const ETIQUETA_DA_CLASSIFICACAO: Partial<Record<Classificacao, CodigoEtiqueta>> = {
  outra_cidade: "outra_cidade",
  parceiro: "parceiro",
  pos_venda: "pos_venda",
  ja_atendido: "ja_atendido",
};

/** Cidades atendidas (instrução 14, Dados da loja). */
export const CIDADES_ATENDIDAS = ["Juazeiro do Norte", "Crato", "Barbalha"];
