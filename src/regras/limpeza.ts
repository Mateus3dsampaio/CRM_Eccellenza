import { DIA } from "./tempo";

export const DIAS_ARQUIVADO_ATE_EXCLUIR = 30; // decisão do Mateus (31/10/2026)

export function deveExcluirArquivado(arquivadoEm: Date | null, agora: Date): boolean {
  if (!arquivadoEm) return false;
  return agora.getTime() - arquivadoEm.getTime() >= DIAS_ARQUIVADO_ATE_EXCLUIR * DIA;
}
