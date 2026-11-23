import { acoesDoCard, type CodigoAcao, type CorAcao, type LeadParaAcao } from "@/regras/acao-card";
import type { TipoDecisao } from "@/regras/decisao";
import type { CodigoEtapa } from "@/regras/etapas";
import { PRAZOS_ESPERA_PADRAO } from "@/regras/espera";
import { situacaoDaJanela, type FaixaJanela } from "@/regras/janela24h";
import { DIA, dataLocal, formatarHorarioCard, formatarVisitaCurta, partesLocais, somarDias } from "@/regras/tempo";
import { textoLimpo } from "./texto";

/**
 * Dados inventados da cena do login (tarefa 46). A página é pública: só nomes, cidades e falas fictícios, sem R$ e
 * sem número da loja. O que o card mostra (faixa, anel da janela de 24 h, hora, datas) sai das MESMAS regras do
 * kanban de verdade, a partir de hoje: se uma regra mudar, o login muda junto e as datas nunca ficam velhas.
 */

export interface Faixa {
  codigo: CodigoAcao;
  cor: CorAcao;
  texto: string;
}

export interface DadosCard {
  nome: string;
  /** Índice da cor do avatar (`--color-avatar-N`). */
  cor: number;
  hora: string;
  faixa: Faixa | null;
  previa: string;
  cidade: string;
  ambientes: string[];
  /** Anel da janela de 24 h; nulo em Fechado e Perdido (como `kanban/relogio-janela.tsx`). */
  anel: { faixa: FaixaJanela; fracao: number } | null;
  consultor: string | null;
  modo: "bot" | "humano";
}

/** Situação de um lead inventado, descrita como no CRM. */
export interface Situacao {
  etapa: CodigoEtapa;
  modo: "bot" | "humano";
  consultor?: string;
  /** Cliente esperando resposta há N minutos. */
  esperandoMin?: number;
  /** Data vencida esperando decisão. */
  decisao?: TipoDecisao;
  /** Compromisso marcado na agenda, daqui a N dias. */
  compromisso?: { tipo: "Medição" | "Apresentação"; dias: number; hora: number };
  /** Próximo contato marcado daqui a N dias. */
  retornoDias?: number;
  /** Última mensagem do cliente há N minutos. */
  msgHaMin: number;
}

const MINUTO = 60_000;
const ETAPAS_SEM_RELOGIO: CodigoEtapa[] = ["fechado", "perdido"];

/** Dia útil daqui a N dias, na hora pedida (horário de Fortaleza). Domingo passa para segunda. */
function emDias(agora: Date, dias: number, hora: number): Date {
  let d = somarDias(agora, dias);
  if (partesLocais(d).diaSemana === 0) d = somarDias(d, 1);
  const p = partesLocais(d);
  return dataLocal(p.ano, p.mes, p.dia, hora);
}

/** A faixa de ação do card, calculada por `acoesDoCard` (a mesma regra do kanban). */
export function faixaDaSituacao(s: Situacao, agora: Date): Faixa | null {
  const visitaEm = s.compromisso ? emDias(agora, s.compromisso.dias, s.compromisso.hora) : null;
  const lead: LeadParaAcao = {
    etapa: s.etapa,
    modo: s.modo,
    consultor: s.consultor ? { nome: s.consultor } : null,
    esperandoDesde: s.esperandoMin != null ? new Date(agora.getTime() - s.esperandoMin * MINUTO) : null,
    ultimaMsgClienteEm: new Date(agora.getTime() - s.msgHaMin * MINUTO),
    erroBot: null,
    decisao: s.decisao ? { tipo: s.decisao, venceuEm: new Date(agora.getTime() - DIA) } : null,
    semData: false,
    proximoContatoEm: s.retornoDias != null ? emDias(agora, s.retornoDias, 10) : null,
    lembreteNota: null,
    visita: visitaEm && s.compromisso ? `${s.compromisso.tipo} ${formatarVisitaCurta(visitaEm)}` : null,
    visitaEm,
  };
  // "Negociação exige próximo contato" vem ligado de fábrica (Configurações > Vendas).
  const acao = acoesDoCard(lead, { agora, prazos: PRAZOS_ESPERA_PADRAO, retornoObrigatorio: (e) => e === "negociacao" })[0];
  return acao ? { codigo: acao.codigo, cor: acao.cor, texto: acao.texto } : null;
}

export interface CardFicticio {
  nome: string;
  cor: number;
  previa: string;
  cidade: string;
  ambientes: string[];
  situacao: Situacao;
}

export function dadosDoCard(c: CardFicticio, agora: Date): DadosCard {
  const s = c.situacao;
  const ultimaMsg = new Date(agora.getTime() - s.msgHaMin * MINUTO);
  const janela = situacaoDaJanela(ultimaMsg, agora);
  return {
    nome: c.nome,
    cor: c.cor,
    hora: formatarHorarioCard(ultimaMsg, agora),
    faixa: faixaDaSituacao(s, agora),
    previa: c.previa,
    cidade: c.cidade,
    ambientes: c.ambientes,
    anel: ETAPAS_SEM_RELOGIO.includes(s.etapa) ? null : { faixa: janela.faixa, fracao: janela.fracao },
    consultor: s.consultor ?? null,
    modo: s.modo,
  };
}

/** O consultor que aparece na história (o cursor com o nome dele e as iniciais no card). */
export const CONSULTOR = { nome: "Rafael Souza", curto: "Rafael" };

/** Os passos do cliente da história, coluna por coluna. */
export const PASSOS_DO_CLIENTE: Record<"ia" | "responder" | "medicao" | "apresentacao" | "negociacao", Situacao> = {
  ia: { etapa: "novo", modo: "bot", msgHaMin: 0 },
  responder: { etapa: "qualificacao", modo: "humano", consultor: CONSULTOR.nome, esperandoMin: 1, msgHaMin: 1 },
  medicao: { etapa: "medicao", modo: "humano", consultor: CONSULTOR.nome, compromisso: { tipo: "Medição", dias: 5, hora: 9 }, msgHaMin: 2 },
  apresentacao: { etapa: "apresentacao", modo: "humano", consultor: CONSULTOR.nome, compromisso: { tipo: "Apresentação", dias: 10, hora: 10 }, msgHaMin: 3 },
  negociacao: { etapa: "negociacao", modo: "humano", consultor: CONSULTOR.nome, msgHaMin: 4 },
};

/** Faixa que o card da história mostra em cada coluna (índice da coluna em `ETAPAS`). */
export function faixaDaColuna(coluna: number, agora: Date): Faixa | null {
  const passo = [PASSOS_DO_CLIENTE.ia, PASSOS_DO_CLIENTE.responder, PASSOS_DO_CLIENTE.medicao, PASSOS_DO_CLIENTE.apresentacao, PASSOS_DO_CLIENTE.negociacao][coluna];
  return passo ? faixaDaSituacao(passo, agora) : null;
}

export interface Cliente {
  nome: string;
  cor: number;
  cidade: string;
  ambientes: string[];
  /** A mensagem com as marcas `[palavra|campo]` do que o assistente extrai. */
  texto: string;
}

/** Clientes inventados que se revezam na história (textos aprovados com o protótipo em 23/11/2026). */
export const CLIENTES: Cliente[] = [
  { nome: "Larissa", cor: 2, cidade: "Crato", ambientes: ["Cozinha", "Closet"], texto: "Oi, aqui é a [Larissa|nome]! Quero orçar uma [cozinha|amb:0] e um [closet|amb:1]. Moro no [Crato|cidade]." },
  { nome: "Bruno", cor: 0, cidade: "Barbalha", ambientes: ["Quarto de casal"], texto: "Boa tarde! Sou o [Bruno|nome], de [Barbalha|cidade]. Queria um guarda-roupa planejado para o [quarto de casal|amb:0]." },
  { nome: "Fernanda", cor: 4, cidade: "Juazeiro do Norte", ambientes: ["Home office", "Sala"], texto: "Olá! Meu nome é [Fernanda|nome], moro em [Juazeiro do Norte|cidade]. Preciso de um [home office|amb:0] e de um painel para a [sala|amb:1]." },
];

/** O card do cliente da história, já no passo pedido. */
export function cardDoCliente(cli: Cliente, situacao: Situacao): CardFicticio {
  return { nome: cli.nome, cor: cli.cor, previa: textoLimpo(cli.texto), cidade: cli.cidade, ambientes: cli.ambientes, situacao };
}

const MS = "Marina Sales", LR = "Leonardo Reis", PA = "Paula Alencar";

/** O resto do quadro, coluna por coluna (mesma ordem de `ETAPAS`). */
export const QUADRO: CardFicticio[][] = [
  [
    { nome: "Diego Araújo", cor: 3, previa: "Vocês fazem closet com porta de vidro?", cidade: "Juazeiro do Norte", ambientes: ["Closet"], situacao: { etapa: "novo", modo: "bot", msgHaMin: 27 } },
    { nome: "Camila Duarte", cor: 1, previa: "Queria ver umas ideias para a cozinha do apartamento novo.", cidade: "Barbalha", ambientes: ["Cozinha"], situacao: { etapa: "novo", modo: "bot", msgHaMin: 46 } },
  ],
  [
    { nome: "Thiago Martins", cor: 0, previa: "Mandei as fotos da parede, a medida está na segunda.", cidade: "Crato", ambientes: ["Cozinha", "Área de serviço"], situacao: { etapa: "qualificacao", modo: "humano", consultor: MS, esperandoMin: 6, msgHaMin: 6 } },
    { nome: "Patrícia Gomes", cor: 5, previa: "Pode ser sábado de manhã? Durante a semana eu trabalho.", cidade: "Juazeiro do Norte", ambientes: ["Dormitório casal"], situacao: { etapa: "qualificacao", modo: "humano", consultor: LR, msgHaMin: 170 } },
    { nome: "Rodrigo Nunes", cor: 2, previa: "Ainda estou decidindo as cores.", cidade: "Missão Velha", ambientes: ["Home office"], situacao: { etapa: "qualificacao", modo: "humano", consultor: PA, esperandoMin: 19, msgHaMin: 19 } },
  ],
  [
    { nome: "Aline Moreira", cor: 4, previa: "Combinado, estarei em casa.", cidade: "Barbalha", ambientes: ["Cozinha"], situacao: { etapa: "medicao", modo: "humano", consultor: MS, compromisso: { tipo: "Medição", dias: 6, hora: 10 }, msgHaMin: 600 } },
    { nome: "Gustavo Ribeiro", cor: 3, previa: "O pedreiro termina o piso semana que vem.", cidade: "Juazeiro do Norte", ambientes: ["Banheiro"], situacao: { etapa: "medicao", modo: "humano", consultor: LR, compromisso: { tipo: "Medição", dias: 2, hora: 15 }, msgHaMin: 900 } },
    { nome: "Renata Melo", cor: 1, previa: "Pode vir à tarde?", cidade: "Crato", ambientes: ["Closet"], situacao: { etapa: "medicao", modo: "humano", consultor: PA, decisao: "medicao", msgHaMin: 1250 } },
  ],
  [
    { nome: "Felipe Cardoso", cor: 0, previa: "Gostei muito do projeto, vou ver com minha esposa.", cidade: "Juazeiro do Norte", ambientes: ["Sala", "Home theater"], situacao: { etapa: "apresentacao", modo: "humano", consultor: LR, compromisso: { tipo: "Apresentação", dias: 3, hora: 19 }, msgHaMin: 400 } },
    { nome: "Bianca Lopes", cor: 2, previa: "Consegue me mandar o 3D do quarto do meu filho?", cidade: "Barbalha", ambientes: ["Quarto infantil"], situacao: { etapa: "apresentacao", modo: "humano", consultor: MS, compromisso: { tipo: "Apresentação", dias: 4, hora: 10 }, msgHaMin: 80 } },
    { nome: "Helena Prado", cor: 5, previa: "Levo meu marido na apresentação.", cidade: "Crato", ambientes: ["Cozinha"], situacao: { etapa: "apresentacao", modo: "humano", consultor: PA, decisao: "apresentacao", msgHaMin: 1300 } },
  ],
  [
    { nome: "Otávio Lins", cor: 1, previa: "Vou conversar com o arquiteto e te retorno.", cidade: "Juazeiro do Norte", ambientes: ["Apartamento inteiro"], situacao: { etapa: "negociacao", modo: "humano", consultor: MS, msgHaMin: 700 } },
    { nome: "Débora Sales", cor: 4, previa: "Dá para dividir em mais vezes?", cidade: "Missão Velha", ambientes: ["Cozinha", "Lavanderia"], situacao: { etapa: "negociacao", modo: "humano", consultor: LR, retornoDias: 2, msgHaMin: 300 } },
    { nome: "Caio Mendes", cor: 3, previa: "Amei! Só quero trocar a cor do tampo.", cidade: "Crato", ambientes: ["Closet"], situacao: { etapa: "negociacao", modo: "humano", consultor: PA, decisao: "negociacao", msgHaMin: 1100 } },
  ],
  [
    { nome: "Ana Beatriz Lima", cor: 0, previa: "Fechado! Me manda o contrato que eu assino.", cidade: "Juazeiro do Norte", ambientes: ["Cozinha"], situacao: { etapa: "fechado", modo: "humano", consultor: MS, msgHaMin: 900 } },
    { nome: "Marcelo Batista", cor: 5, previa: "Obrigado pelo atendimento, ficou lindo.", cidade: "Barbalha", ambientes: ["Dormitório casal"], situacao: { etapa: "fechado", modo: "humano", consultor: LR, msgHaMin: 1400 } },
  ],
  [
    { nome: "Lucas Ferreira", cor: 3, previa: "Achei uma loja mais perto de casa, obrigado.", cidade: "Missão Velha", ambientes: ["Cozinha"], situacao: { etapa: "perdido", modo: "humano", consultor: PA, msgHaMin: 1300 } },
    { nome: "Joana Ribeiro", cor: 1, previa: "Por enquanto vou deixar para o ano que vem.", cidade: "Juazeiro do Norte", ambientes: ["Closet"], situacao: { etapa: "perdido", modo: "humano", consultor: LR, msgHaMin: 1420 } },
  ],
];
