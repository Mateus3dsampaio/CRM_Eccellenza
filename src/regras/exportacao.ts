import { DIA, chaveDia, inicioDoDiaLocal, lerChaveDia } from "./tempo";

// Exportação de desempenho do vendedor (Configurações). Regras puras: período, tempo de resposta e CSV.
export const LIMITE_DIAS_EXPORTACAO = 30;

export interface PeriodoExportacao {
  /** Primeiro instante do período (00:00 do dia inicial, Fortaleza). */
  inicio: Date;
  /** Primeiro instante depois do período (00:00 do dia seguinte ao final). */
  fim: Date;
  dias: number;
  deChave: string;
  ateChave: string;
}

/** Confere as datas (AAAA-MM-DD): início antes do fim, sem futuro e no máximo 30 dias contando os dois extremos. */
export function validarPeriodo(deChave: string, ateChave: string, agora: Date): PeriodoExportacao {
  const de = lerChaveDia(deChave);
  const ate = lerChaveDia(ateChave);
  if (!de || !ate) throw new Error("Informe as datas inicial e final.");
  if (de.getTime() > ate.getTime()) throw new Error("A data inicial não pode ser depois da final.");
  if (ate.getTime() > inicioDoDiaLocal(agora).getTime()) throw new Error("A data final não pode ser no futuro.");
  const dias = Math.round((ate.getTime() - de.getTime()) / DIA) + 1;
  if (dias > LIMITE_DIAS_EXPORTACAO) throw new Error(`O período pode ter no máximo ${LIMITE_DIAS_EXPORTACAO} dias.`);
  return { inicio: de, fim: new Date(ate.getTime() + DIA), dias, deChave, ateChave };
}

/** Período padrão: os últimos 30 dias, terminando hoje. */
export function periodoPadrao(agora: Date): { de: string; ate: string } {
  const hoje = inicioDoDiaLocal(agora);
  return { de: chaveDia(new Date(hoje.getTime() - (LIMITE_DIAS_EXPORTACAO - 1) * DIA)), ate: chaveDia(hoje) };
}

/** Segundos → minutos com uma casa (vazio se não houver dado). */
export function emMinutos(segundos: number | null): string {
  return segundos === null ? "" : (segundos / 60).toFixed(1);
}

/** Uma linha de CSV: aspas só quando precisa e proteção contra fórmula se o arquivo for aberto no Excel. */
function celula(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  let texto = String(valor);
  if (/^[=+@-]/.test(texto) && Number.isNaN(Number(texto))) texto = `'${texto}`;
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function montarCsv(cabecalho: string[], linhas: (string | number | boolean | null | undefined)[][]): string {
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(celula).join(",")).join("\r\n") + "\r\n";
}
