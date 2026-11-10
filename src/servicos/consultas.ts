import { db } from "@/lib/db";
import { lerLista } from "@/lib/json";
import { agora } from "@/lib/relogio";
import { esperaDoLead, ordenarParaColuna } from "@/regras/espera";
import { janelaAberta, janelaFechaEm, JANELA_MS } from "@/regras/janela24h";
import { DIA, formatarHorarioCard, formatarVisitaCurta, inicioDoDiaLocal } from "@/regras/tempo";
import { NOMES_COMPROMISSO, type TipoCompromisso } from "@/regras/agenda";
import { etapaComAgenda } from "@/regras/etapas";
import { decisaoPendente, ETIQUETA_DECISAO } from "@/regras/decisao";
import { ETAPAS_COM_RETORNO, exigeRetorno, situacaoDoRetorno } from "@/regras/vendas";
import { exigirContatoNegociacao } from "./vendas";
import { formatarTelefone, nomeExibicao } from "@/regras/telefone";
import { statusEfetivo } from "./mensagens";

// Consultas para as telas (formato pronto para o cliente/navegador).

export { nomeExibicao };

/**
 * Leads esperando um humano, para o contador do topo e a lista (ESP-05). Quem espera há mais tempo vem primeiro.
 * O consultor vê só os próprios leads; o admin vê todos, inclusive os que ainda não têm dono.
 */
export async function leadsAguardando(usuario: { id: string; perfil: string }) {
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, aguardandoHumano: true, etapa: { not: "perdido" }, ...(usuario.perfil === "admin" ? {} : { consultorId: usuario.id }) },
    include: { consultor: { select: { id: true, nome: true } } },
  });
  const lista = leads.map((l) => ({
    id: l.id,
    nome: nomeExibicao(l),
    etapa: l.etapa,
    previa: l.ultimaMensagemPrevia ?? "",
    naoLidas: l.naoLidas,
    consultor: l.consultor,
    esperandoDesde: esperaDoLead(l)?.toISOString() ?? null,
    ultimaMensagemEm: l.ultimaMensagemEm?.toISOString() ?? null,
  }));
  return ordenarParaColuna(lista);
}

/**
 * Leads com a janela de 24h da Meta ainda aberta, em etapa aberta (tarefa 37). A tela filtra os que estão fechando
 * com o relógio do servidor, então a lista se atualiza sozinha. O consultor vê os seus; o admin vê todos.
 */
export async function janelasAbertas(usuario: { id: string; perfil: string }) {
  const quando = await agora();
  const leads = await db.lead.findMany({
    where: {
      arquivadoEm: null,
      etapa: { notIn: ["fechado", "perdido"] },
      ultimaMsgClienteEm: { gt: new Date(quando.getTime() - JANELA_MS) },
      ...(usuario.perfil === "admin" ? {} : { consultorId: usuario.id }),
    },
    include: { consultor: { select: { id: true, nome: true } } },
    orderBy: { ultimaMsgClienteEm: "asc" },
  });
  return leads.map((l) => ({
    id: l.id,
    nome: nomeExibicao(l),
    etapa: l.etapa,
    previa: l.ultimaMensagemPrevia ?? "",
    ultimaMsgClienteEm: l.ultimaMsgClienteEm?.toISOString() ?? null,
    consultor: l.consultor,
  }));
}

const PESO_RETORNO = { atrasado: 0, hoje: 1, sem_data: 2, futuro: 3 } as const;

/**
 * "Retornos de hoje": leads abertos com lembrete/retorno hoje ou atrasado (qualquer etapa aberta, tarefa 22), mais os de
 * Negociação sem data quando a data é obrigatória, mais as decisões pendentes (medição ou apresentação que passou,
 * `regras/decisao.ts`). O consultor vê os seus; o admin vê todos. Atrasados primeiro, depois por hora.
 */
export async function retornosDeHoje(usuario: { id: string; perfil: string }) {
  const quando = await agora();
  const fimDoDia = new Date(inicioDoDiaLocal(quando).getTime() + DIA);
  const leads = await db.lead.findMany({
    where: {
      arquivadoEm: null,
      etapa: { in: ETAPAS_COM_RETORNO },
      ...(usuario.perfil === "admin" ? {} : { consultorId: usuario.id }),
    },
    include: { consultor: { select: { id: true, nome: true } }, visitas: { where: { status: "agendada" }, select: { tipo: true, inicio: true } } },
  });
  const regras = { exigirContatoNegociacao: await exigirContatoNegociacao() };
  return leads
    .map((l) => ({ l, decisao: decisaoPendente(l, l.visitas, quando) }))
    // Lead sem retorno marcado só entra na lista quando a etapa exige o retorno; senão não há o que cobrar.
    .filter(({ l, decisao }) => decisao || (l.proximoContatoEm ? l.proximoContatoEm < fimDoDia : exigeRetorno(l.etapa as never, regras)))
    .map(({ l, decisao }) => ({
      id: l.id,
      nome: nomeExibicao(l),
      etapa: l.etapa,
      proximoContatoEm: l.proximoContatoEm?.toISOString() ?? null,
      lembreteNota: l.lembreteNota,
      // Decisão pendente conta como atrasado (vai para o topo da lista).
      situacao: decisao ? ("atrasado" as const) : situacaoDoRetorno(l.proximoContatoEm, quando),
      decisao: decisao ? `${ETIQUETA_DECISAO[decisao.tipo]} (${formatarVisitaCurta(decisao.venceuEm)})` : null,
      valorOrcamento: l.valorOrcamento,
      consultor: l.consultor,
    }))
    .sort((a, b) => PESO_RETORNO[a.situacao] - PESO_RETORNO[b.situacao] || (a.proximoContatoEm ?? "").localeCompare(b.proximoContatoEm ?? ""));
}

export async function cardsDoKanban() {
  const quando = await agora();
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null },
    include: {
      consultor: { select: { id: true, nome: true } },
      visitas: { where: { status: "agendada" }, orderBy: { inicio: "asc" }, select: { inicio: true, tipo: true } },
      notas: { select: { texto: true } },
    },
  });
  const cards = leads.map((l) => {
    const ambientes = lerLista(l.ambientes);
    const visita = l.visitas[0];
    const nome = nomeExibicao(l);
    const esperandoDesde = esperaDoLead(l);
    return {
      id: l.id,
      nome,
      telefone: formatarTelefone(l.telefone),
      avatarCor: l.avatarCor,
      etapa: l.etapa,
      ordem: l.ordem,
      horario: l.ultimaMensagemEm ? formatarHorarioCard(l.ultimaMensagemEm, quando) : "",
      ultimaMensagemEm: l.ultimaMensagemEm?.toISOString() ?? null,
      ultimaMsgClienteEm: l.ultimaMsgClienteEm?.toISOString() ?? null,
      esperandoDesde: esperandoDesde?.toISOString() ?? null,
      naoLidas: l.naoLidas,
      previa: l.ultimaMensagemPrevia ?? "",
      cidade: l.cidade,
      ambientes,
      investimento: l.investimento,
      etiquetas: lerLista(l.etiquetas),
      proximoContatoEm: l.proximoContatoEm?.toISOString() ?? null,
      lembreteNota: l.lembreteNota,
      valorOrcamento: l.valorOrcamento,
      valorFechado: l.valorFechado,
      motivoPerda: l.motivoPerda,
      concorrente: l.concorrente,
      aguardandoHumano: l.aguardandoHumano,
      erroBot: l.erroBot,
      modo: l.modoAtendimento,
      consultor: l.consultor,
      // Próximo compromisso marcado, com o tipo (ex.: "Apresentação qua 05/11 10h").
      // Card em Medição/Apresentação agendada sem o compromisso daquela coluna marcado (ex.: voltou de Perdido): etiqueta "Sem data".
      semData: etapaComAgenda(l.etapa) && !l.visitas.some((v) => v.tipo === l.etapa),
      // Data vencida sem decisão do vendedor (regras/decisao.ts): etiqueta piscante que abre a janela de decisão.
      decisao: decisaoPendente(l, l.visitas, quando),
      // Medição e apresentação marcadas: ao voltar o card para Em qualificação, a tela avisa que serão canceladas.
      agendados: l.visitas.filter((v) => v.tipo !== "visita").map((v) => ({ tipo: v.tipo, rotulo: `${NOMES_COMPROMISSO[v.tipo as TipoCompromisso] ?? "Compromisso"} ${formatarVisitaCurta(v.inicio)}` })),
      visita: visita ? `${NOMES_COMPROMISSO[visita.tipo as TipoCompromisso] ?? "Visita"} ${formatarVisitaCurta(visita.inicio)}` : null,
      // Início do próximo compromisso: a faixa do card fica azul quando é hoje (regras/acao-card.ts).
      visitaEm: visita?.inicio.toISOString() ?? null,
      // Texto para a busca (nome, telefone e dados da ficha).
      busca: [nome, l.telefone, formatarTelefone(l.telefone), l.cidade, l.endereco, ambientes.join(" "), lerLista(l.exigencias).join(" "), l.situacaoImovel, l.prazo, l.investimento, lerLista(l.pedidosTecnicos).join(" "), l.observacoes, l.resumo, l.notas.map((n) => n.texto).join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });
  // Cada coluna mostra primeiro quem espera resposta, depois o resto pela última mensagem (a ordem vale para a lista toda).
  return ordenarParaColuna(cards);
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
    proximoContatoEm: lead.proximoContatoEm?.toISOString() ?? null,
    lembreteNota: lead.lembreteNota,
    valorOrcamento: lead.valorOrcamento,
    valorFechado: lead.valorFechado,
    motivoPerda: lead.motivoPerda,
    concorrente: lead.concorrente,
    etiquetas: lerLista(lead.etiquetas),
    consultor: lead.consultor,
    modo: lead.modoAtendimento,
    aguardandoHumano: lead.aguardandoHumano,
    esperandoDesde: esperaDoLead(lead)?.toISOString() ?? null,
    naoLidas: lead.naoLidas,
    erroBot: lead.erroBot,
    arquivado: !!lead.arquivadoEm,
    janelaAberta: janelaAberta(lead.ultimaMsgClienteEm, quando),
    ultimaMsgClienteEm: lead.ultimaMsgClienteEm?.toISOString() ?? null,
    janelaFechaEm: fecha?.toISOString() ?? null,
    mensagens: lead.mensagens.map((m) => ({
      id: m.id,
      autor: m.autor,
      autorNome: m.autorNome,
      texto: m.texto,
      midia: m.midiaArquivo,
      midiaTipo: m.midiaTipo,
      midiaNome: m.midiaNome,
      midiaBytes: m.midiaBytes,
      modelo: m.modelo,
      enviadaEm: m.enviadaEm.toISOString(),
      status: statusEfetivo(m, quando),
    })),
    medidas: lead.medidas.map((m) => ({ id: m.id, ambiente: m.ambiente, descricao: m.descricao, fonte: m.fonte, origem: m.origem, confirmada: m.confirmada })),
    notas: lead.notas.map((n) => ({ id: n.id, autorNome: n.autorNome, texto: n.texto, criadoEm: n.criadoEm.toISOString() })),
    historico: lead.historico.map((h) => ({ id: h.id, autor: h.autor, descricao: h.descricao, criadoEm: h.criadoEm.toISOString() })),
    visitas: lead.visitas.map((v) => ({ id: v.id, inicio: v.inicio.toISOString(), rotulo: formatarVisitaCurta(v.inicio), status: v.status, tipo: v.tipo, consultor: v.consultor.nome })),
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
      tipo: v.tipo,
    })),
    bloqueios: bloqueios.map((b) => ({ id: b.id, consultorId: b.consultorId, inicio: b.inicio.toISOString(), fim: b.fim.toISOString(), motivo: b.motivo })),
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
