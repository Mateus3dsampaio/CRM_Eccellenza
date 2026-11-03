import { dataLocal, partesLocais, somarDias } from "./tempo";

// Regras da agenda: o admin edita em Configurações (chave `agenda`). Sem nada gravado vale o padrão abaixo (PROVISÓRIO).
// O bot não conhece estes números: ele só oferece o que ver_horarios_livres devolver.
const MINUTO = 60 * 1000;

export interface RegrasAgenda {
  /** Índice = dia da semana (0 = domingo). null = loja fechada. Horas inteiras; as visitas começam sempre na hora cheia. */
  horario: ({ abre: number; fecha: number } | null)[];
  duracaoMin: number;
  /** Visitas ao mesmo tempo na loja. */
  visitasPorHorario: number;
  diasAFrente: number;
}

export const REGRAS_AGENDA_PADRAO: RegrasAgenda = {
  horario: [null, ...Array.from({ length: 5 }, () => ({ abre: 8, fecha: 18 })), { abre: 8, fecha: 12 }],
  duracaoMin: 60,
  visitasPorHorario: 1,
  diasAFrente: 14,
};

export const NOMES_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Devolve a mensagem do primeiro problema, ou null se as regras são válidas. */
export function validarRegrasAgenda(r: RegrasAgenda): string | null {
  if (!Array.isArray(r.horario) || r.horario.length !== 7) return "Horário da semana inválido.";
  for (const [dia, h] of r.horario.entries()) {
    if (h === null) continue;
    if (!Number.isInteger(h.abre) || !Number.isInteger(h.fecha) || h.abre < 0 || h.fecha > 24) return `${NOMES_DIAS[dia]}: use horas inteiras entre 0 e 24.`;
    if (h.fecha * 60 - h.abre * 60 < r.duracaoMin) return `${NOMES_DIAS[dia]}: o horário de funcionamento precisa comportar ao menos uma visita.`;
  }
  if (r.horario.every((h) => h === null)) return "Deixe ao menos um dia aberto.";
  if (!Number.isInteger(r.duracaoMin) || r.duracaoMin < 30 || r.duracaoMin > 240) return "A duração da visita deve ficar entre 30 e 240 minutos.";
  if (!Number.isInteger(r.visitasPorHorario) || r.visitasPorHorario < 1 || r.visitasPorHorario > 10) return "Visitas por horário: de 1 a 10.";
  if (!Number.isInteger(r.diasAFrente) || r.diasAFrente < 1 || r.diasAFrente > 90) return "Dias à frente: de 1 a 90.";
  return null;
}

export function duracaoVisitaMs(r: RegrasAgenda = REGRAS_AGENDA_PADRAO): number {
  return r.duracaoMin * MINUTO;
}

/** Horas de início possíveis em um dia da semana (0 = domingo). */
export function horasDeInicio(diaSemana: number, r: RegrasAgenda = REGRAS_AGENDA_PADRAO): number[] {
  const h = r.horario[diaSemana];
  if (!h) return [];
  const horas: number[] = [];
  for (let hora = h.abre; hora * 60 + r.duracaoMin <= h.fecha * 60; hora++) horas.push(hora);
  return horas;
}

export interface Intervalo {
  consultorId: string;
  inicio: Date;
  fim: Date;
  tipo: "visita" | "bloqueio";
}

export interface Vaga {
  consultorId: string;
  inicio: Date;
  fim: Date;
}

export function sobrepoe(a: { inicio: Date; fim: Date }, b: { inicio: Date; fim: Date }): boolean {
  return a.inicio.getTime() < b.fim.getTime() && b.inicio.getTime() < a.fim.getTime();
}

/** Todas as vagas de um dia (horário local), sem olhar ocupação. */
export function vagasDoDia(dia: Date, consultores: string[], r: RegrasAgenda = REGRAS_AGENDA_PADRAO): Vaga[] {
  const p = partesLocais(dia);
  const vagas: Vaga[] = [];
  for (const hora of horasDeInicio(p.diaSemana, r)) {
    const inicio = dataLocal(p.ano, p.mes, p.dia, hora);
    for (const consultorId of consultores) {
      vagas.push({ consultorId, inicio, fim: new Date(inicio.getTime() + duracaoVisitaMs(r)) });
    }
  }
  return vagas;
}

/** O horário cabe nas regras da loja (dia e hora de início válidos). */
export function horarioDentroDaRegra(inicio: Date, r: RegrasAgenda = REGRAS_AGENDA_PADRAO): boolean {
  const p = partesLocais(inicio);
  return p.minuto === 0 && horasDeInicio(p.diaSemana, r).includes(p.hora);
}

/** Janela em que o bot pode marcar: do próximo dia aberto até `diasAFrente` dias à frente. */
export function janelaDeAgendamento(agora: Date, r: RegrasAgenda = REGRAS_AGENDA_PADRAO): { de: Date; ate: Date } {
  const hoje = partesLocais(agora);
  let dia = somarDias(dataLocal(hoje.ano, hoje.mes, hoje.dia), 1);
  while (horasDeInicio(partesLocais(dia).diaSemana, r).length === 0) dia = somarDias(dia, 1);
  const p = partesLocais(agora);
  const ate = somarDias(dataLocal(p.ano, p.mes, p.dia), r.diasAFrente + 1);
  return { de: dia, ate };
}

/** O horário cabe na loja (limite de visitas simultâneas) e o consultor está livre (sem visita nem bloqueio). */
export function vagaLivre(vaga: Vaga, ocupados: Intervalo[], r: RegrasAgenda = REGRAS_AGENDA_PADRAO): boolean {
  const visitasNoHorario = ocupados.filter((o) => o.tipo === "visita" && sobrepoe(o, vaga)).length;
  if (visitasNoHorario >= r.visitasPorHorario) return false;
  return !ocupados.some((o) => o.consultorId === vaga.consultorId && sobrepoe(o, vaga));
}

/**
 * Horários livres para o bot oferecer (AGENDA-02). Ocupados = visitas ativas + bloqueios.
 * Um horário aparece uma vez só, com o primeiro consultor livre (preferindo o consultor do lead).
 */
export function horariosLivres(params: {
  agora: Date;
  consultores: string[];
  ocupados: Intervalo[];
  consultorPreferido?: string | null;
  limite?: number;
  aPartirDe?: Date;
  regras?: RegrasAgenda;
}): Vaga[] {
  const { agora, ocupados, limite = 20 } = params;
  const r = params.regras ?? REGRAS_AGENDA_PADRAO;
  const consultores = params.consultorPreferido && params.consultores.includes(params.consultorPreferido)
    ? [params.consultorPreferido, ...params.consultores.filter((c) => c !== params.consultorPreferido)]
    : params.consultores;
  const { de, ate } = janelaDeAgendamento(agora, r);
  const resultado: Vaga[] = [];
  for (let dia = de; dia.getTime() < ate.getTime() && resultado.length < limite; dia = somarDias(dia, 1)) {
    const p = partesLocais(dia);
    for (const hora of horasDeInicio(p.diaSemana, r)) {
      const inicio = dataLocal(p.ano, p.mes, p.dia, hora);
      if (params.aPartirDe && inicio.getTime() < params.aPartirDe.getTime()) continue;
      const fim = new Date(inicio.getTime() + duracaoVisitaMs(r));
      const consultor = consultores.find((c) => vagaLivre({ consultorId: c, inicio, fim }, ocupados, r));
      if (consultor) resultado.push({ consultorId: consultor, inicio, fim });
      if (resultado.length >= limite) break;
    }
  }
  return resultado;
}

/**
 * Chave única gravada na visita ativa: com uma visita por horário, impede no banco duas visitas no mesmo horário
 * (mesmo com dois agendamentos chegando juntos). Se o Mateus liberar mais de uma, a chave passa a incluir o consultor.
 */
export function chaveVaga(consultorId: string, inicio: Date, r: RegrasAgenda = REGRAS_AGENDA_PADRAO): string {
  return r.visitasPorHorario === 1 ? inicio.toISOString() : `${consultorId}|${inicio.toISOString()}`;
}

/** Texto da regra para mostrar na tela, sempre igual ao que o código aplica. */
export function descreverRegrasAgenda(r: RegrasAgenda): string {
  const faixas = new Map<string, string[]>();
  for (const [dia, h] of r.horario.entries()) {
    if (!h) continue;
    const chave = `${h.abre}h–${h.fecha}h`;
    faixas.set(chave, [...(faixas.get(chave) ?? []), NOMES_DIAS[dia].slice(0, 3).toLowerCase()]);
  }
  const horario = [...faixas].map(([faixa, dias]) => `${dias.join(", ")} ${faixa}`).join("; ");
  const duracao = r.duracaoMin % 60 === 0 ? `${r.duracaoMin / 60}h` : `${r.duracaoMin} min`;
  return `${horario}, visitas de ${duracao}, ${r.visitasPorHorario === 1 ? "uma visita por horário na loja" : `até ${r.visitasPorHorario} visitas por horário na loja`}`;
}
