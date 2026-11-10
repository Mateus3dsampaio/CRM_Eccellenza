import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { gravarConfig, lerConfig } from "./configuracoes";
import { motivosDePerda } from "./vendas";

// Fonte única dos números do Painel que dependem de leads (vendido, perdidos, descartados, conversões da agenda).
// Junta os leads que existem hoje com a cópia anônima dos que foram excluídos (LeadExcluidoMetrica): excluir, arquivar ou
// limpar a coluna Perdido não muda o painel. O Painel e a exportação em HTML leem daqui, então sempre mostram o mesmo.

const CHAVE_ZERADO_EM = "painel_zerado_em";

/** Um lead que chegou a Fechado ou Perdido (ainda existe ou já foi excluído). */
export interface Encerrado {
  etapa: "fechado" | "perdido";
  motivo: string | null;
  concorrente: string | null;
  /** Centavos (só Fechado). */
  valor: number | null;
  quando: Date;
  consultorId: string | null;
  /** Perdido por um motivo "Não é lead": não conta como perdido, conta como descartado. */
  naoELead: boolean;
}

/** Medição e apresentação marcadas de um lead (ainda existe ou já foi excluído). */
export interface CompromissoDoLead {
  consultorId: string | null;
  /** Quando a última medição agendada foi marcada. */
  medicao: Date | null;
  /** Quando a última apresentação agendada foi marcada. */
  apresentacao: Date | null;
  /** O lead fechou (a apresentação virou venda). */
  fechou: boolean;
}

/** Quando o admin zerou o painel pela última vez (nada anterior a isso aparece). */
export async function painelZeradoEm(): Promise<Date | null> {
  const bruto = await lerConfig(CHAVE_ZERADO_EM);
  const data = bruto ? new Date(bruto) : null;
  return data && !Number.isNaN(data.getTime()) ? data : null;
}

/** Zera o painel: apaga os contadores e as cópias de leads excluídos e passa a só mostrar o que vier depois. */
export async function zerarPainel(): Promise<{ zeradoEm: Date; contadores: number; excluidos: number }> {
  const quando = await agora();
  const contadores = await db.eventoMetrica.deleteMany({});
  const excluidos = await db.leadExcluidoMetrica.deleteMany({});
  await gravarConfig(CHAVE_ZERADO_EM, quando.toISOString());
  await marcarMudanca();
  return { zeradoEm: quando, contadores: contadores.count, excluidos: excluidos.count };
}

/** Última vez que o lead entrou em `etapa` (as mudanças vêm de `mudancasEtapa`). */
function ultimaEntrada(mudancas: { para: string; criadoEm: Date }[], etapa: string): Date | null {
  const tempos = mudancas.filter((m) => m.para === etapa).map((m) => m.criadoEm.getTime());
  return tempos.length ? new Date(Math.max(...tempos)) : null;
}

/** Todos os leads que chegaram a Fechado ou Perdido, os de hoje e os já excluídos. Quem está em Perdido sem data de entrada não entra. */
export async function encerradosDoPainel(): Promise<Encerrado[]> {
  const motivos = new Map((await motivosDePerda()).map((m) => [m.codigo, m]));
  const vivos = await db.lead.findMany({
    where: { etapa: { in: ["fechado", "perdido"] } },
    select: { etapa: true, valorFechado: true, motivoPerda: true, concorrente: true, consultorId: true, mudancasEtapa: { where: { para: { in: ["fechado", "perdido"] } }, select: { para: true, criadoEm: true } } },
  });
  const lista: Encerrado[] = [];
  for (const l of vivos) {
    const quando = ultimaEntrada(l.mudancasEtapa, l.etapa);
    if (!quando) continue;
    const etapa = l.etapa as Encerrado["etapa"];
    lista.push({
      etapa,
      motivo: l.motivoPerda,
      concorrente: l.concorrente,
      valor: l.valorFechado,
      quando,
      consultorId: l.consultorId,
      naoELead: etapa === "perdido" && !!motivos.get(l.motivoPerda ?? "")?.naoELead,
    });
  }
  const excluidos = await db.leadExcluidoMetrica.findMany({ where: { encerradoEm: { not: null }, etapa: { in: ["fechado", "perdido"] } } });
  for (const e of excluidos) {
    lista.push({ etapa: e.etapa as Encerrado["etapa"], motivo: e.motivoPerda, concorrente: e.concorrente, valor: e.valorFechado, quando: e.encerradoEm as Date, consultorId: e.consultorId, naoELead: e.naoELead });
  }
  return lista;
}

function agruparCompromissos(visitas: { leadId: string; tipo: string; criadoEm: Date; consultorId: string }[], fechou: (leadId: string) => boolean): CompromissoDoLead[] {
  const porLead = new Map<string, { consultorId: string; consultorEm: Date; medicao: Date | null; apresentacao: Date | null }>();
  for (const v of visitas) {
    const atual = porLead.get(v.leadId) ?? { consultorId: v.consultorId, consultorEm: v.criadoEm, medicao: null, apresentacao: null };
    if (v.criadoEm >= atual.consultorEm) {
      atual.consultorId = v.consultorId;
      atual.consultorEm = v.criadoEm;
    }
    if (v.tipo === "medicao" && (!atual.medicao || v.criadoEm > atual.medicao)) atual.medicao = v.criadoEm;
    if (v.tipo === "apresentacao" && (!atual.apresentacao || v.criadoEm > atual.apresentacao)) atual.apresentacao = v.criadoEm;
    porLead.set(v.leadId, atual);
  }
  return [...porLead].map(([leadId, c]) => ({ consultorId: c.consultorId, medicao: c.medicao, apresentacao: c.apresentacao, fechou: fechou(leadId) }));
}

/** Medições e apresentações marcadas (só as que continuam agendadas), uma linha por lead, dos leads de hoje e dos já excluídos. */
export async function compromissosDoPainel(): Promise<CompromissoDoLead[]> {
  const visitas = await db.visita.findMany({
    where: { status: "agendada", tipo: { in: ["medicao", "apresentacao"] } },
    select: { leadId: true, tipo: true, criadoEm: true, consultorId: true, lead: { select: { etapa: true } } },
  });
  const fechados = new Set(visitas.filter((v) => v.lead.etapa === "fechado").map((v) => v.leadId));
  const lista = agruparCompromissos(visitas, (id) => fechados.has(id));
  const excluidos = await db.leadExcluidoMetrica.findMany({ where: { OR: [{ medicaoMarcadaEm: { not: null } }, { apresentacaoMarcadaEm: { not: null } }] } });
  for (const e of excluidos) lista.push({ consultorId: e.consultorId, medicao: e.medicaoMarcadaEm, apresentacao: e.apresentacaoMarcadaEm, fechou: e.etapa === "fechado" });
  return lista;
}

/**
 * Guarda no painel o que um lead vale antes de ele ser excluído (Fechado, Perdido, medição e apresentação marcadas).
 * Só números e códigos: nome, telefone e conversa não vão. Devolve o id da cópia (para desfazer se a exclusão falhar), ou null se não havia nada a guardar.
 */
export async function preservarLeadNoPainel(leadId: string): Promise<string | null> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      etapa: true,
      consultorId: true,
      motivoPerda: true,
      concorrente: true,
      valorFechado: true,
      mudancasEtapa: { where: { para: { in: ["fechado", "perdido"] } }, select: { para: true, criadoEm: true } },
      visitas: { where: { status: "agendada", tipo: { in: ["medicao", "apresentacao"] } }, select: { leadId: true, tipo: true, criadoEm: true, consultorId: true } },
    },
  });
  if (!lead) return null;
  const encerrado = lead.etapa === "fechado" || lead.etapa === "perdido";
  const encerradoEm = encerrado ? ultimaEntrada(lead.mudancasEtapa, lead.etapa) : null;
  const compromisso = agruparCompromissos(lead.visitas.map((v) => ({ ...v, leadId })), () => false)[0];
  if (!encerradoEm && !compromisso) return null;
  const naoELead = lead.etapa === "perdido" && !!(await motivosDePerda()).find((m) => m.codigo === lead.motivoPerda)?.naoELead;
  const linha = await db.leadExcluidoMetrica.create({
    data: {
      consultorId: lead.consultorId ?? compromisso?.consultorId ?? null,
      etapa: lead.etapa,
      motivoPerda: lead.etapa === "perdido" ? lead.motivoPerda : null,
      naoELead,
      concorrente: lead.etapa === "perdido" ? lead.concorrente : null,
      valorFechado: lead.etapa === "fechado" ? lead.valorFechado : null,
      encerradoEm,
      medicaoMarcadaEm: compromisso?.medicao ?? null,
      apresentacaoMarcadaEm: compromisso?.apresentacao ?? null,
    },
  });
  return linha.id;
}
