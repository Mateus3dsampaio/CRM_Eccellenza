import { db } from "@/lib/db";
import { gravarLista, lerLista } from "@/lib/json";
import { apagarMidia } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { ETAPAS_FUNIL, etapaValida, nomeEtapa, nomeEtiqueta, type CodigoEtapa } from "@/regras/etapas";
import { registrarAlteracao } from "./historico";
import { registrarUmaVez } from "./metricas";
import { gerarResumo } from "./resumo";

export async function obterOuCriarLead(telefone: string, nomePerfil?: string | null) {
  const existente = await db.lead.findUnique({ where: { telefone } });
  if (existente) {
    if (nomePerfil && !existente.nomePerfil) {
      return db.lead.update({ where: { id: existente.id }, data: { nomePerfil } });
    }
    return existente;
  }
  const quando = await agora();
  const lead = await db.lead.create({
    data: {
      telefone,
      nomePerfil: nomePerfil ?? null,
      avatarCor: Math.floor(Math.random() * 6),
      criadoEm: quando,
      ordem: -quando.getTime(),
      conversaApi: { create: {} },
    },
  });
  await registrarUmaVez(lead.id, "lead_novo");
  await registrarUmaVez(lead.id, "etapa_novo");
  await registrarAlteracao(lead.id, "sistema", "Lead criado");
  await marcarMudanca();
  return lead;
}

export async function moverEtapa(leadId: string, etapa: CodigoEtapa, autor: string, opcoes: { guardarAnterior?: boolean } = {}) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.etapa === etapa) return lead;
  const quando = await agora();
  const atualizado = await db.lead.update({
    where: { id: leadId },
    data: {
      etapa,
      ordem: -quando.getTime(),
      etapaAnterior: opcoes.guardarAnterior ? lead.etapa : lead.etapaAnterior,
      semRespostaEm: etapa === "sem_resposta" ? quando : lead.semRespostaEm,
    },
  });
  // Funil (MET-02): ao avançar, conta também as etapas do funil que o card pulou (ex.: Novo → Visita conta "Pronto").
  // "Negociação" não é coluna do funil, mas vem depois de "Orçamento".
  const posicao = etapa === "negociacao" ? ETAPAS_FUNIL.indexOf("orcamento") : (ETAPAS_FUNIL as string[]).indexOf(etapa);
  for (const passou of ETAPAS_FUNIL.slice(0, posicao + 1)) await registrarUmaVez(leadId, `etapa_${passou}`, lead.consultorId);
  if (etapa === "sem_resposta") await registrarUmaVez(leadId, "sem_resposta");
  await registrarAlteracao(leadId, autor, `Moveu de "${nomeEtapa(lead.etapa)}" para "${nomeEtapa(etapa)}"`);
  await marcarMudanca();
  return atualizado;
}

export async function alterarEtiqueta(leadId: string, codigo: string, ativa: boolean, autor: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const atuais = lerLista(lead.etiquetas);
  const tem = atuais.includes(codigo);
  if (tem === ativa) return;
  const novas = ativa ? [...atuais, codigo] : atuais.filter((e) => e !== codigo);
  await db.lead.update({ where: { id: leadId }, data: { etiquetas: gravarLista(novas) } });
  await registrarAlteracao(leadId, autor, `${ativa ? "Adicionou" : "Removeu"} a etiqueta "${nomeEtiqueta(codigo)}"`);
  await marcarMudanca();
}

/** Visita ativa mais próxima do lead (a partir de agora). */
export async function proximaVisita(leadId: string) {
  return db.visita.findFirst({
    where: { leadId, status: "agendada", tipo: "visita" },
    orderBy: { inicio: "asc" },
    include: { consultor: { select: { nome: true } } },
  });
}

/** Recalcula o resumo do consultor a partir dos dados da ficha. */
export async function atualizarResumo(leadId: string): Promise<string> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { medidas: { orderBy: { criadoEm: "asc" } } } });
  const visita = await proximaVisita(leadId);
  const resumo = gerarResumo({
    nome: lead.nome,
    nomePerfil: lead.nomePerfil,
    cidade: lead.cidade,
    situacaoImovel: lead.situacaoImovel,
    prazo: lead.prazo,
    ambientes: lerLista(lead.ambientes),
    exigencias: lerLista(lead.exigencias),
    pedidosTecnicos: lerLista(lead.pedidosTecnicos),
    investimento: lead.investimento,
    classificacao: lead.classificacao,
    observacoes: lead.observacoes,
    medidas: lead.medidas,
    visita: visita ? { inicio: visita.inicio, consultorNome: visita.consultor.nome } : null,
  });
  await db.lead.update({ where: { id: leadId }, data: { resumo } });
  return resumo;
}

export interface CamposLead {
  nome?: string | null;
  cidade?: string | null;
  endereco?: string | null;
  ambientes?: string[];
  exigencias?: string[];
  situacaoImovel?: string | null;
  prazo?: string | null;
  investimento?: string | null;
  pedidosTecnicos?: string[];
  observacoes?: string | null;
  consultorId?: string | null;
}

const ROTULOS: Record<keyof CamposLead, string> = {
  nome: "nome",
  cidade: "cidade",
  endereco: "endereço",
  ambientes: "ambientes",
  exigencias: "exigências",
  situacaoImovel: "situação do imóvel",
  prazo: "prazo",
  investimento: "investimento",
  pedidosTecnicos: "pedidos técnicos",
  observacoes: "observações",
  consultorId: "consultor responsável",
};

/**
 * Atualiza os dados da ficha. Listas: o bot acrescenta (modo "acrescentar");
 * o consultor, ao editar, substitui (modo "substituir").
 */
export async function atualizarCampos(leadId: string, campos: CamposLead, autor: string, modoListas: "acrescentar" | "substituir") {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const dados: Record<string, string | null> = {};
  const mudou: string[] = [];

  for (const [chave, valor] of Object.entries(campos) as [keyof CamposLead, unknown][]) {
    if (valor === undefined) continue;
    if (Array.isArray(valor)) {
      const atual = lerLista(lead[chave as "ambientes"] as string);
      const nova = modoListas === "acrescentar" ? [...atual, ...valor] : valor;
      const gravado = gravarLista(nova as string[]);
      if (gravado !== gravarLista(atual)) {
        dados[chave] = gravado;
        mudou.push(ROTULOS[chave]);
      }
    } else {
      const texto = typeof valor === "string" ? valor.trim() || null : null;
      if (texto !== (lead[chave as "nome"] ?? null)) {
        dados[chave] = texto;
        mudou.push(ROTULOS[chave]);
      }
    }
  }
  if (!mudou.length) return lead;
  const atualizado = await db.lead.update({ where: { id: leadId }, data: dados });
  await registrarAlteracao(leadId, autor, `Atualizou ${mudou.join(", ")}`);
  await atualizarResumo(leadId);
  await marcarMudanca();
  return atualizado;
}

export async function arquivarLeads(ids: string[], autor: string): Promise<number> {
  const quando = await agora();
  let total = 0;
  for (const id of ids) {
    const r = await db.lead.updateMany({ where: { id, arquivadoEm: null }, data: { arquivadoEm: quando } });
    if (r.count) {
      total += r.count;
      await registrarAlteracao(id, autor, "Arquivou o lead");
      // Lead arquivado não segura horário na agenda (uma visita por horário na loja).
      const canceladas = await db.visita.updateMany({ where: { leadId: id, status: "agendada" }, data: { status: "cancelada", vagaChave: null } });
      if (canceladas.count) await registrarAlteracao(id, autor, `Cancelou ${canceladas.count} visita(s) ao arquivar`);
    }
  }
  await marcarMudanca();
  return total;
}

export async function restaurarLead(id: string, autor: string) {
  await db.lead.update({ where: { id }, data: { arquivadoEm: null } });
  await registrarAlteracao(id, autor, "Restaurou o lead do arquivo");
  await marcarMudanca();
}

/** Exclusão definitiva: lead, mensagens, medidas, notas, visitas e mídias (LIMP-04). Métricas ficam (LIMP-06). */
export async function excluirLeads(ids: string[]): Promise<number> {
  let total = 0;
  for (const id of ids) {
    const midias = await db.mensagem.findMany({ where: { leadId: id, midiaArquivo: { not: null } }, select: { midiaArquivo: true } });
    const r = await db.lead.deleteMany({ where: { id } });
    if (!r.count) continue;
    total += r.count;
    for (const m of midias) if (m.midiaArquivo) await apagarMidia(m.midiaArquivo);
  }
  if (total) await marcarMudanca();
  return total;
}

export function etapaOuErro(codigo: string): CodigoEtapa {
  if (!etapaValida(codigo)) throw new Error("Etapa inválida.");
  return codigo;
}
