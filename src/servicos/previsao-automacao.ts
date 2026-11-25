import { db } from "@/lib/db";
import { previsaoDoCard, previsaoParaJson, type EstadoPrevisao, type PrevisaoCardJson } from "@/regras/previsao-automacao";
import { entradasEmPerdido } from "./arquivar-perdido";
import { regrasDaRedeDeSeguranca, regrasDeArquivarPerdido, regrasDeRecuperacao } from "./configuracoes";
import { idsQuePassaramPorHumano } from "./passou-por-humano";

/**
 * Previsão da automação dos cards das colunas IA atendendo (`novo`) e Perdido (tarefa 48): para cada lead, o próximo
 * passo automático e quando ele acontece. Só admin recebe (a rota `/api/kanban` confere o perfil). Não grava nada.
 * Usa as MESMAS regras e as mesmas consultas das rotinas (`rodarRecuperacao`, `rodarRedeDeSeguranca`,
 * `perdidosVencidos`), em poucas consultas (nunca uma por lead).
 */
export async function previsoesDoKanban(quando: Date): Promise<Record<string, PrevisaoCardJson>> {
  const [recuperacao, rede, arquivar] = await Promise.all([regrasDeRecuperacao(), regrasDaRedeDeSeguranca(), regrasDeArquivarPerdido()]);
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, etapa: { in: ["novo", "perdido"] } },
    include: { visitas: { where: { status: "agendada", inicio: { gt: quando } }, orderBy: { inicio: "asc" }, select: { inicio: true } } },
  });
  if (!leads.length) return {};
  const novos = leads.filter((l) => l.etapa === "novo");
  const perdidos = leads.filter((l) => l.etapa === "perdido");
  const [humanos, entradas] = await Promise.all([idsQuePassaramPorHumano(novos.map((l) => l.id)), entradasEmPerdido(perdidos)]);

  const saida: Record<string, PrevisaoCardJson> = {};
  for (const lead of leads) {
    const entrada = entradas.get(lead.id);
    const estado: EstadoPrevisao = {
      ...lead,
      temVisitaFutura: lead.visitas.length > 0,
      visitaEm: lead.visitas[0]?.inicio ?? null,
      passouPorHumano: humanos.has(lead.id),
      perdidoEm: entrada?.perdidoEm ?? null,
      autorDaMudanca: entrada?.autor ?? null,
    };
    saida[lead.id] = previsaoParaJson(previsaoDoCard(estado, { recuperacao, rede, arquivar }, quando));
  }
  return saida;
}
