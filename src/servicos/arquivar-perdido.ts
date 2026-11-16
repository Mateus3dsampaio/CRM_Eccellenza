import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { diasParaArquivar, perdidoAutomatico, type RegrasArquivarPerdido } from "@/regras/arquivar-perdido";
import { regrasDeArquivarPerdido } from "./configuracoes";
import { registrarAlteracao } from "./historico";
import { arquivarLeads, TEXTO_RESTAUROU } from "./leads";
import { registrarUmaVez } from "./metricas";

export interface PerdidoVencido {
  id: string;
  consultorId: string | null;
  dias: number;
  /** Foi o sistema que moveu para Perdido (prazo curto)? */
  automatico: boolean;
}

/** Leads em Perdido que já passaram do prazo, com os dias que valeram para cada um. `regras` permite simular (prévia da tela). */
export async function perdidosVencidos(regras: RegrasArquivarPerdido, quando: Date): Promise<PerdidoVencido[]> {
  if (!regras.ligado) return [];
  const leads = await db.lead.findMany({ where: { etapa: "perdido", arquivadoEm: null }, select: { id: true, consultorId: true, atualizadoEm: true, arquivadoEm: true, etapa: true } });
  if (!leads.length) return [];
  const mudancas = await db.mudancaEtapa.findMany({ where: { leadId: { in: leads.map((l) => l.id) }, para: "perdido" }, orderBy: { criadoEm: "asc" }, select: { leadId: true, autor: true, criadoEm: true } });
  // Em ordem de data: a última de cada lead fica valendo.
  const ultima = new Map(mudancas.map((m) => [m.leadId, m]));
  // Card que alguém tirou do arquivo e deixou em Perdido: o prazo recomeça na restauração (senão voltaria ao arquivo no minuto seguinte).
  const restauracoes = await db.alteracao.groupBy({ by: ["leadId"], where: { leadId: { in: leads.map((l) => l.id) }, descricao: TEXTO_RESTAUROU }, _max: { criadoEm: true } });
  const restauradoEm = new Map(restauracoes.map((r) => [r.leadId, r._max.criadoEm]));
  const vencidos: PerdidoVencido[] = [];
  for (const lead of leads) {
    const m = ultima.get(lead.id);
    const entrou = m?.criadoEm ?? lead.atualizadoEm;
    const restaurou = restauradoEm.get(lead.id);
    const perdidoEm = restaurou && restaurou.getTime() > entrou.getTime() ? restaurou : entrou;
    const dias = diasParaArquivar({ etapa: lead.etapa, arquivadoEm: lead.arquivadoEm, perdidoEm, autorDaMudanca: m?.autor ?? null }, regras, quando);
    if (dias !== null) vencidos.push({ id: lead.id, consultorId: lead.consultorId, dias, automatico: perdidoAutomatico(m?.autor) });
  }
  return vencidos;
}

/**
 * Perdido arquiva sozinho (tarefa 42). Roda a cada minuto (`rodarRotinas`). O arquivado segue a regra de sempre:
 * excluído de vez 30 dias depois, e sai do arquivo se o cliente escrever. Devolve quantos foram arquivados.
 */
export async function rodarArquivarPerdidos(): Promise<number> {
  const regras = await regrasDeArquivarPerdido();
  const vencidos = await perdidosVencidos(regras, await agora());
  let total = 0;
  for (const lead of vencidos) {
    if (!(await arquivarLeads([lead.id], "sistema"))) continue;
    await registrarAlteracao(lead.id, "sistema", `Arquivado automaticamente (${lead.dias} dias em Perdido)`);
    await registrarUmaVez(lead.id, "perdido_arquivado", lead.consultorId);
    total++;
  }
  return total;
}
