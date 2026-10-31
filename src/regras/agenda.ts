import { HORA, dataLocal, partesLocais, somarDias } from "./tempo";

// Regras da agenda – PROVISÓRIO (agente/complemento-crm.md, a confirmar com o Mateus):
// horário da loja (seg a sex 8h–18h, sáb 8h–12h), visitas de 1h, UMA visita por horário na loja,
// primeiro horário no próximo dia útil e último 14 dias à frente.
export const DURACAO_VISITA_MS = 1 * HORA;
/** Visitas ao mesmo tempo na loja (complemento: "uma visita por horário"). PROVISÓRIO. */
export const VISITAS_POR_HORARIO = 1;
export const DIAS_A_FRENTE = 14;
export const MAX_OPCOES_BOT = 3;

/** Horas de início possíveis em um dia da semana (0 = domingo). */
export function horasDeInicio(diaSemana: number): number[] {
  if (diaSemana === 0) return [];
  const fim = diaSemana === 6 ? 12 : 18;
  const horas: number[] = [];
  for (let h = 8; h + 1 <= fim; h++) horas.push(h);
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
export function vagasDoDia(dia: Date, consultores: string[]): Vaga[] {
  const p = partesLocais(dia);
  const vagas: Vaga[] = [];
  for (const hora of horasDeInicio(p.diaSemana)) {
    const inicio = dataLocal(p.ano, p.mes, p.dia, hora);
    for (const consultorId of consultores) {
      vagas.push({ consultorId, inicio, fim: new Date(inicio.getTime() + DURACAO_VISITA_MS) });
    }
  }
  return vagas;
}

/** O horário cabe nas regras da loja (dia e hora de início válidos). */
export function horarioDentroDaRegra(inicio: Date): boolean {
  const p = partesLocais(inicio);
  return p.minuto === 0 && horasDeInicio(p.diaSemana).includes(p.hora);
}

/** Janela em que o bot pode marcar: do próximo dia útil até 14 dias à frente. */
export function janelaDeAgendamento(agora: Date): { de: Date; ate: Date } {
  const hoje = partesLocais(agora);
  let dia = somarDias(dataLocal(hoje.ano, hoje.mes, hoje.dia), 1);
  while (horasDeInicio(partesLocais(dia).diaSemana).length === 0) dia = somarDias(dia, 1);
  const p = partesLocais(agora);
  const ate = somarDias(dataLocal(p.ano, p.mes, p.dia), DIAS_A_FRENTE + 1);
  return { de: dia, ate };
}

/** O horário cabe na loja (limite de visitas simultâneas) e o consultor está livre (sem visita nem bloqueio). */
export function vagaLivre(vaga: Vaga, ocupados: Intervalo[]): boolean {
  const visitasNoHorario = ocupados.filter((o) => o.tipo === "visita" && sobrepoe(o, vaga)).length;
  if (visitasNoHorario >= VISITAS_POR_HORARIO) return false;
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
}): Vaga[] {
  const { agora, ocupados, limite = 20 } = params;
  const consultores = params.consultorPreferido && params.consultores.includes(params.consultorPreferido)
    ? [params.consultorPreferido, ...params.consultores.filter((c) => c !== params.consultorPreferido)]
    : params.consultores;
  const { de, ate } = janelaDeAgendamento(agora);
  const resultado: Vaga[] = [];
  for (let dia = de; dia.getTime() < ate.getTime() && resultado.length < limite; dia = somarDias(dia, 1)) {
    const p = partesLocais(dia);
    for (const hora of horasDeInicio(p.diaSemana)) {
      const inicio = dataLocal(p.ano, p.mes, p.dia, hora);
      if (params.aPartirDe && inicio.getTime() < params.aPartirDe.getTime()) continue;
      const fim = new Date(inicio.getTime() + DURACAO_VISITA_MS);
      const consultor = consultores.find((c) => vagaLivre({ consultorId: c, inicio, fim }, ocupados));
      if (consultor) resultado.push({ consultorId: consultor, inicio, fim });
      if (resultado.length >= limite) break;
    }
  }
  return resultado;
}

/**
 * Chave única gravada na visita ativa: com VISITAS_POR_HORARIO = 1, impede no banco duas visitas no mesmo horário
 * (mesmo com dois agendamentos chegando juntos). Se o Mateus liberar mais de uma, a chave passa a incluir o consultor.
 */
export function chaveVaga(consultorId: string, inicio: Date): string {
  return VISITAS_POR_HORARIO === 1 ? inicio.toISOString() : `${consultorId}|${inicio.toISOString()}`;
}

/** Texto da regra para mostrar na tela, sempre igual ao que o código aplica. */
export const DESCRICAO_REGRAS_AGENDA = `seg a sex 8h–18h, sáb 8h–12h, visitas de ${DURACAO_VISITA_MS / HORA}h, ${
  VISITAS_POR_HORARIO === 1 ? "uma visita por horário na loja" : `até ${VISITAS_POR_HORARIO} visitas por horário na loja`
}`;
