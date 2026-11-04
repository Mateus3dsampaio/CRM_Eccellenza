import type { Lead } from "@prisma/client";
import { db } from "@/lib/db";
import { gravarLista, lerLista } from "@/lib/json";
import { apagarMidia } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { ErroHttp } from "@/lib/sessao";
import { marcarMudanca } from "@/lib/versao";
import { variantesTelefone } from "@/regras/telefone";
import { ETAPAS_COM_RETORNO, exigeRetorno, faltaParaMover, formatarReais, MOTIVO_PAROU_DE_RESPONDER, nomeMotivo, type DadosDeVenda, type RegrasDeVendas } from "@/regras/vendas";
import { NOMES_COMPROMISSO, type TipoCompromisso } from "@/regras/agenda";
import { motivosDePerda, regrasDeVendas } from "./vendas";
import { ETAPAS_FUNIL, etapaComAgenda, etapaValida, nomeEtiqueta, POSICAO_NO_FUNIL, type CodigoEtapa } from "@/regras/etapas";
import { nomesDasEtapas } from "./etapas";
import { registrarAlteracao } from "./historico";
import { registrarUmaVez } from "./metricas";
import { gerarResumo } from "./resumo";

/** Acha o lead pelo telefone nas duas formas do Brasil (com e sem o 9): é a mesma pessoa. */
export async function acharLeadPorTelefone(telefone: string) {
  return db.lead.findFirst({ where: { telefone: { in: variantesTelefone(telefone) } }, orderBy: { criadoEm: "asc" } });
}

export async function obterOuCriarLead(telefone: string, nomePerfil?: string | null, waId?: string | null) {
  const existente = await acharLeadPorTelefone(telefone);
  if (existente) {
    const dados: { nomePerfil?: string; waId?: string } = {};
    if (nomePerfil && !existente.nomePerfil) dados.nomePerfil = nomePerfil;
    if (waId && waId !== existente.waId) dados.waId = waId;
    return Object.keys(dados).length ? db.lead.update({ where: { id: existente.id }, data: dados }) : existente;
  }
  const quando = await agora();
  const lead = await db.lead.create({
    data: {
      telefone,
      waId: waId ?? null,
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
  await db.mudancaEtapa.create({ data: { leadId: lead.id, de: null, para: lead.etapa, autor: "sistema", criadoEm: quando } });
  await marcarMudanca();
  return lead;
}

export interface OpcoesMover {
  guardarAnterior?: boolean;
  /** Dados de venda informados agora (data do retorno, valores, motivo da perda). */
  dados?: DadosDeVenda;
  /** Movimento automático que devolve o lead à etapa onde estava (ex.: voltou da retomada): não exige dados. */
  semExigencias?: boolean;
}

/** Só confere (sem gravar) se o lead pode ir para a etapa com esses dados. Lança erro em português se não puder. */
export async function conferirMudanca(leadId: string, etapa: CodigoEtapa, dados: DadosDeVenda) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.etapa === etapa) return;
  const falta = faltaParaMover(
    etapa,
    {
      proximoContatoEm: dados.proximoContatoEm ?? lead.proximoContatoEm,
      valorFechado: dados.valorFechado ?? lead.valorFechado,
      motivoPerda: dados.motivoPerda ?? lead.motivoPerda,
      concorrente: dados.concorrente ?? lead.concorrente,
    },
    await regrasDeVendas(lead.motivoPerda),
  );
  if (falta) throw new ErroHttp(400, `${lead.nome ?? lead.nomePerfil ?? lead.telefone}: ${falta}`);
  const semAgenda = await faltaCompromisso(leadId, etapa);
  if (semAgenda) throw new ErroHttp(400, `${lead.nome ?? lead.nomePerfil ?? lead.telefone}: ${semAgenda}`);
}

/** Medição/Apresentação agendada só recebe o card com o compromisso marcado na agenda (tarefa 21). */
async function faltaCompromisso(leadId: string, etapa: CodigoEtapa): Promise<string | null> {
  if (!etapaComAgenda(etapa)) return null;
  const marcado = await db.visita.count({ where: { leadId, status: "agendada", tipo: etapa } });
  return marcado ? null : `Marque a ${NOMES_COMPROMISSO[etapa].toLowerCase()} na agenda para mover o card.`;
}

export async function moverEtapa(leadId: string, etapa: CodigoEtapa, autor: string, opcoes: OpcoesMover = {}) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const dados = opcoes.dados ?? {};
  if (lead.etapa === etapa) {
    if (Object.keys(dados).length) await gravarDadosDeVenda(lead, dados, autor, await regrasDeVendas(lead.motivoPerda));
    return lead;
  }
  // O que vale é o que veio agora, ou o que já estava gravado (ex.: mudou de Orçamento para Negociação).
  const final: DadosDeVenda = {
    proximoContatoEm: dados.proximoContatoEm ?? lead.proximoContatoEm,
    valorFechado: dados.valorFechado ?? lead.valorFechado,
    motivoPerda: dados.motivoPerda ?? lead.motivoPerda,
    concorrente: dados.concorrente ?? lead.concorrente,
  };
  const regras = await regrasDeVendas(lead.motivoPerda);
  if (!opcoes.semExigencias) {
    const falta = faltaParaMover(etapa, final, regras) ?? (await faltaCompromisso(leadId, etapa));
    if (falta) throw new ErroHttp(400, falta);
  }
  const pergunta = regras.motivos.find((m) => m.codigo === final.motivoPerda)?.pergunta ?? null;
  const quando = await agora();
  const vaiTerRetorno = ETAPAS_COM_RETORNO.includes(etapa);
  const parouDeResponder = etapa === "perdido" && final.motivoPerda === MOTIVO_PAROU_DE_RESPONDER;
  const atualizado = await db.lead.update({
    where: { id: leadId },
    data: {
      etapa,
      ordem: -quando.getTime(),
      etapaAnterior: opcoes.guardarAnterior ? lead.etapa : lead.etapaAnterior,
      semRespostaEm: parouDeResponder ? quando : lead.semRespostaEm,
      // O retorno marcado só vale em Em qualificação/Negociação (nas colunas com agenda, o compromisso é o próximo contato).
      proximoContatoEm: vaiTerRetorno ? final.proximoContatoEm : null,
      valorOrcamento: dados.valorOrcamento === undefined ? lead.valorOrcamento : dados.valorOrcamento,
      valorFechado: etapa === "fechado" ? final.valorFechado : lead.etapa === "fechado" ? null : lead.valorFechado,
      motivoPerda: etapa === "perdido" ? final.motivoPerda : lead.etapa === "perdido" ? null : lead.motivoPerda,
      concorrente: etapa === "perdido" && pergunta ? final.concorrente?.trim() || null : lead.etapa === "perdido" || etapa === "perdido" ? null : lead.concorrente,
    },
  });
  // Funil (MET-02): ao avançar, conta também as etapas do funil que o card pulou (ex.: Novo → Apresentação conta "Aguardando" e "Em qualificação").
  // Medição conta como Em qualificação e Negociação como Apresentação (regras/etapas.ts).
  const posicao = POSICAO_NO_FUNIL[etapa] ?? -1;
  for (const passou of ETAPAS_FUNIL.slice(0, posicao + 1)) await registrarUmaVez(leadId, `etapa_${passou}`, lead.consultorId);
  if (parouDeResponder) await registrarUmaVez(leadId, "sem_resposta");
  const nomes = await nomesDasEtapas();
  await registrarAlteracao(leadId, autor, `Moveu de "${nomes[lead.etapa as CodigoEtapa] ?? lead.etapa}" para "${nomes[etapa]}"${detalheDaMudanca(etapa, atualizado, await motivosDePerda())}`);
  await db.mudancaEtapa.create({ data: { leadId, de: lead.etapa, para: etapa, autor, criadoEm: quando } });
  await marcarMudanca();
  return atualizado;
}

function detalheDaMudanca(etapa: CodigoEtapa, lead: { motivoPerda: string | null; concorrente: string | null; valorFechado: number | null }, motivos: { codigo: string; nome: string }[]): string {
  if (etapa === "perdido") return ` (motivo: ${nomeMotivo(lead.motivoPerda, motivos)}${lead.concorrente ? ` – ${lead.concorrente}` : ""})`;
  if (etapa === "fechado" && lead.valorFechado) return ` (${formatarReais(lead.valorFechado)})`;
  return "";
}

/** Edita só os dados de venda de um lead que já está na etapa (ex.: trocar a data do retorno ou o valor). */
async function gravarDadosDeVenda(lead: Lead, dados: DadosDeVenda, autor: string, regras: RegrasDeVendas) {
  const data: Record<string, unknown> = {};
  const mudou: string[] = [];
  if (dados.proximoContatoEm !== undefined && ETAPAS_COM_RETORNO.includes(lead.etapa as CodigoEtapa)) {
    if (!dados.proximoContatoEm && exigeRetorno(lead.etapa as CodigoEtapa, regras)) throw new ErroHttp(400, "Informe a data e a hora do próximo contato.");
    data.proximoContatoEm = dados.proximoContatoEm ?? null;
    mudou.push("próximo contato");
  }
  if (dados.valorOrcamento !== undefined) {
    data.valorOrcamento = dados.valorOrcamento;
    mudou.push("valor do orçamento");
  }
  if (dados.valorFechado !== undefined && lead.etapa === "fechado") {
    if (!dados.valorFechado) throw new ErroHttp(400, "Informe o valor fechado.");
    data.valorFechado = dados.valorFechado;
    mudou.push("valor fechado");
  }
  if (dados.motivoPerda !== undefined && lead.etapa === "perdido") {
    const falta = faltaParaMover("perdido", { motivoPerda: dados.motivoPerda, concorrente: dados.concorrente ?? lead.concorrente }, regras);
    if (falta) throw new ErroHttp(400, falta);
    const pergunta = regras.motivos.find((m) => m.codigo === dados.motivoPerda)?.pergunta;
    data.motivoPerda = dados.motivoPerda;
    data.concorrente = pergunta ? (dados.concorrente ?? lead.concorrente)?.trim() : null;
    mudou.push("motivo da perda");
  }
  if (!mudou.length) return;
  await db.lead.update({ where: { id: lead.id }, data });
  await registrarAlteracao(lead.id, autor, `Atualizou ${mudou.join(", ")}`);
  await marcarMudanca();
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

/** Compromisso ativo mais próximo do lead (visita à loja, medição ou apresentação). */
export async function proximaVisita(leadId: string) {
  return db.visita.findFirst({
    where: { leadId, status: "agendada" },
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
    visita: visita ? { inicio: visita.inicio, consultorNome: visita.consultor.nome, tipo: NOMES_COMPROMISSO[visita.tipo as TipoCompromisso] ?? "Visita" } : null,
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
    const dono = await db.lead.findUnique({ where: { id }, select: { telefone: true, waId: true } });
    const r = await db.lead.deleteMany({ where: { id } });
    if (!r.count) continue;
    // O aviso guarda a prévia da mensagem do cliente e não tem ligação com o lead: sai junto (LGPD).
    await db.alerta.deleteMany({ where: { leadId: id } });
    // Eventos da Meta ainda não processados trazem o telefone e o texto do cliente: saem também.
    if (dono) {
      const numeros = [...variantesTelefone(dono.telefone).map((t) => t.replace(/\D/g, "")), ...(dono.waId ? [dono.waId] : [])];
      await db.eventoWebhook.deleteMany({ where: { OR: numeros.map((n) => ({ corpo: { contains: n } })) } });
    }
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
