import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { PASTA_MIDIAS } from "@/lib/midias";
import { avancarRelogio, agora } from "@/lib/relogio";
import { lerLista } from "@/lib/json";
import { DIA, HORA } from "@/regras/tempo";
import { janelaDeAgendamento } from "@/regras/agenda";
import { agendarVisita, criarBloqueio, horariosLivresParaLead } from "@/servicos/agenda";
import { AVISO_ALMOCO } from "@/regras/almoco";
import { REGRAS_AGENDA_PADRAO } from "@/regras/agenda";
import { definirModoDistribuicao, definirRegrasDaAgenda, regrasDaAgenda } from "@/servicos/configuracoes";
import { definirStatusConsultor, distribuirFila, escolherProximoConsultor } from "@/servicos/distribuicao";
import { arquivarLeads, moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { rodarRotinas } from "@/servicos/rotinas";
import { receberMensagemCliente } from "@/servicos/conversa";
import { criarConsultores, limparBanco } from "./ajuda";

// PNG mínimo válido (1x1).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

beforeEach(async () => {
  await limparBanco();
});

describe("retomada e Sem resposta com o relógio simulado (RET-01 a RET-03)", () => {
  it("envia uma única retomada, move para Sem resposta e volta quando o cliente responde", async () => {
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
    expect(atual.etapa).toBe("sem_resposta");

    // Muito tempo depois: continua uma retomada só.
    await avancarRelogio(10 * DIA);
    await rodarRotinas();
    expect(await db.mensagem.count({ where: { leadId: lead.id, modelo: "retomada" } })).toBe(1);

    await registrarMensagemCliente(lead.id, "Oi, ainda quero sim");
    atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atual.etapa).toBe("novo");
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
      agendarVisita({ leadId: l1.id, inicio: vaga.inicio, consultorId: a.id, autor: "teste" }),
      agendarVisita({ leadId: l2.id, inicio: vaga.inicio, consultorId: b.id, autor: "teste" }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.visita.count({ where: { inicio: vaga.inicio, status: "agendada" } })).toBe(1);
    // Remarcar conta a visita uma vez só no painel.
    const ok = resultados.findIndex((r) => r.status === "fulfilled");
    const leadOk = ok === 0 ? l1 : l2;
    const [outra] = (await horariosLivresParaLead(leadOk.id, 2)).slice(1);
    await agendarVisita({ leadId: leadOk.id, inicio: outra.inicio, autor: "teste" });
    expect(await db.eventoMetrica.count({ where: { tipo: "visita_agendada" } })).toBe(1);
    expect(await db.eventoMetrica.count({ where: { tipo: "etapa_pronto" } })).toBe(1);
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
    await agendarVisita({ leadId: lead.id, inicio: livres[0].inicio, autor: "bot" });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("visita");
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

describe("bot sem chave da API (BOT-06)", () => {
  it("não derruba: marca aguardando humano com aviso", async () => {
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
  return receberMensagemCliente({ telefone: "+5588900006666", texto: "Segue a planta", imagem: { dados: PNG, tipo: "image/png" } });
}

describe("funil e arquivamento (MET-02, AGENDA-02)", () => {
  const contar = (tipo: string) => db.eventoMetrica.count({ where: { tipo } });

  it("Novo → Visita → remarcar → Fechado conta cada etapa uma vez", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900007777");
    const [v1, v2] = await horariosLivresParaLead(lead.id, 2);
    await agendarVisita({ leadId: lead.id, inicio: v1.inicio, autor: "teste" });
    await agendarVisita({ leadId: lead.id, inicio: v2.inicio, autor: "teste" });
    await moverEtapa(lead.id, "fechado", "teste", { dados: { valorFechado: 100000 } });
    await moverEtapa(lead.id, "novo", "teste");
    await moverEtapa(lead.id, "fechado", "teste", { dados: { valorFechado: 100000 } });
    for (const tipo of ["etapa_novo", "etapa_pronto", "etapa_visita", "etapa_orcamento", "etapa_fechado", "visita_agendada"]) expect(await contar(tipo)).toBe(1);
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
