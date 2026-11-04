import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { PASTA_MIDIAS } from "@/lib/midias";
import { avancarRelogio, agora } from "@/lib/relogio";
import { lerLista } from "@/lib/json";
import { DIA, HORA, chaveDia, inicioDoDiaLocal, somarDias } from "@/regras/tempo";
import { janelaDeAgendamento } from "@/regras/agenda";
import { agendarVisita, cancelarVisita, criarBloqueio, horariosLivresEmTorno, horariosLivresParaLead } from "@/servicos/agenda";
import { converterFunilAntigo } from "@/servicos/conversao-funil";
import { motivosDePerda } from "@/servicos/vendas";
import { dadosDoPainel } from "@/servicos/painel";
import { AVISO_ALMOCO } from "@/regras/almoco";
import { REGRAS_AGENDA_PADRAO } from "@/regras/agenda";
import { definirModoDistribuicao, definirRegrasDaAgenda, regrasDaAgenda } from "@/servicos/configuracoes";
import { definirStatusConsultor, distribuirFila, escolherProximoConsultor } from "@/servicos/distribuicao";
import { arquivarLeads, conferirMudanca, excluirLeads, moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { rodarRotinas } from "@/servicos/rotinas";
import { receberMensagemCliente } from "@/servicos/conversa";
import { criarConsultores, limparBanco, criarRoteiroDeTeste } from "./ajuda";

// PNG mínimo válido (1x1).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

beforeEach(async () => {
  await limparBanco();
});

describe("retomada e Sem resposta com o relógio simulado (RET-01 a RET-03)", () => {
  it("envia uma única retomada, move para Perdido (Parou de responder) e volta quando o cliente responde", async () => {
    const lead = await obterOuCriarLead("+5588900001111", "Cliente Teste");
    await registrarMensagemCliente(lead.id, "Oi, quero uma cozinha");
    await enviarMensagemLoja({ leadId: lead.id, autor: "bot", texto: "Oi! Qual ambiente?" });

    await avancarRelogio(3 * DIA + HORA);
    expect((await rodarRotinas()).retomadas).toBe(1);
    expect((await rodarRotinas()).retomadas).toBe(0);
    let atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(lerLista(atual.etiquetas)).toContain("retomada");
    expect(await db.mensagem.count({ where: { leadId: lead.id, modelo: "retomada" } })).toBe(1);

    await avancarRelogio(4 * DIA + HORA);
    expect((await rodarRotinas()).semResposta).toBe(1);
    atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atual).toMatchObject({ etapa: "perdido", motivoPerda: "parou_de_responder", etapaAnterior: "novo" });
    expect((await motivosDePerda()).some((m) => m.codigo === "parou_de_responder")).toBe(true);

    // Muito tempo depois: continua uma retomada só.
    await avancarRelogio(10 * DIA);
    await rodarRotinas();
    expect(await db.mensagem.count({ where: { leadId: lead.id, modelo: "retomada" } })).toBe(1);

    await registrarMensagemCliente(lead.id, "Oi, ainda quero sim");
    atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atual.etapa).toBe("novo");
    expect(atual.motivoPerda).toBeNull();
    expect(lerLista(atual.etiquetas)).not.toContain("retomada");
    expect(await db.eventoMetrica.count({ where: { tipo: "retomada_voltou" } })).toBe(1);
  });
});

describe("janela de 24h no envio (MSG-02)", () => {
  it("bloqueia texto livre fora da janela e aceita modelo", async () => {
    const lead = await obterOuCriarLead("+5588900002222");
    await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", texto: "Olá" })).rejects.toThrow(/24h/);
    // Modelo é mensagem iniciada pela loja: precisa de consentimento registrado.
    await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", modelo: "primeiro_contato" })).rejects.toThrow(/consentimento|aceitou/);
    await db.lead.update({ where: { id: lead.id }, data: { consentimentoEm: new Date(), consentimentoOrigem: "balcao" } });
    await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", modelo: "primeiro_contato" })).resolves.toBeTruthy();
    await registrarMensagemCliente(lead.id, "Oi");
    await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", texto: "Olá" })).resolves.toBeTruthy();
    await avancarRelogio(25 * HORA);
    await expect(enviarMensagemLoja({ leadId: lead.id, autor: "consultor", texto: "Olá de novo" })).rejects.toThrow(/24h/);
  });
  it("número sem WhatsApp fica com status falhou (MSG-03)", async () => {
    const lead = await obterOuCriarLead("+5588900000000");
    await db.lead.update({ where: { id: lead.id }, data: { consentimentoEm: new Date(), consentimentoOrigem: "balcao" } });
    const m = await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", modelo: "primeiro_contato" });
    expect(m.status).toBe("falhou");
  });
});

describe("agenda sem conflito (AGENDA-02)", () => {
  it("dois agendamentos ao mesmo tempo no mesmo horário: só um passa (uma visita por horário)", async () => {
    const [a, b] = await criarConsultores();
    const l1 = await obterOuCriarLead("+5588900003331");
    const l2 = await obterOuCriarLead("+5588900003332");
    const [vaga] = await horariosLivresParaLead(l1.id, 1);
    const resultados = await Promise.allSettled([
      agendarVisita({ leadId: l1.id, inicio: vaga.inicio, consultorId: a.id, autor: "teste", tipo: "apresentacao" }),
      agendarVisita({ leadId: l2.id, inicio: vaga.inicio, consultorId: b.id, autor: "teste", tipo: "apresentacao" }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.visita.count({ where: { inicio: vaga.inicio, status: "agendada" } })).toBe(1);
    // Remarcar conta a visita uma vez só no painel.
    const ok = resultados.findIndex((r) => r.status === "fulfilled");
    const leadOk = ok === 0 ? l1 : l2;
    const [outra] = (await horariosLivresParaLead(leadOk.id, 2)).slice(1);
    await agendarVisita({ leadId: leadOk.id, inicio: outra.inicio, autor: "teste", tipo: "apresentacao" });
    expect(await db.eventoMetrica.count({ where: { tipo: "apresentacao_agendada" } })).toBe(1);
    expect(await db.eventoMetrica.count({ where: { tipo: "etapa_qualificacao" } })).toBe(1);
  });
  it("horário bloqueado nunca é oferecido e agendar move o card", async () => {
    const [a, b] = await criarConsultores();
    const lead = await obterOuCriarLead("+5588900004444");
    const { de } = janelaDeAgendamento(await agora());
    const inicio = new Date(de.getTime() + 8 * HORA);
    await criarBloqueio({ consultorId: a.id, inicio, fim: new Date(inicio.getTime() + 10 * HORA), autor: "teste" });
    await criarBloqueio({ consultorId: b.id, inicio, fim: new Date(inicio.getTime() + 10 * HORA), autor: "teste" });
    const livres = await horariosLivresParaLead(lead.id, 20);
    expect(livres.every((v) => v.inicio.getTime() >= inicio.getTime() + 10 * HORA || v.inicio < inicio)).toBe(true);
    await expect(agendarVisita({ leadId: lead.id, inicio, autor: "teste" })).rejects.toThrow(/livre/);
    await agendarVisita({ leadId: lead.id, inicio: livres[0].inicio, autor: "teste", tipo: "apresentacao" });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("apresentacao");
  });
});

describe("cliente volta a falar depois de Perdido", () => {
  const ficha = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });

  it("movido para Perdido pelo consultor em Em qualificação: volta para Em qualificação", async () => {
    const lead = await obterOuCriarLead("+5588900007001");
    await moverEtapa(lead.id, "qualificacao", "teste", { semExigencias: true });
    await moverEtapa(lead.id, "perdido", "Ana", { semExigencias: true, dados: { motivoPerda: "preco" } });
    await registrarMensagemCliente(lead.id, "Oi, ainda tenho interesse");
    expect(await ficha(lead.id)).toMatchObject({ etapa: "qualificacao", motivoPerda: null });
  });
  it("estava em Apresentação agendada: volta para Apresentação agendada", async () => {
    const lead = await obterOuCriarLead("+5588900007002");
    await moverEtapa(lead.id, "apresentacao", "teste", { semExigencias: true });
    await moverEtapa(lead.id, "perdido", "Ana", { semExigencias: true });
    await registrarMensagemCliente(lead.id, "Podemos remarcar?");
    expect((await ficha(lead.id)).etapa).toBe("apresentacao");
    // Mensagens seguintes não mexem mais no card.
    await registrarMensagemCliente(lead.id, "Pode ser sábado");
    expect((await ficha(lead.id)).etapa).toBe("apresentacao");
  });
  it("card que já estava em Perdido antes da regra volta pelo histórico", async () => {
    const lead = await obterOuCriarLead("+5588900007003");
    await db.lead.update({ where: { id: lead.id }, data: { etapa: "perdido", etapaAnterior: "novo" } });
    await db.mudancaEtapa.create({ data: { leadId: lead.id, de: "medicao", para: "perdido", autor: "Ana", criadoEm: await agora() } });
    await registrarMensagemCliente(lead.id, "Oi");
    expect((await ficha(lead.id)).etapa).toBe("medicao");
  });
  it("Perdido e excluído: se falar de novo, começa do zero no atendimento do bot", async () => {
    const lead = await obterOuCriarLead("+5588900007004");
    await moverEtapa(lead.id, "apresentacao", "teste", { semExigencias: true });
    await moverEtapa(lead.id, "perdido", "Ana", { semExigencias: true });
    await excluirLeads([lead.id]);
    const novo = await obterOuCriarLead("+5588900007004");
    await registrarMensagemCliente(novo.id, "Oi, quero um orçamento");
    expect(novo.id).not.toBe(lead.id);
    expect(await ficha(novo.id)).toMatchObject({ etapa: "novo", modoAtendimento: "bot", etapaAnterior: null });
  });
});

describe("calendário da janela de agendar", () => {
  it("escolhe uma data além dos dias à frente e traz a véspera, o dia e o dia seguinte, sem limite de quantidade", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900004545");
    const regras = await regrasDaAgenda();
    // Uma quarta-feira ~40 dias à frente (muito além dos 14 dias padrão).
    let alvo = somarDias(inicioDoDiaLocal(await agora()), regras.diasAFrente + 26);
    while (new Date(alvo.getTime() - 3 * HORA).getUTCDay() !== 3) alvo = somarDias(alvo, 1);
    const r = await horariosLivresEmTorno(lead.id, "medicao", alvo);
    expect(chaveDia(r.centro)).toBe(chaveDia(alvo));
    const dias = new Set(r.livres.map((v) => chaveDia(v.inicio)));
    expect(dias).toEqual(new Set([chaveDia(somarDias(alvo, -1)), chaveDia(alvo), chaveDia(somarDias(alvo, 1))]));
    // Medição de 2h das 8h às 18h: 8h a 16h nos três dias úteis.
    expect(r.livres).toHaveLength(27);
    const m = r.livres.find((v) => chaveDia(v.inicio) === chaveDia(alvo))!;
    await agendarVisita({ leadId: lead.id, inicio: m.inicio, consultorId: m.consultorId, autor: "teste", tipo: "medicao" });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("medicao");
  });
  it("sem dia escolhido centra no primeiro dia livre e nunca oferece antes do primeiro dia possível", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900004646");
    const r = await horariosLivresEmTorno(lead.id, "apresentacao");
    const [primeira] = await horariosLivresParaLead(lead.id, 1, undefined, "apresentacao");
    expect(chaveDia(r.centro)).toBe(chaveDia(primeira.inicio));
    expect(r.livres.every((v) => v.inicio.getTime() >= r.primeiroDia.getTime())).toBe(true);
    const passado = await horariosLivresEmTorno(lead.id, "apresentacao", somarDias(await agora(), -10));
    expect(passado.livres).toHaveLength(0);
  });
});

describe("novo funil com a agenda (tarefa 21)", () => {
  const etapa = async (id: string) => (await db.lead.findUniqueOrThrow({ where: { id } })).etapa;
  const contar = (tipo: string) => db.eventoMetrica.count({ where: { tipo } });

  it("visita à loja não move o card; medição move para Medição e apresentação para Apresentação", async () => {
    const [a] = await criarConsultores();
    const lead = await obterOuCriarLead("+5588900005001");
    await moverEtapa(lead.id, "qualificacao", "teste", { dados: { proximoContatoEm: new Date((await agora()).getTime() + DIA) } });
    const [v1, v2] = await horariosLivresParaLead(lead.id, 2);
    await agendarVisita({ leadId: lead.id, inicio: v1.inicio, consultorId: a.id, autor: "teste", tipo: "visita" });
    expect(await etapa(lead.id)).toBe("qualificacao");
    const [m] = await horariosLivresParaLead(lead.id, 1, new Date(v2.inicio.getTime() + DIA), "medicao");
    const medicao = await agendarVisita({ leadId: lead.id, inicio: m.inicio, consultorId: a.id, autor: "teste", tipo: "medicao" });
    expect(medicao.fim.getTime() - medicao.inicio.getTime()).toBe(2 * HORA);
    expect(await etapa(lead.id)).toBe("medicao");
    const [ap] = await horariosLivresParaLead(lead.id, 1, new Date(m.inicio.getTime() + DIA), "apresentacao");
    await agendarVisita({ leadId: lead.id, inicio: ap.inicio, consultorId: a.id, autor: "teste", tipo: "apresentacao" });
    expect(await etapa(lead.id)).toBe("apresentacao");
    expect(await db.visita.count({ where: { leadId: lead.id, status: "agendada" } })).toBe(3);
    for (const tipo of ["visita_agendada", "medicao_agendada", "apresentacao_agendada"]) expect(await contar(tipo)).toBe(1);
    // Painel: a medição virou apresentação; a apresentação ainda não virou venda.
    let painel = await dadosDoPainel({ atalho: "hoje" });
    expect(painel.conversoes).toEqual({ medicoes: 1, medicoesComApresentacao: 1, apresentacoes: 1, apresentacoesFechadas: 0 });
    expect(painel.indicadores.slice(0, 2).map((i) => [i.tipo, i.atual])).toEqual([["apresentacao_agendada", 1], ["medicao_agendada", 1]]);
    await moverEtapa(lead.id, "fechado", "teste", { dados: { valorFechado: 100000 } });
    painel = await dadosDoPainel({ atalho: "hoje", vendedorId: a.id });
    expect(painel.conversoes.apresentacoesFechadas).toBe(1);
    expect(painel.apresentacoesPorConsultor.find((c) => c.nome === a.nome)?.total).toBe(1);
  });

  it("o consultor mede ou apresenta, nunca os dois no mesmo horário (inclusive no meio da medição)", async () => {
    const [a] = await criarConsultores();
    const l1 = await obterOuCriarLead("+5588900005002");
    const l2 = await obterOuCriarLead("+5588900005003");
    const [m] = await horariosLivresParaLead(l1.id, 1, undefined, "medicao");
    await agendarVisita({ leadId: l1.id, inicio: m.inicio, consultorId: a.id, autor: "teste", tipo: "medicao" });
    // A medição vai das h às h+2: a apresentação de a às h+1 é recusada.
    await expect(agendarVisita({ leadId: l2.id, inicio: new Date(m.inicio.getTime() + HORA), consultorId: a.id, autor: "teste", tipo: "apresentacao" })).rejects.toThrow(/compromisso/);
    // O próprio lead também não marca a apresentação dele em cima da medição.
    await expect(agendarVisita({ leadId: l1.id, inicio: m.inicio, consultorId: a.id, autor: "teste", tipo: "apresentacao" })).rejects.toThrow(/compromisso/);
    // Os horários oferecidos para o consultor já pulam a medição.
    const livres = await horariosLivresParaLead(l2.id, 40, undefined, "apresentacao");
    expect(livres.some((v) => v.consultorId === a.id && v.inicio >= m.inicio && v.inicio < new Date(m.inicio.getTime() + 2 * HORA))).toBe(false);
  });

  it("Medição/Apresentação só recebem o card com o compromisso marcado; cancelar volta para Em qualificação", async () => {
    const [a] = await criarConsultores();
    const lead = await obterOuCriarLead("+5588900005004");
    await expect(moverEtapa(lead.id, "apresentacao", "teste")).rejects.toThrow(/Marque a apresentação/);
    await expect(conferirMudanca(lead.id, "medicao", {})).rejects.toThrow(/Marque a medição/);
    const [ap] = await horariosLivresParaLead(lead.id, 1, undefined, "apresentacao");
    const marcada = await agendarVisita({ leadId: lead.id, inicio: ap.inicio, consultorId: a.id, autor: "teste", tipo: "apresentacao" });
    expect(await etapa(lead.id)).toBe("apresentacao");
    await cancelarVisita(marcada.id, "teste");
    expect(await etapa(lead.id)).toBe("qualificacao");
  });

  it("marcar não volta o card de Negociação nem de Fechado; Perdido volta para o funil", async () => {
    const [a] = await criarConsultores();
    const lead = await obterOuCriarLead("+5588900005005");
    await moverEtapa(lead.id, "negociacao", "teste", { dados: { proximoContatoEm: new Date((await agora()).getTime() + DIA) } });
    const [v1, v2] = await horariosLivresParaLead(lead.id, 2, undefined, "apresentacao");
    await agendarVisita({ leadId: lead.id, inicio: v1.inicio, consultorId: a.id, autor: "teste", tipo: "apresentacao" });
    expect(await etapa(lead.id)).toBe("negociacao");
    await moverEtapa(lead.id, "perdido", "teste", { dados: { motivoPerda: "preco" } });
    await agendarVisita({ leadId: lead.id, inicio: v2.inicio, consultorId: a.id, autor: "teste", tipo: "apresentacao" });
    expect(await etapa(lead.id)).toBe("apresentacao");
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).motivoPerda).toBeNull();
  });

  it("converte os cards das colunas antigas uma vez", async () => {
    const l1 = await obterOuCriarLead("+5588900005006");
    const l2 = await obterOuCriarLead("+5588900005007");
    const l3 = await obterOuCriarLead("+5588900005008");
    await db.lead.update({ where: { id: l1.id }, data: { etapa: "visita" } });
    await db.lead.update({ where: { id: l2.id }, data: { etapa: "orcamento" } });
    await db.lead.update({ where: { id: l3.id }, data: { etapa: "sem_resposta", etapaAnterior: "novo" } });
    const l4 = await obterOuCriarLead("+5588900005009");
    await db.lead.update({ where: { id: l4.id }, data: { etapa: "pronto" } });
    expect(await converterFunilAntigo()).toBe(4);
    expect(await etapa(l4.id)).toBe("qualificacao");
    expect([await etapa(l1.id), await etapa(l2.id), await etapa(l3.id)]).toEqual(["apresentacao", "negociacao", "perdido"]);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l3.id } })).motivoPerda).toBe("parou_de_responder");
    expect(await converterFunilAntigo()).toBe(0);
  });
});

describe("regras da agenda editáveis (Configurações)", () => {
  it("o que o admin grava vale na hora para os horários oferecidos; regra inválida é recusada", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900007777");
    expect(await regrasDaAgenda()).toEqual(REGRAS_AGENDA_PADRAO);
    const horasPadrao = new Set((await horariosLivresParaLead(lead.id, 40)).map((v) => v.inicio.getUTCHours()));
    expect(horasPadrao.size).toBeGreaterThan(1);

    // Só abre às 10h, de segunda a sexta, visitas de 1h.
    const horario = REGRAS_AGENDA_PADRAO.horario.map((h, i) => (i >= 1 && i <= 5 ? { abre: 10, fecha: 11 } : null));
    await definirRegrasDaAgenda({ ...REGRAS_AGENDA_PADRAO, horario });
    const livres = await horariosLivresParaLead(lead.id, 40);
    expect(livres.length).toBeGreaterThan(0);
    expect(new Set(livres.map((v) => v.inicio.getTime() % DIA)).size).toBe(1);
    await expect(agendarVisita({ leadId: lead.id, inicio: new Date(livres[0].inicio.getTime() + HORA), autor: "bot" })).rejects.toThrow(/funcionamento/);

    await expect(definirRegrasDaAgenda({ ...REGRAS_AGENDA_PADRAO, duracaoMin: 5 })).rejects.toThrow();
    expect((await regrasDaAgenda()).horario).toEqual(horario);
  });
});

describe("arquivados excluídos em 30 dias (LIMP-04, LIMP-06)", () => {
  it("apaga lead, mensagens e mídias; métricas ficam", async () => {
    const r = await receberMensagemSemBot();
    await arquivarLeads([r.leadId], "teste");
    const midia = (await db.mensagem.findFirstOrThrow({ where: { leadId: r.leadId, midiaArquivo: { not: null } } })).midiaArquivo!;
    expect(existsSync(path.join(PASTA_MIDIAS, midia))).toBe(true);

    await avancarRelogio(29 * DIA);
    expect((await rodarRotinas()).excluidos).toBe(0);
    await avancarRelogio(1 * DIA + HORA);
    expect((await rodarRotinas()).excluidos).toBe(1);

    expect(await db.lead.count({ where: { id: r.leadId } })).toBe(0);
    expect(await db.mensagem.count({ where: { leadId: r.leadId } })).toBe(0);
    expect(existsSync(path.join(PASTA_MIDIAS, midia))).toBe(false);
    expect(await db.eventoMetrica.count({ where: { tipo: "lead_novo" } })).toBe(1);
  });
});

describe("clientes que fecharam: excluídos 180 dias depois do fechamento", () => {
  async function fecharLead(tel: string) {
    const lead = await obterOuCriarLead(tel);
    await db.lead.update({ where: { id: lead.id }, data: { etapa: "fechado", valorFechado: 100000 } });
    await db.mudancaEtapa.create({ data: { leadId: lead.id, de: "negociacao", para: "fechado", autor: "teste", criadoEm: await agora() } });
    return lead.id;
  }

  it("aos 179 dias fica; aos 180 apaga, registra só os 4 últimos dígitos e preserva as métricas", async () => {
    const id = await fecharLead("+5588900008888");
    await avancarRelogio(179 * DIA);
    expect((await rodarRotinas()).excluidos).toBe(0);
    await avancarRelogio(1 * DIA + HORA);
    const r = await rodarRotinas();
    expect(r.excluidos).toBe(1);
    expect(r.fechadosExcluidos).toBe(1);
    expect(await db.lead.count({ where: { id } })).toBe(0);
    const pedido = await db.pedidoLgpd.findFirstOrThrow();
    expect(pedido).toMatchObject({ acao: "exclusao", telefoneFim: "8888" });
    expect(pedido.quem).toMatch(/180/);
  });

  it("fechado e arquivado também espera 180 dias (não sai aos 30)", async () => {
    const id = await fecharLead("+5588900009999");
    await arquivarLeads([id], "teste");
    await avancarRelogio(31 * DIA);
    expect((await rodarRotinas()).excluidos).toBe(0);
    expect(await db.lead.count({ where: { id } })).toBe(1);
  });

  it("quem não fechou não é afetado pela regra dos 180 dias", async () => {
    const lead = await obterOuCriarLead("+5588900007000");
    await avancarRelogio(200 * DIA);
    expect((await rodarRotinas()).fechadosExcluidos).toBeUndefined();
    expect(await db.lead.count({ where: { id: lead.id } })).toBe(1);
  });
});

describe("bot sem chave da API (BOT-06)", () => {
  it("não derruba: marca aguardando humano com aviso", async () => {
    await criarRoteiroDeTeste();
    const chave = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const r = await receberMensagemCliente({ telefone: "+5588900005555", texto: "Oi" });
      expect(r.erro).toMatch(/chave/);
      const lead = await db.lead.findUniqueOrThrow({ where: { id: r.leadId } });
      expect(lead.aguardandoHumano).toBe(true);
      expect(lead.erroBot).toMatch(/chave/);
    } finally {
      if (chave !== undefined) process.env.ANTHROPIC_API_KEY = chave;
    }
  });
});

/** Mensagem com imagem, com o bot em modo humano (sem chamar a API). */
async function receberMensagemSemBot() {
  const lead = await obterOuCriarLead("+5588900006666");
  await db.lead.update({ where: { id: lead.id }, data: { modoAtendimento: "humano" } });
  return receberMensagemCliente({ telefone: "+5588900006666", texto: "Segue a planta", midia: { dados: PNG, tipo: "image/png" } });
}

describe("funil e arquivamento (MET-02, AGENDA-02)", () => {
  const contar = (tipo: string) => db.eventoMetrica.count({ where: { tipo } });

  it("Novo → Apresentação → remarcar → Fechado conta cada etapa uma vez", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900007777");
    const [v1, v2] = await horariosLivresParaLead(lead.id, 2);
    await agendarVisita({ leadId: lead.id, inicio: v1.inicio, autor: "teste", tipo: "apresentacao" });
    await agendarVisita({ leadId: lead.id, inicio: v2.inicio, autor: "teste", tipo: "apresentacao" });
    await moverEtapa(lead.id, "fechado", "teste", { dados: { valorFechado: 100000 } });
    await moverEtapa(lead.id, "novo", "teste");
    await moverEtapa(lead.id, "fechado", "teste", { dados: { valorFechado: 100000 } });
    for (const tipo of ["etapa_novo", "etapa_qualificacao", "etapa_apresentacao", "etapa_fechado", "apresentacao_agendada"]) expect(await contar(tipo)).toBe(1);
    expect(await contar("etapa_medicao")).toBe(0);
  });

  it("arquivar cancela a visita e libera o horário da loja", async () => {
    await criarConsultores();
    const l1 = await obterOuCriarLead("+5588900007778");
    const l2 = await obterOuCriarLead("+5588900007779");
    const [vaga] = await horariosLivresParaLead(l1.id, 1);
    await agendarVisita({ leadId: l1.id, inicio: vaga.inicio, autor: "teste" });
    await arquivarLeads([l1.id], "teste");
    expect(await db.visita.count({ where: { leadId: l1.id, status: "agendada" } })).toBe(0);
    await expect(agendarVisita({ leadId: l2.id, inicio: vaga.inicio, autor: "teste" })).resolves.toBeTruthy();
  });
});

describe("rodízio de leads e almoço (etapas H e I)", () => {
  it("rodízio alterna entre os consultores e pula quem está em almoço", async () => {
    const [a, b] = await criarConsultores();
    await definirModoDistribuicao("rodizio");
    expect(await escolherProximoConsultor()).toBe(a.id);
    expect(await escolherProximoConsultor()).toBe(b.id);
    expect(await escolherProximoConsultor()).toBe(a.id);

    await definirStatusConsultor(b.id, "almoco");
    expect(await escolherProximoConsultor()).toBe(a.id);
    expect(await escolherProximoConsultor()).toBe(a.id);

    await definirStatusConsultor(b.id, "online");
    expect(await escolherProximoConsultor()).toBe(b.id);
  });

  it("sem ninguém online o lead fica na fila e o primeiro que volta recebe", async () => {
    const [a, b] = await criarConsultores();
    await definirStatusConsultor(a.id, "almoco");
    await definirStatusConsultor(b.id, "almoco");
    expect(await escolherProximoConsultor()).toBeNull();

    const lead = await obterOuCriarLead("+5588900007777", "Cliente Fila");
    await db.lead.update({ where: { id: lead.id }, data: { modoAtendimento: "pausado", aguardandoHumano: true, consultorId: null } });
    expect(await distribuirFila()).toBe(0);

    await definirStatusConsultor(b.id, "online");
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).consultorId).toBe(b.id);
  });

  it("cliente que escreve no almoço recebe o aviso uma vez por almoço; o lead continua com o consultor", async () => {
    const [a] = await criarConsultores();
    const lead = await obterOuCriarLead("+5588900008888", "Cliente Almoço");
    await db.lead.update({ where: { id: lead.id }, data: { modoAtendimento: "pausado", aguardandoHumano: true, consultorId: a.id } });

    await registrarMensagemCliente(lead.id, "Oi, tudo bem?");
    expect(await db.mensagem.count({ where: { leadId: lead.id, texto: AVISO_ALMOCO } })).toBe(0);

    await definirStatusConsultor(a.id, "almoco");
    await registrarMensagemCliente(lead.id, "Cadê o consultor?");
    await registrarMensagemCliente(lead.id, "Alô?");
    expect(await db.mensagem.count({ where: { leadId: lead.id, texto: AVISO_ALMOCO } })).toBe(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).consultorId).toBe(a.id);

    await definirStatusConsultor(a.id, "online");
    await definirStatusConsultor(a.id, "almoco");
    await registrarMensagemCliente(lead.id, "Voltou?");
    expect(await db.mensagem.count({ where: { leadId: lead.id, texto: AVISO_ALMOCO } })).toBe(2);
  });
});
