import { DIA, chaveDia, inicioDaSemanaLocal, inicioDoDiaLocal, inicioDoMesLocal, lerChaveDia } from "./tempo";

// Período do Painel: atalhos ou datas livres. A comparação é sempre com o período anterior, do mesmo tamanho.
export const LIMITE_DIAS_PAINEL = 366;

export const ATALHOS_PAINEL = [
  { codigo: "hoje", nome: "Hoje" },
  { codigo: "7d", nome: "7 dias" },
  { codigo: "30d", nome: "30 dias" },
  { codigo: "semana", nome: "Esta semana" },
  { codigo: "mes", nome: "Este mês" },
] as const;

export type AtalhoPainel = (typeof ATALHOS_PAINEL)[number]["codigo"];

export function atalhoValido(codigo: string | null): codigo is AtalhoPainel {
  return ATALHOS_PAINEL.some((a) => a.codigo === codigo);
}

/** Datas (AAAA-MM-DD) de cada atalho, sempre terminando hoje. */
export function datasDosAtalhos(agora: Date): Record<AtalhoPainel, { de: string; ate: string }> {
  const hoje = inicioDoDiaLocal(agora);
  const ate = chaveDia(hoje);
  const voltar = (dias: number) => chaveDia(new Date(hoje.getTime() - dias * DIA));
  return {
    hoje: { de: ate, ate },
    "7d": { de: voltar(6), ate },
    "30d": { de: voltar(29), ate },
    semana: { de: chaveDia(inicioDaSemanaLocal(agora)), ate },
    mes: { de: chaveDia(inicioDoMesLocal(agora)), ate },
  };
}

export interface PeriodoPainel {
  de: string;
  ate: string;
  /** Primeiro instante do período e o primeiro instante depois dele. */
  inicio: Date;
  fim: Date;
  /** Período anterior, do mesmo tamanho, logo antes do atual. */
  anteriorInicio: Date;
  dias: number;
}

export function resolverPeriodoPainel(entrada: { atalho?: string | null; de?: string | null; ate?: string | null }, agora: Date): PeriodoPainel {
  const atalhos = datasDosAtalhos(agora);
  const base = entrada.de && entrada.ate ? { de: entrada.de, ate: entrada.ate } : atalhos[atalhoValido(entrada.atalho ?? null) ? (entrada.atalho as AtalhoPainel) : "semana"];
  const de = lerChaveDia(base.de);
  const ate = lerChaveDia(base.ate);
  if (!de || !ate) throw new Error("Informe as datas inicial e final.");
  if (de.getTime() > ate.getTime()) throw new Error("A data inicial não pode ser depois da final.");
  if (ate.getTime() > inicioDoDiaLocal(agora).getTime()) throw new Error("A data final não pode ser no futuro.");
  const dias = Math.round((ate.getTime() - de.getTime()) / DIA) + 1;
  if (dias > LIMITE_DIAS_PAINEL) throw new Error(`O período pode ter no máximo ${LIMITE_DIAS_PAINEL} dias.`);
  return { de: base.de, ate: base.ate, inicio: de, fim: new Date(ate.getTime() + DIA), anteriorInicio: new Date(de.getTime() - dias * DIA), dias };
}
