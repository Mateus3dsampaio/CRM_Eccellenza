// Fuso da loja: America/Fortaleza (UTC-3, sem horário de verão).
export const FUSO = "America/Fortaleza";
const DESLOCAMENTO_MS = -3 * 60 * 60 * 1000;

export const HORA = 60 * 60 * 1000;
export const DIA = 24 * HORA;

/** Partes da data no horário de Fortaleza. */
export function partesLocais(data: Date) {
  const local = new Date(data.getTime() + DESLOCAMENTO_MS);
  return {
    ano: local.getUTCFullYear(),
    mes: local.getUTCMonth() + 1,
    dia: local.getUTCDate(),
    hora: local.getUTCHours(),
    minuto: local.getUTCMinutes(),
    diaSemana: local.getUTCDay(), // 0 = domingo
  };
}

/** Cria um instante a partir de data e hora locais de Fortaleza. */
export function dataLocal(ano: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  return new Date(Date.UTC(ano, mes - 1, dia, hora, minuto) - DESLOCAMENTO_MS);
}

export function inicioDoDiaLocal(data: Date): Date {
  const p = partesLocais(data);
  return dataLocal(p.ano, p.mes, p.dia);
}

export function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * DIA);
}

/** Segunda-feira 00:00 (Fortaleza) da semana da data. */
export function inicioDaSemanaLocal(data: Date): Date {
  const p = partesLocais(data);
  const voltar = (p.diaSemana + 6) % 7;
  return somarDias(dataLocal(p.ano, p.mes, p.dia), -voltar);
}

export function inicioDoMesLocal(data: Date): Date {
  const p = partesLocais(data);
  return dataLocal(p.ano, p.mes, 1);
}

/** Data local no formato AAAA-MM-DD (para campos de data). */
export function chaveDia(data: Date): string {
  const p = partesLocais(data);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

export function lerChaveDia(chave: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(chave);
  return m ? dataLocal(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "short" });
const fmtDiaLongo = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "2-digit", month: "long" });

export const formatarDataHora = (d: Date) => fmtDataHora.format(d).replace(",", "");
export const formatarData = (d: Date) => fmtData.format(d);
export const formatarHora = (d: Date) => fmtHora.format(d);
export const formatarDiaLongo = (d: Date) => fmtDiaLongo.format(d);
export const formatarDiaSemana = (d: Date) => fmtDiaSemana.format(d).replace(".", "");

/** Ex.: "sáb 08/11 10h" (formato do resumo para o consultor). */
export function formatarVisitaCurta(d: Date): string {
  const p = partesLocais(d);
  const minutos = p.minuto ? String(p.minuto).padStart(2, "0") : "";
  return `${formatarDiaSemana(d)} ${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")} ${p.hora}h${minutos}`;
}

/** Horário da última mensagem no card: hora se for hoje, "ontem" ou a data. */
export function formatarHorarioCard(d: Date, agora: Date): string {
  const hoje = inicioDoDiaLocal(agora).getTime();
  const dia = inicioDoDiaLocal(d).getTime();
  if (dia === hoje) return formatarHora(d);
  if (dia === hoje - DIA) return "ontem";
  const p = partesLocais(d);
  return `${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}`;
}
