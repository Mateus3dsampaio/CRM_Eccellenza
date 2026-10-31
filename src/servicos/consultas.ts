import { db } from "@/lib/db";
import { lerLista } from "@/lib/json";
import { agora } from "@/lib/relogio";
import { janelaAberta, janelaFechaEm } from "@/regras/janela24h";
import { formatarHorarioCard, formatarVisitaCurta, inicioDaSemanaLocal, inicioDoMesLocal, somarDias } from "@/regras/tempo";
import { formatarTelefone } from "@/regras/telefone";
import { statusEfetivo } from "./mensagens";

// Consultas para as telas (formato pronto para o cliente/navegador).

export function nomeExibicao(lead: { nome: string | null; nomePerfil: string | null; telefone: string }) {
  return lead.nome || lead.nomePerfil || formatarTelefone(lead.telefone);
}

export async function cardsDoKanban() {
  const quando = await agora();
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null },
    orderBy: { ordem: "asc" },
    include: {
      consultor: { select: { id: true, nome: true } },
      visitas: { where: { status: "agendada" }, orderBy: { inicio: "asc" }, take: 1 },
      notas: { select: { texto: true } },
    },
  });
  return leads.map((l) => {
    const ambientes = lerLista(l.ambientes);
    const visita = l.visitas[0];
    const nome = nomeExibicao(l);
    return {
      id: l.id,
      nome,
      telefone: formatarTelefone(l.telefone),
      avatarCor: l.avatarCor,
      etapa: l.etapa,
      ordem: l.ordem,
      horario: l.ultimaMensagemEm ? formatarHorarioCard(l.ultimaMensagemEm, quando) : "",
      previa: l.ultimaMensagemPrevia ?? "",
      cidade: l.cidade,
      ambientes,
      investimento: l.investimento,
      etiquetas: lerLista(l.etiquetas),
      aguardandoHumano: l.aguardandoHumano,
      erroBot: l.erroBot,
      modo: l.modoAtendimento,
      consultor: l.consultor,
      visita: visita ? formatarVisitaCurta(visita.inicio) : null,
      // Texto para a busca (nome, telefone e dados da ficha).
      busca: [nome, l.telefone, formatarTelefone(l.telefone), l.cidade, l.endereco, ambientes.join(" "), lerLista(l.exigencias).join(" "), l.situacaoImovel, l.prazo, l.investimento, lerLista(l.pedidosTecnicos).join(" "), l.observacoes, l.resumo, l.notas.map((n) => n.texto).join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });
}

export type CardKanban = Awaited<ReturnType<typeof cardsDoKanban>>[number];

export async function fichaDoLead(id: string) {
  const quando = await agora();
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      consultor: { select: { id: true, nome: true } },
      mensagens: { orderBy: { enviadaEm: "asc" } },
      medidas: { orderBy: { criadoEm: "asc" } },
      notas: { orderBy: { criadoEm: "desc" } },
      historico: { orderBy: { criadoEm: "desc" } },
      visitas: { orderBy: { inicio: "desc" }, include: { consultor: { select: { nome: true } } } },
    },
  });
  if (!lead) return null;
  const fecha = janelaFechaEm(lead.ultimaMsgClienteEm);
  return {
    id: lead.id,
    nome: lead.nome,
    nomePerfil: lead.nomePerfil,
    nomeExibicao: nomeExibicao(lead),
    telefone: formatarTelefone(lead.telefone),
    avatarCor: lead.avatarCor,
    cidade: lead.cidade,
    endereco: lead.endereco,
    ambientes: lerLista(lead.ambientes),
    exigencias: lerLista(lead.exigencias),
    situacaoImovel: lead.situacaoImovel,
    prazo: lead.prazo,
    investimento: lead.investimento,
    pedidosTecnicos: lerLista(lead.pedidosTecnicos),
    observacoes: lead.observacoes,
    classificacao: lead.classificacao,
    resumo: lead.resumo,
    etapa: lead.etapa,
    etiquetas: lerLista(lead.etiquetas),
    consultor: lead.consultor,
    modo: lead.modoAtendimento,
    aguardandoHumano: lead.aguardandoHumano,
    erroBot: lead.erroBot,
    arquivado: !!lead.arquivadoEm,
    janelaAberta: janelaAberta(lead.ultimaMsgClienteEm, quando),
    janelaFechaEm: fecha?.toISOString() ?? null,
    mensagens: lead.mensagens.map((m) => ({
      id: m.id,
      autor: m.autor,
      autorNome: m.autorNome,
      texto: m.texto,
      midia: m.midiaArquivo,
      modelo: m.modelo,
      enviadaEm: m.enviadaEm.toISOString(),
      status: statusEfetivo(m, quando),
    })),
    medidas: lead.medidas.map((m) => ({ id: m.id, ambiente: m.ambiente, descricao: m.descricao, fonte: m.fonte, origem: m.origem, confirmada: m.confirmada })),
    notas: lead.notas.map((n) => ({ id: n.id, autorNome: n.autorNome, texto: n.texto, criadoEm: n.criadoEm.toISOString() })),
    historico: lead.historico.map((h) => ({ id: h.id, autor: h.autor, descricao: h.descricao, criadoEm: h.criadoEm.toISOString() })),
    visitas: lead.visitas.map((v) => ({ id: v.id, inicio: v.inicio.toISOString(), rotulo: formatarVisitaCurta(v.inicio), status: v.status, consultor: v.consultor.nome })),
  };
}

export type FichaLead = NonNullable<Awaited<ReturnType<typeof fichaDoLead>>>;

export async function dadosDaAgenda(de: Date, ate: Date) {
  const [consultores, visitas, bloqueios] = await Promise.all([
    db.usuario.findMany({ where: { perfil: "consultor", ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.visita.findMany({
      where: { status: "agendada", inicio: { lt: ate }, fim: { gt: de } },
      include: { lead: { select: { id: true, nome: true, nomePerfil: true, telefone: true, cidade: true } } },
      orderBy: { inicio: "asc" },
    }),
    db.bloqueio.findMany({ where: { inicio: { lt: ate }, fim: { gt: de } }, orderBy: { inicio: "asc" } }),
  ]);
  return {
    consultores,
    visitas: visitas.map((v) => ({
      id: v.id,
      consultorId: v.consultorId,
      inicio: v.inicio.toISOString(),
      fim: v.fim.toISOString(),
      leadId: v.lead.id,
      leadNome: nomeExibicao(v.lead),
      cidade: v.lead.cidade,
    })),
    bloqueios: bloqueios.map((b) => ({ id: b.id, consultorId: b.consultorId, inicio: b.inicio.toISOString(), fim: b.fim.toISOString(), motivo: b.motivo })),
  };
}

const TIPOS_PAINEL = [
  ["lead_novo", "Leads novos"],
  ["qualificado", "Qualificados"],
  ["curioso", "Curiosos"],
  ["outra_cidade", "Outras cidades"],
  ["parceiro", "Arquitetos/parceiros"],
  ["sem_resposta", "Sem resposta"],
  ["retomada_voltou", "Retomadas que voltaram"],
  ["visita_agendada", "Visitas agendadas"],
] as const;

const FUNIL = [
  ["etapa_novo", "Novo"],
  ["etapa_pronto", "Pronto para o consultor"],
  ["etapa_visita", "Visita agendada"],
  ["etapa_orcamento", "Orçamento apresentado"],
  ["etapa_fechado", "Fechado"],
] as const;

/** Painel (MET-01/02), calculado só com os contadores anônimos. */
export async function dadosDoPainel(periodo: "semana" | "mes") {
  const quando = await agora();
  const de = periodo === "semana" ? inicioDaSemanaLocal(quando) : inicioDoMesLocal(quando);
  const anteriorDe = periodo === "semana" ? somarDias(de, -7) : inicioDoMesLocal(somarDias(de, -1));
  const eventos = await db.eventoMetrica.findMany({ where: { ocorridoEm: { gte: anteriorDe } } });
  const consultores = await db.usuario.findMany({ where: { perfil: "consultor" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });

  const contar = (tipo: string, desde: Date, ate?: Date) =>
    eventos.filter((e) => e.tipo === tipo && e.ocorridoEm >= desde && (!ate || e.ocorridoEm < ate)).length;

  return {
    periodo,
    inicio: de.toISOString(),
    indicadores: TIPOS_PAINEL.map(([tipo, nome]) => ({ tipo, nome, atual: contar(tipo, de), anterior: contar(tipo, anteriorDe, de) })),
    funil: FUNIL.map(([tipo, nome]) => ({ tipo, nome, total: contar(tipo, de) })),
    visitasPorConsultor: consultores.map((c) => ({
      nome: c.nome,
      total: eventos.filter((e) => e.tipo === "visita_agendada" && e.consultorId === c.id && e.ocorridoEm >= de).length,
    })),
  };
}

export async function listaArquivados() {
  const leads = await db.lead.findMany({ where: { arquivadoEm: { not: null } }, orderBy: { arquivadoEm: "desc" } });
  return leads.map((l) => ({
    id: l.id,
    nome: nomeExibicao(l),
    telefone: formatarTelefone(l.telefone),
    cidade: l.cidade,
    avatarCor: l.avatarCor,
    arquivadoEm: l.arquivadoEm!.toISOString(),
    previa: l.ultimaMensagemPrevia,
  }));
}
