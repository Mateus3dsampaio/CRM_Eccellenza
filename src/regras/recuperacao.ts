// Recuperação de leads: cliente abre a conversa e some. Até 2 mensagens automáticas de texto fixo, só dentro da
// janela de 24h da Meta, e depois o lead vai para Perdido ("Sem resposta (automático)"). Só regra, sem banco.
import { classificacaoDesclassificada } from "./desclassificados";
import { janelaAberta, JANELA_MS } from "./janela24h";
import { HORA, dataLocal, partesLocais } from "./tempo";

const MINUTO = 60 * 1000;

/** Código do motivo de perda que a recuperação grava (cadastrado sozinho em `servicos/vendas.ts`). */
export const MOTIVO_SEM_RESPOSTA_AUTOMATICO = "sem_resposta_automatico";
export const NOME_MOTIVO_SEM_RESPOSTA_AUTOMATICO = "Sem resposta (automático)";

/**
 * Folga, antes do fim da janela de 24h (e do fim do horário permitido), para a 2ª mensagem antecipada: a rotina roda
 * de minuto em minuto, e um intervalo de 1 minuto poderia passar sem ser visto.
 */
export const MARGEM_ANTECIPACAO_MS = 5 * MINUTO;

export type ModoSegunda = "horas" | "dia_seguinte";

export interface RegrasRecuperacao {
  ligado: boolean;
  /** 1ª mensagem: minutos depois da nossa última mensagem sem resposta. */
  primeiraMin: number;
  primeiraTexto: string;
  /** Envia a 2ª mensagem? Desligada: só a 1ª sai e o prazo até Perdido conta a partir dela. */
  segundaLigada: boolean;
  /** 2ª mensagem: "horas" = X horas depois da 1ª; "dia_seguinte" = no dia seguinte (da 1ª) às `segundaHora`. */
  segundaModo: ModoSegunda;
  segundaHoras: number;
  /** "HH:MM", horário de Fortaleza. */
  segundaHora: string;
  segundaTexto: string;
  /** Horário permitido de envio (hora cheia, Fortaleza): de `horarioInicio` até `horarioFim` (exclusive). */
  horarioInicio: number;
  horarioFim: number;
  /** Horas, em relógio corrido, entre a última mensagem enviada (a 2ª, ou a 1ª se a 2ª está desligada) e a ida para Perdido. */
  perdidoHoras: number;
}

export const TEXTO_PRIMEIRA_PADRAO = "Oi, {nome}! Continuo por aqui. Ficou alguma dúvida ou posso te ajudar em mais alguma coisa sobre o seu projeto?";
export const TEXTO_SEGUNDA_PADRAO = "Oi, {nome}! Passando só para não te deixar sem retorno. Se ainda tiver interesse no seu projeto, é só me responder por aqui que a gente continua de onde parou.";

/**
 * Textos aprovados pelo Mateus (10/11/2026). Os números são PROVISÓRIOS (padrões que o Mateus definiu para começar;
 * ele ajusta na tela). Desligado de fábrica.
 */
export const REGRAS_RECUPERACAO_PADRAO: RegrasRecuperacao = {
  ligado: false,
  primeiraMin: 30, // PROVISÓRIO
  primeiraTexto: TEXTO_PRIMEIRA_PADRAO,
  segundaLigada: true,
  segundaModo: "dia_seguinte", // PROVISÓRIO
  segundaHoras: 4, // PROVISÓRIO
  segundaHora: "10:00", // PROVISÓRIO
  segundaTexto: TEXTO_SEGUNDA_PADRAO,
  horarioInicio: 8, // PROVISÓRIO
  horarioFim: 20, // PROVISÓRIO
  perdidoHoras: 5, // PROVISÓRIO
};

export function completarRegrasRecuperacao(r: Partial<RegrasRecuperacao>): RegrasRecuperacao {
  return { ...REGRAS_RECUPERACAO_PADRAO, ...r };
}

const TEXTO_MAXIMO = 1000;

/** Lê "HH:MM" e devolve os minutos desde 0h, ou null se não for um horário. */
export function minutosDoHorario(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm?.trim() ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

export function validarRegrasRecuperacao(r: RegrasRecuperacao): string | null {
  if (typeof r.ligado !== "boolean") return "Opção inválida.";
  if (!Number.isInteger(r.primeiraMin) || r.primeiraMin < 1 || r.primeiraMin > 1380) return "1ª mensagem: de 1 a 1380 minutos.";
  if (typeof r.segundaLigada !== "boolean") return "Opção inválida.";
  if (r.segundaModo !== "horas" && r.segundaModo !== "dia_seguinte") return "Escolha como a 2ª mensagem é marcada.";
  if (!Number.isInteger(r.segundaHoras) || r.segundaHoras < 1 || r.segundaHoras > 23) return "2ª mensagem: de 1 a 23 horas.";
  if (minutosDoHorario(r.segundaHora) === null) return "Horário da 2ª mensagem inválido (use HH:MM).";
  if (!Number.isInteger(r.horarioInicio) || r.horarioInicio < 0 || r.horarioInicio > 23) return "Horário permitido: início de 0 a 23.";
  if (!Number.isInteger(r.horarioFim) || r.horarioFim < 1 || r.horarioFim > 24) return "Horário permitido: fim de 1 a 24.";
  if (r.horarioFim - r.horarioInicio < 1) return "O horário permitido precisa ter pelo menos 1 hora (o fim depois do início).";
  if (!Number.isInteger(r.perdidoHoras) || r.perdidoHoras < 1 || r.perdidoHoras > 72) return "Mover para Perdido: de 1 a 72 horas.";
  for (const [nome, texto] of [["1ª", r.primeiraTexto], ["2ª", r.segundaTexto]] as const) {
    if (typeof texto !== "string" || !texto.trim()) return `Escreva o texto da ${nome} mensagem.`;
    if (texto.length > TEXTO_MAXIMO) return `O texto da ${nome} mensagem pode ter até ${TEXTO_MAXIMO} letras.`;
  }
  return null;
}

/**
 * Texto final. `{nome}` vira o primeiro nome da ficha. Sem nome, "Oi, {nome}!" vira "Oi!": a vírgula antes do
 * marcador some junto com ele.
 */
export function montarTextoRecuperacao(texto: string, nome: string | null | undefined): string {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!primeiro) return texto.replace(/\s*,?\s*\{nome\}/g, "").trim();
  return texto.replace(/\{nome\}/g, primeiro).trim();
}

// ---------------------------------------------------------------- horário permitido

/** O instante cai dentro do horário permitido de envio (de `horarioInicio` até `horarioFim`, exclusive)? */
export function horarioPermitido(quando: Date, r: Pick<RegrasRecuperacao, "horarioInicio" | "horarioFim">): boolean {
  const p = partesLocais(quando);
  const m = p.hora * 60 + p.minuto;
  return m >= r.horarioInicio * 60 && m < r.horarioFim * 60;
}

/** O próprio instante, se permitido; senão o começo do próximo horário permitido (hoje, se ainda não abriu; amanhã, se já fechou). */
export function proximoHorarioPermitido(quando: Date, r: Pick<RegrasRecuperacao, "horarioInicio" | "horarioFim">): Date {
  if (horarioPermitido(quando, r)) return quando;
  const p = partesLocais(quando);
  const m = p.hora * 60 + p.minuto;
  return m < r.horarioInicio * 60 ? dataLocal(p.ano, p.mes, p.dia, r.horarioInicio) : dataLocal(p.ano, p.mes, p.dia + 1, r.horarioInicio);
}

// ---------------------------------------------------------------- decisão

export interface EstadoRecuperacao {
  etapa: string;
  arquivadoEm: Date | null;
  classificacao?: string | null;
  modoAtendimento: string;
  aguardandoHumano: boolean;
  naoReceberEm: Date | null;
  temVisitaFutura: boolean;
  ultimaMsgClienteEm: Date | null;
  ultimaMsgLojaEm: Date | null;
  recuperacaoPrimeiraEm: Date | null;
  recuperacaoSegundaEm: Date | null;
  /** O envio de uma das mensagens falhou: o ciclo para (nada de 2ª mensagem nem de Perdido). */
  recuperacaoFalhou: boolean;
}

export type AcaoRecuperacao = "enviar_primeira" | "enviar_segunda" | "mover_perdido" | null;

/**
 * Quando a 2ª mensagem deve sair, ou null se não cabe. O alvo vem da regra (X horas depois da 1ª, ou no dia
 * seguinte às HH:MM). Fora do horário permitido, espera o próximo horário válido. Se esse horário cair fora da janela
 * de 24h, antecipa para o fim do mesmo dia (último horário permitido ainda dentro da janela, com uma folga); se nem
 * assim couber, não envia.
 */
export function horarioDaSegunda(primeiraEm: Date, ultimaMsgClienteEm: Date, r: RegrasRecuperacao): Date | null {
  let alvo: Date;
  if (r.segundaModo === "horas") {
    alvo = new Date(primeiraEm.getTime() + r.segundaHoras * HORA);
  } else {
    const p = partesLocais(primeiraEm);
    const minutos = minutosDoHorario(r.segundaHora) ?? 10 * 60;
    alvo = dataLocal(p.ano, p.mes, p.dia + 1, Math.floor(minutos / 60), minutos % 60);
  }
  const janelaFecha = ultimaMsgClienteEm.getTime() + JANELA_MS;
  const normal = proximoHorarioPermitido(alvo, r);
  if (normal.getTime() < janelaFecha) return normal;

  // Antecipa para o fim do mesmo dia do alvo.
  const d = partesLocais(alvo);
  const inicioDoDia = dataLocal(d.ano, d.mes, d.dia, r.horarioInicio);
  const fimDoDia = dataLocal(d.ano, d.mes, d.dia, r.horarioFim);
  const limite = new Date(Math.min(fimDoDia.getTime(), janelaFecha) - MARGEM_ANTECIPACAO_MS);
  if (limite.getTime() < inicioDoDia.getTime() || limite.getTime() <= primeiraEm.getTime()) return null;
  return limite;
}

/**
 * O que a rotina faz com um lead agora. Tudo sai dos horários gravados (sem estado extra): quando o cliente responde
 * depois de uma mensagem nossa de recuperação, o que estava pendente deixa de valer sozinho.
 *
 * Nunca dispara se: o cliente pediu para parar, o lead está em Perdido (ou Fechado/arquivado), a conversa foi passada
 * ao consultor (modo humano ou pausado, aguardando humano), ou o lead é pós-venda ou tem visita marcada.
 * Uma vez por lead: com a 1ª mensagem já enviada, o ciclo nunca recomeça.
 *
 * `desclassificadosLigado` (tarefa 40): com a regra dos desclassificados ligada, outra cidade e curioso / sem perfil
 * ficam fora daqui (nem mensagem, nem Perdido por esta regra): quem os tira do quadro é `regras/desclassificados.ts`.
 */
export function avaliarRecuperacao(lead: EstadoRecuperacao, r: RegrasRecuperacao, agora: Date, desclassificadosLigado = false): AcaoRecuperacao {
  if (!r.ligado) return null;
  if (desclassificadosLigado && classificacaoDesclassificada(lead.classificacao)) return null;
  if (lead.arquivadoEm || lead.naoReceberEm) return null;
  if (lead.etapa === "perdido" || lead.etapa === "fechado") return null;
  if (lead.classificacao === "pos_venda" || lead.temVisitaFutura) return null;
  if (lead.modoAtendimento !== "bot" || lead.aguardandoHumano) return null;
  if (lead.recuperacaoFalhou || !lead.ultimaMsgClienteEm) return null;
  const cliente = lead.ultimaMsgClienteEm;

  if (!lead.recuperacaoPrimeiraEm) {
    // A última mensagem da conversa precisa ser nossa: o cliente está devendo resposta.
    if (!lead.ultimaMsgLojaEm || lead.ultimaMsgLojaEm.getTime() <= cliente.getTime()) return null;
    const alvo = lead.ultimaMsgLojaEm.getTime() + r.primeiraMin * MINUTO;
    return agora.getTime() >= alvo && janelaAberta(cliente, agora) && horarioPermitido(agora, r) ? "enviar_primeira" : null;
  }

  if (!lead.recuperacaoSegundaEm && r.segundaLigada) {
    if (cliente.getTime() > lead.recuperacaoPrimeiraEm.getTime()) return null; // respondeu: cancela
    const quando = horarioDaSegunda(lead.recuperacaoPrimeiraEm, cliente, r);
    if (!quando || agora.getTime() < quando.getTime()) return null;
    return janelaAberta(cliente, agora) && horarioPermitido(agora, r) ? "enviar_segunda" : null;
  }

  // As horas até Perdido contam em relógio corrido: mover não é mensagem, não respeita o horário permitido.
  const ultimaEnviada = lead.recuperacaoSegundaEm ?? lead.recuperacaoPrimeiraEm;
  if (cliente.getTime() > ultimaEnviada.getTime()) return null;
  return agora.getTime() - ultimaEnviada.getTime() >= r.perdidoHoras * HORA ? "mover_perdido" : null;
}
