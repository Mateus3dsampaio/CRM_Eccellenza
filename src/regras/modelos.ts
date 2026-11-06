// Modelos de mensagem (MSG-02). Textos aprovados pelo Mateus em 05/11/2026 (com o aviso "Responda PARAR").
// Na Meta o modelo precisa ter o MESMO nome (código) e o MESMO texto, sem variáveis, em pt_BR.
export interface Modelo {
  codigo: string;
  nome: string;
  texto: string;
  /** Botões de resposta rápida (cadastrados na Meta junto com o modelo; o envio não leva nada a mais). */
  botoes?: readonly string[];
}

export const BOTAO_CONTINUAR = "Quero continuar";
/** Tocar neste botão vale como PARAR (regras/optout.ts). */
export const BOTAO_SEM_INTERESSE = "Não tenho interesse";

export const MODELOS: readonly Modelo[] = [
  {
    codigo: "retomada",
    nome: "Retomada de atendimento",
    texto:
      "Oi! Passando para saber se você ainda tem interesse no seu projeto de móveis planejados. Se quiser, é só responder por aqui que seguimos com o atendimento. 😊 Responda PARAR para não receber mais mensagens.",
  },
  {
    codigo: "primeiro_contato",
    nome: "Primeiro contato",
    texto: "Olá! Aqui é da Eccellenza, loja de móveis planejados Italínea em Juazeiro do Norte. Podemos conversar sobre o seu projeto? Responda PARAR para não receber mais mensagens.",
  },
  {
    codigo: "lembrete_visita",
    nome: "Lembrete de visita",
    texto: "Olá! Passando para lembrar da sua visita à Eccellenza. Se precisar remarcar, é só responder por aqui. Responda PARAR para não receber mais mensagens.",
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
