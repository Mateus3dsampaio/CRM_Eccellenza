import { DIA } from "./tempo";

export const DIAS_ARQUIVADO_ATE_EXCLUIR = 30; // decisão do Mateus (31/10/2026)

/** Cliente que fechou projeto: os dados ficam no máximo 180 dias depois do fechamento (política de privacidade, decisão do Mateus 04/11/2026). */
export const DIAS_FECHADO_ATE_EXCLUIR = 180;

export function deveExcluirFechado(fechadoEm: Date | null, agora: Date): boolean {
  if (!fechadoEm) return false;
  return agora.getTime() - fechadoEm.getTime() >= DIAS_FECHADO_ATE_EXCLUIR * DIA;
}

export function deveExcluirArquivado(arquivadoEm: Date | null, agora: Date): boolean {
  if (!arquivadoEm) return false;
  return agora.getTime() - arquivadoEm.getTime() >= DIAS_ARQUIVADO_ATE_EXCLUIR * DIA;
}
