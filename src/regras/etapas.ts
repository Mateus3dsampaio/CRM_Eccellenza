// Colunas do kanban (KAN-01, funil aprovado pelo Mateus em 04/11/2026, tarefa 21). O objetivo é trazer o cliente à loja
// com o projeto pronto. Estes são os nomes de fábrica; o admin pode renomear cada coluna no Kanban (servicos/etapas.ts).
export const ETAPAS = [
  { codigo: "novo", nome: "IA atendendo" },
  { codigo: "pronto", nome: "Aguardando consultor" },
  { codigo: "qualificacao", nome: "Em qualificação" },
  { codigo: "medicao", nome: "Medição agendada" },
  { codigo: "apresentacao", nome: "Apresentação agendada" },
  { codigo: "negociacao", nome: "Negociação" },
  { codigo: "fechado", nome: "Fechado" },
  { codigo: "perdido", nome: "Perdido" },
] as const;

export type CodigoEtapa = (typeof ETAPAS)[number]["codigo"];

export const CODIGOS_ETAPA = ETAPAS.map((e) => e.codigo) as CodigoEtapa[];

export function nomeEtapa(codigo: string): string {
  return ETAPAS.find((e) => e.codigo === codigo)?.nome ?? codigo;
}

export const NOME_ETAPA_MAX = 40;
export type NomesEtapas = Record<CodigoEtapa, string>;

/** Nomes de fábrica de todas as colunas. */
export function nomesPadraoDasEtapas(): NomesEtapas {
  return Object.fromEntries(ETAPAS.map((e) => [e.codigo, e.nome])) as NomesEtapas;
}

/** Texto guardado (JSON `{codigo: nome}`) + nomes de fábrica. Qualquer coisa estranha no guardado é ignorada. */
export function mesclarNomesDasEtapas(bruto: string | null): NomesEtapas {
  const nomes = nomesPadraoDasEtapas();
  try {
    const guardado = bruto ? JSON.parse(bruto) : null;
    if (guardado && typeof guardado === "object") {
      for (const codigo of CODIGOS_ETAPA) {
        const v = validarNomeDaEtapa((guardado as Record<string, unknown>)[codigo]);
        if (v.ok) nomes[codigo] = v.nome;
      }
    }
  } catch {
    // JSON quebrado: valem os nomes de fábrica.
  }
  return nomes;
}

export type NomeDeEtapaValido = { ok: true; nome: string } | { ok: false; erro: string };

/** Nome de coluna: 1 a 40 letras, sem quebra de linha, espaços repetidos viram um. */
export function validarNomeDaEtapa(texto: unknown): NomeDeEtapaValido {
  if (typeof texto !== "string") return { ok: false, erro: "Escreva um nome para a coluna." };
  const nome = texto.replace(/\s+/g, " ").trim();
  if (!nome) return { ok: false, erro: "Escreva um nome para a coluna." };
  if (nome.length > NOME_ETAPA_MAX) return { ok: false, erro: `O nome pode ter no máximo ${NOME_ETAPA_MAX} letras.` };
  if (/[\u0000-\u001f\u007f<>]/.test(nome)) return { ok: false, erro: "O nome tem caracteres que não podem ser usados." };
  return { ok: true, nome };
}

export function etapaValida(codigo: string): codigo is CodigoEtapa {
  return (CODIGOS_ETAPA as string[]).includes(codigo);
}

/** Colunas que têm o botão "Limpar coluna" (LIMP-02). */
export const ETAPAS_LIMPAVEIS: CodigoEtapa[] = ["perdido"];

/**
 * Etapas do funil (MET-02), na ordem. Medição fica fora (é opcional: quem tem planta vai direto à apresentação)
 * e conta como "Em qualificação"; Negociação conta como "Apresentação" (vem depois dela, e quem fecha no dia pula).
 */
export const ETAPAS_FUNIL: CodigoEtapa[] = ["novo", "pronto", "qualificacao", "apresentacao", "fechado"];

/** Etapa do funil em que cada coluna conta. Fora do funil (Perdido): não tem. */
export const POSICAO_NO_FUNIL: Partial<Record<CodigoEtapa, number>> = { novo: 0, pronto: 1, qualificacao: 2, medicao: 2, apresentacao: 3, negociacao: 3, fechado: 4 };

/** Etapas que só recebem o card com o compromisso marcado na agenda (o tipo do compromisso tem o mesmo código). */
export const ETAPAS_COM_AGENDA = ["medicao", "apresentacao"] as const;
export type EtapaComAgenda = (typeof ETAPAS_COM_AGENDA)[number];

export function etapaComAgenda(etapa: string): etapa is EtapaComAgenda {
  return (ETAPAS_COM_AGENDA as readonly string[]).includes(etapa);
}

/** Códigos de antes da tarefa 21 → coluna nova (conversão única dos bancos que já existiam). */
export const ETAPAS_ANTIGAS: Record<string, CodigoEtapa> = { visita: "apresentacao", orcamento: "negociacao", sem_resposta: "perdido" };

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
