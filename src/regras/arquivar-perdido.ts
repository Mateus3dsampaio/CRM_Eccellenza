// Perdido arquiva sozinho (tarefa 42, decisões do Mateus 16/11/2026): card que uma regra automática moveu para Perdido
// vai para o arquivo em poucos dias; card que uma pessoa moveu (preço, concorrente, desistiu...) espera bem mais.
// O arquivo continua excluindo de vez depois de `DIAS_ARQUIVADO_ATE_EXCLUIR` (regras/limpeza.ts). Só regra, sem banco.
import { DIA } from "./tempo";

export interface RegrasArquivarPerdido {
  ligado: boolean;
  /** Dias em Perdido quando quem moveu foi o sistema (sem resposta, outra cidade, curioso / sem perfil). */
  diasAutomatico: number;
  /** Arquiva também o Perdido marcado por uma pessoa? */
  vendedorLigado: boolean;
  /** Dias em Perdido quando quem moveu foi uma pessoa. */
  diasVendedor: number;
}

/** Desligado de fábrica; 7 e 60 dias são decisão do Mateus (16/11/2026). */
export const REGRAS_ARQUIVAR_PADRAO: RegrasArquivarPerdido = { ligado: false, diasAutomatico: 7, vendedorLigado: true, diasVendedor: 60 };

export function completarRegrasArquivar(r: Partial<RegrasArquivarPerdido>): RegrasArquivarPerdido {
  return { ...REGRAS_ARQUIVAR_PADRAO, ...r };
}

export function validarRegrasArquivar(r: RegrasArquivarPerdido): string | null {
  if (typeof r.ligado !== "boolean" || typeof r.vendedorLigado !== "boolean") return "Opção inválida.";
  if (!Number.isInteger(r.diasAutomatico) || r.diasAutomatico < 1 || r.diasAutomatico > 365) return "Perdido automático: de 1 a 365 dias.";
  if (!Number.isInteger(r.diasVendedor) || r.diasVendedor < 1 || r.diasVendedor > 365) return "Perdido marcado pelo vendedor: de 1 a 365 dias.";
  return null;
}

/** Quem moveu o card para Perdido: o sistema (rotina automática) ou uma pessoa (o bot não move para Perdido). */
export function perdidoAutomatico(autorDaMudanca: string | null | undefined): boolean {
  return autorDaMudanca === "sistema";
}

export interface EstadoPerdido {
  etapa: string;
  arquivadoEm: Date | null;
  /** Última entrada em Perdido; em dado antigo sem esse registro, a última alteração do lead. */
  perdidoEm: Date | null;
  autorDaMudanca: string | null;
}

/** Quantos dias o card ficou em Perdido, se já é hora de arquivar; senão null. */
export function diasParaArquivar(lead: EstadoPerdido, r: RegrasArquivarPerdido, agora: Date): number | null {
  if (!r.ligado || lead.arquivadoEm || lead.etapa !== "perdido" || !lead.perdidoEm) return null;
  const automatico = perdidoAutomatico(lead.autorDaMudanca);
  if (!automatico && !r.vendedorLigado) return null;
  const dias = automatico ? r.diasAutomatico : r.diasVendedor;
  return agora.getTime() - lead.perdidoEm.getTime() >= dias * DIA ? dias : null;
}
