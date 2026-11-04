// Modelos de mensagem (MSG-02). Textos aprovados pelo Mateus em 05/11/2026 (com o aviso "Responda PARAR").
// Na Meta o modelo precisa ter o MESMO nome (código) e o MESMO texto, sem variáveis, em pt_BR.
export const MODELOS = [
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
] as const;

export type CodigoModelo = (typeof MODELOS)[number]["codigo"];

export function buscarModelo(codigo: string) {
  return MODELOS.find((m) => m.codigo === codigo) ?? null;
}
