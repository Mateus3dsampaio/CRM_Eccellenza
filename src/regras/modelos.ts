import { partesLocais } from "./tempo";

// Modelos de mensagem (MSG-02). Textos criados e aprovados na Meta pelo Mateus em 08/11/2026 (retorno_atendimento: aprovado por ele em 06/11/2026).
// Na Meta o modelo precisa ter o MESMO nome (código), o MESMO texto e os MESMOS botões, em pt_BR.
// Os lembretes têm as variáveis nomeadas {{data}} e {{hora}}, preenchidas com o compromisso marcado na agenda.
export interface Modelo {
  codigo: string;
  nome: string;
  /** Texto exato do modelo na Meta. Nos lembretes leva {{data}} e {{hora}}. */
  texto: string;
  /** Botões de resposta rápida (cadastrados na Meta junto com o modelo; o envio não leva nada a mais). */
  botoes?: readonly string[];
  /** Lembrete de compromisso: data e hora saem do próximo compromisso deste tipo na agenda do lead. */
  compromisso?: "medicao" | "apresentacao";
}

export const BOTAO_CONTINUAR = "Quero continuar";
/** Tocar neste botão vale como PARAR (regras/optout.ts; pontuação e maiúsculas não importam). */
export const BOTAO_SEM_INTERESSE = "Não tenho interesse";

export const MODELOS: readonly Modelo[] = [
  {
    codigo: "retomada",
    nome: "Retomada de atendimento",
    texto: "Oi! Aqui é da Eccellenza. Nossa conversa sobre o seu projeto de móveis planejados ficou parada. Podemos seguir? Responda PARAR para não receber mais mensagens.",
    botoes: ["Quero continuar!", BOTAO_SEM_INTERESSE],
  },
  {
    codigo: "primeiro_contato",
    nome: "Primeiro contato",
    texto:
      "Olá! Aqui é da Eccellenza, loja de móveis planejados Italínea em Juazeiro do Norte. Vimos que você tem interesse em fazer seu projeto. Gostaria de fazer seu orçamento conosco? Responda PARAR para não receber mais mensagens.",
    botoes: ["Sim, tenho interesse!", "Não tenho interesse."],
  },
  {
    codigo: "lembrete_medicao",
    nome: "Lembrete de medição",
    texto: "Olá! Passando para lembrar da medição dos móveis planejados, marcada para {{data}} às {{hora}}. Podemos confirmar? Responda PARAR para não receber mais mensagens.",
    botoes: ["Sim, pode vir", "Preciso remarcar"],
    compromisso: "medicao",
  },
  {
    codigo: "lembrete_apresentacao",
    nome: "Lembrete de apresentação",
    texto:
      "Olá! Estou passando para confirmar a apresentação do seu projeto aqui na Eccellenza, agendada para {{data}} às {{hora}}. Posso confirmar? Responda PARAR para não receber mais mensagens.",
    botoes: ["Ok, pode confirmar!", "Preciso remarcar"],
    compromisso: "apresentacao",
  },
  {
    // Aprovado pelo Mateus em 06/11/2026. Cadastrar na Meta com os dois botões de resposta rápida, mesmo código e mesmo texto.
    codigo: "retorno_atendimento",
    nome: "Retorno de atendimento (loja estava fechada)",
    texto:
      "Olá! Aqui é da Eccellenza Móveis Planejados. Recebemos seu contato fora do nosso horário e agora já podemos continuar o atendimento do seu projeto. Podemos seguir? Responda PARAR para não receber mais mensagens.",
    botoes: [BOTAO_CONTINUAR, BOTAO_SEM_INTERESSE],
  },
];

export type CodigoModelo = string;

export function buscarModelo(codigo: string) {
  return MODELOS.find((m) => m.codigo === codigo) ?? null;
}

/** Modelos que saem sem compromisso marcado (envio automático e mensagem para número novo). */
export const MODELOS_SEM_COMPROMISSO = MODELOS.filter((m) => !m.compromisso);

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Variáveis dos lembretes, no horário da loja. Ex.: { data: "terça, 12/11", hora: "15h" } ou "15h30". */
export function variaveisDoHorario(inicio: Date): { data: string; hora: string } {
  const p = partesLocais(inicio);
  const dd = String(p.dia).padStart(2, "0");
  const mm = String(p.mes).padStart(2, "0");
  return { data: `${DIAS[p.diaSemana]}, ${dd}/${mm}`, hora: `${p.hora}h${p.minuto ? String(p.minuto).padStart(2, "0") : ""}` };
}

/** Próximo compromisso agendado do tipo, que ainda não começou. */
export function proximoCompromisso<T extends { tipo: string; inicio: Date; status: string }>(visitas: readonly T[], tipo: string, agora: Date): T | null {
  return [...visitas].filter((v) => v.tipo === tipo && v.status === "agendada" && v.inicio.getTime() > agora.getTime()).sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0] ?? null;
}

/** Texto do modelo com as variáveis trocadas. */
export function preencherModelo(texto: string, variaveis: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (todo, nome: string) => variaveis[nome] ?? todo);
}

const NOME_DO_COMPROMISSO = { medicao: "medição", apresentacao: "apresentação" } as const;

/** Por que o lembrete não pode sair (sem compromisso futuro na agenda), ou null. */
export function faltaParaLembrete(modelo: Modelo, compromisso: unknown): string | null {
  if (!modelo.compromisso || compromisso) return null;
  return `Não há ${NOME_DO_COMPROMISSO[modelo.compromisso]} marcada na agenda deste cliente. Marque na agenda antes de enviar o lembrete: a data e a hora saem de lá.`;
}
