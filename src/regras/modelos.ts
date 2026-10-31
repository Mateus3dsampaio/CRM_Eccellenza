// Modelos de mensagem "aprovados" (fictícios no simulador, MSG-02).
// PROVISÓRIO: textos propostos pelo Claude, ainda NÃO aprovados pelo Mateus. Não usar com clientes reais.
export const MODELOS = [
  {
    codigo: "retomada",
    nome: "Retomada de atendimento",
    texto:
      "Oi! Passando para saber se você ainda tem interesse no seu projeto de móveis planejados. Se quiser, é só responder por aqui que seguimos com o atendimento. 😊",
  },
  {
    codigo: "primeiro_contato",
    nome: "Primeiro contato",
    texto: "Olá! Aqui é da Eccellenza, loja de móveis planejados Italínea em Juazeiro do Norte. Podemos conversar sobre o seu projeto?",
  },
  {
    codigo: "lembrete_visita",
    nome: "Lembrete de visita",
    texto: "Olá! Passando para lembrar da sua visita à Eccellenza. Se precisar remarcar, é só responder por aqui.",
  },
] as const;

export type CodigoModelo = (typeof MODELOS)[number]["codigo"];

export function buscarModelo(codigo: string) {
  return MODELOS.find((m) => m.codigo === codigo) ?? null;
}
