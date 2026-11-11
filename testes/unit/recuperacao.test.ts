import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  avaliarRecuperacao,
  horarioDaSegunda,
  horarioPermitido,
  montarTextoRecuperacao,
  MOTIVO_SEM_RESPOSTA_AUTOMATICO,
  proximoHorarioPermitido,
  REGRAS_RECUPERACAO_PADRAO,
  TEXTO_PRIMEIRA_PADRAO,
  TEXTO_SEGUNDA_PADRAO,
  validarRegrasRecuperacao,
  type EstadoRecuperacao,
  type RegrasRecuperacao,
} from "@/regras/recuperacao";
import { dataLocal } from "@/regras/tempo";
import { definirRegrasDeRecuperacao } from "@/servicos/configuracoes";
import { obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { rodarRotinas } from "@/servicos/rotinas";
import { limparBanco } from "./ajuda";

// Segunda 09/11/2026 e terça 10/11/2026, horário de Fortaleza.
const seg = (h: number, m = 0) => dataLocal(2026, 11, 9, h, m);
const ter = (h: number, m = 0) => dataLocal(2026, 11, 10, h, m);

const R: RegrasRecuperacao = { ...REGRAS_RECUPERACAO_PADRAO, ligado: true, segundaModo: "horas", segundaHoras: 4 };

const base: EstadoRecuperacao = {
  etapa: "novo",
  arquivadoEm: null,
  classificacao: null,
  modoAtendimento: "bot",
  aguardandoHumano: false,
  naoReceberEm: null,
  temVisitaFutura: false,
  ultimaMsgClienteEm: seg(9, 0),
  ultimaMsgLojaEm: seg(9, 1),
  recuperacaoPrimeiraEm: null,
  recuperacaoSegundaEm: null,
  recuperacaoFalhou: false,
};

describe("recuperação de leads: regras puras", () => {
  it("os padrões são os combinados e a regra de fábrica vem desligada", () => {
    const p = REGRAS_RECUPERACAO_PADRAO;
    expect(p.ligado).toBe(false);
    expect([p.primeiraMin, p.horarioInicio, p.horarioFim, p.perdidoHoras]).toEqual([30, 8, 20, 5]);
    expect(p.primeiraTexto).toBe("Oi, {nome}! Continuo por aqui. Ficou alguma dúvida ou posso te ajudar em mais alguma coisa sobre o seu projeto?");
    expect(p.segundaTexto).toBe("Oi, {nome}! Passando só para não te deixar sem retorno. Se ainda tiver interesse no seu projeto, é só me responder por aqui que a gente continua de onde parou.");
    expect(validarRegrasRecuperacao(p)).toBeNull();
  });

  it("valida os campos", () => {
    expect(validarRegrasRecuperacao({ ...R, primeiraMin: 0 })).not.toBeNull();
    expect(validarRegrasRecuperacao({ ...R, segundaHoras: 30 })).not.toBeNull();
    expect(validarRegrasRecuperacao({ ...R, segundaHora: "25:00" })).not.toBeNull();
    expect(validarRegrasRecuperacao({ ...R, horarioInicio: 20, horarioFim: 8 })).not.toBeNull();
    expect(validarRegrasRecuperacao({ ...R, perdidoHoras: 0 })).not.toBeNull();
    expect(validarRegrasRecuperacao({ ...R, primeiraTexto: "  " })).not.toBeNull();
    expect(validarRegrasRecuperacao({ ...R, segundaModo: "outro" as never })).not.toBeNull();
  });

  it("texto: com nome usa o primeiro nome; sem nome 'Oi, {nome}!' vira 'Oi!'", () => {
    expect(montarTextoRecuperacao(TEXTO_PRIMEIRA_PADRAO, "Maria da Silva")).toBe("Oi, Maria! Continuo por aqui. Ficou alguma dúvida ou posso te ajudar em mais alguma coisa sobre o seu projeto?");
    expect(montarTextoRecuperacao(TEXTO_PRIMEIRA_PADRAO, null)).toBe("Oi! Continuo por aqui. Ficou alguma dúvida ou posso te ajudar em mais alguma coisa sobre o seu projeto?");
    expect(montarTextoRecuperacao(TEXTO_SEGUNDA_PADRAO, "  ")).toMatch(/^Oi! Passando só/);
  });

  it("horário permitido: dentro, antes de abrir e depois de fechar", () => {
    expect(horarioPermitido(seg(8, 0), R)).toBe(true);
    expect(horarioPermitido(seg(19, 59), R)).toBe(true);
    expect(horarioPermitido(seg(20, 0), R)).toBe(false);
    expect(horarioPermitido(seg(7, 59), R)).toBe(false);
    expect(proximoHorarioPermitido(seg(7, 0), R)).toEqual(seg(8, 0));
    expect(proximoHorarioPermitido(seg(21, 0), R)).toEqual(ter(8, 0));
    expect(proximoHorarioPermitido(seg(12, 0), R)).toEqual(seg(12, 0));
  });

  describe("2ª mensagem: horário", () => {
    it("modo 'após X horas'", () => {
      expect(horarioDaSegunda(seg(9, 31), seg(9, 0), R)).toEqual(seg(13, 31));
    });

    it("modo 'dia seguinte às HH:MM'", () => {
      const dia = { ...R, segundaModo: "dia_seguinte" as const, segundaHora: "10:00" };
      expect(horarioDaSegunda(seg(14, 30), seg(14, 0), dia)).toEqual(ter(10, 0));
    });

    it("cai fora do horário permitido: espera o próximo horário válido (se ainda cabe na janela)", () => {
      // 18:30 + 4h = 22:30 → terça 8h; a janela (cliente 17h) vai até terça 17h.
      expect(horarioDaSegunda(seg(18, 30), seg(17, 0), R)).toEqual(ter(8, 0));
    });

    it("cai fora da janela: antecipa para o fim do mesmo dia, ainda dentro da janela (com folga de 5 min)", () => {
      const dia = { ...R, segundaModo: "dia_seguinte" as const, segundaHora: "10:00" };
      // Cliente segunda 9h: a janela fecha terça 9h; terça 10h não cabe → terça 8h55.
      expect(horarioDaSegunda(seg(9, 30), seg(9, 0), dia)).toEqual(ter(8, 55));
      // Horas: 16h + 5h = 21h (fora do horário) → terça 8h, mas a janela (cliente 8h) fecha terça 8h → antecipa para segunda 19h55.
      expect(horarioDaSegunda(seg(16, 0), seg(8, 0), { ...R, segundaHoras: 5 })).toEqual(seg(19, 55));
    });

    it("nem antecipando cabe: não envia", () => {
      const dia = { ...R, segundaModo: "dia_seguinte" as const, segundaHora: "10:00" };
      // Cliente segunda 7h30: a janela fecha terça 7h30, antes de o horário permitido abrir (8h) no mesmo dia.
      expect(horarioDaSegunda(seg(8, 0), seg(7, 30), dia)).toBeNull();
    });
  });

  describe("quando agir", () => {
    it("desligada: nada acontece", () => {
      expect(avaliarRecuperacao(base, { ...R, ligado: false }, seg(10, 0))).toBeNull();
    });

    it("1ª mensagem: só depois de X minutos da nossa última mensagem", () => {
      expect(avaliarRecuperacao(base, R, seg(9, 30))).toBeNull();
      expect(avaliarRecuperacao(base, R, seg(9, 31))).toBe("enviar_primeira");
    });

    it("1ª mensagem: exige que a última mensagem seja nossa", () => {
      expect(avaliarRecuperacao({ ...base, ultimaMsgLojaEm: seg(8, 50) }, R, seg(11, 0))).toBeNull();
      expect(avaliarRecuperacao({ ...base, ultimaMsgLojaEm: null }, R, seg(11, 0))).toBeNull();
      expect(avaliarRecuperacao({ ...base, ultimaMsgClienteEm: null }, R, seg(11, 0))).toBeNull();
    });

    it("1ª mensagem: fora do horário permitido espera o próximo horário válido, desde que ainda na janela", () => {
      const noite = { ...base, ultimaMsgClienteEm: seg(19, 50), ultimaMsgLojaEm: seg(19, 51) };
      expect(avaliarRecuperacao(noite, R, seg(20, 30))).toBeNull(); // 20h30 já é fora do horário
      expect(avaliarRecuperacao(noite, R, ter(7, 59))).toBeNull();
      expect(avaliarRecuperacao(noite, R, ter(8, 0))).toBe("enviar_primeira"); // ainda dentro das 24h (fecham 19h50)
    });

    it("nenhuma mensagem sai fora da janela de 24h", () => {
      expect(avaliarRecuperacao(base, R, ter(9, 5))).toBeNull();
      const tarde = { ...base, ultimaMsgClienteEm: seg(10, 0), ultimaMsgLojaEm: seg(10, 1) };
      expect(avaliarRecuperacao(tarde, R, ter(10, 1))).toBeNull();
      const segunda = { ...base, recuperacaoPrimeiraEm: seg(9, 31) };
      expect(avaliarRecuperacao(segunda, { ...R, segundaModo: "dia_seguinte", segundaHora: "10:00" }, ter(10, 0))).toBeNull(); // janela fechou terça 9h
    });

    it("2ª mensagem: depois de X horas da 1ª; se o cliente respondeu, cancela", () => {
      const e = { ...base, recuperacaoPrimeiraEm: seg(9, 31) };
      expect(avaliarRecuperacao(e, R, seg(13, 30))).toBeNull();
      expect(avaliarRecuperacao(e, R, seg(13, 31))).toBe("enviar_segunda");
      expect(avaliarRecuperacao({ ...e, ultimaMsgClienteEm: seg(10, 0) }, R, seg(13, 31))).toBeNull();
    });

    it("2ª mensagem antecipada sai na janela curta antes do fim, e não depois do fim da janela", () => {
      const dia = { ...R, segundaModo: "dia_seguinte" as const, segundaHora: "10:00" };
      const e = { ...base, recuperacaoPrimeiraEm: seg(9, 31) };
      expect(avaliarRecuperacao(e, dia, ter(8, 54))).toBeNull();
      expect(avaliarRecuperacao(e, dia, ter(8, 55))).toBe("enviar_segunda");
      expect(avaliarRecuperacao(e, dia, ter(9, 0))).toBeNull();
    });

    it("Perdido: X horas da 2ª mensagem, em relógio corrido (mesmo fora do horário permitido)", () => {
      const e = { ...base, recuperacaoPrimeiraEm: seg(9, 31), recuperacaoSegundaEm: seg(13, 31) };
      expect(avaliarRecuperacao(e, R, seg(18, 30))).toBeNull();
      expect(avaliarRecuperacao(e, R, seg(18, 31))).toBe("mover_perdido");
      expect(avaliarRecuperacao({ ...e, recuperacaoSegundaEm: seg(17, 0) }, R, seg(22, 30))).toBe("mover_perdido"); // 22h30 está fora do horário
    });

    it("2ª desligada: não envia a 2ª e o prazo até Perdido conta da 1ª", () => {
      const sem = { ...R, segundaLigada: false };
      const e = { ...base, recuperacaoPrimeiraEm: seg(9, 31) };
      expect(avaliarRecuperacao(e, sem, seg(13, 31))).toBeNull();
      expect(avaliarRecuperacao(e, sem, seg(14, 30))).toBeNull();
      expect(avaliarRecuperacao(e, sem, seg(14, 31))).toBe("mover_perdido");
      expect(avaliarRecuperacao({ ...e, ultimaMsgClienteEm: seg(10, 0) }, sem, seg(23, 0))).toBeNull();
    });

    it("se o cliente respondeu depois da 2ª, não vai para Perdido", () => {
      const e = { ...base, recuperacaoPrimeiraEm: seg(9, 31), recuperacaoSegundaEm: seg(13, 31), ultimaMsgClienteEm: seg(14, 0) };
      expect(avaliarRecuperacao(e, R, seg(23, 0))).toBeNull();
    });

    it("uma vez por lead: com a 1ª já enviada, quem respondeu e sumiu de novo não recebe mais nada", () => {
      const respondeuEDepoisSumiu = { ...base, recuperacaoPrimeiraEm: seg(9, 31), ultimaMsgClienteEm: seg(10, 0), ultimaMsgLojaEm: seg(10, 1) };
      expect(avaliarRecuperacao(respondeuEDepoisSumiu, R, seg(11, 0))).toBeNull();
      expect(avaliarRecuperacao(respondeuEDepoisSumiu, R, seg(23, 0))).toBeNull();
      const aposSegunda = { ...respondeuEDepoisSumiu, recuperacaoSegundaEm: seg(13, 31), ultimaMsgClienteEm: seg(14, 0), ultimaMsgLojaEm: seg(14, 1) };
      expect(avaliarRecuperacao(aposSegunda, R, ter(10, 0))).toBeNull();
    });

    it("um envio que falhou encerra o ciclo (sem 2ª mensagem nem Perdido)", () => {
      expect(avaliarRecuperacao({ ...base, recuperacaoFalhou: true }, R, seg(10, 0))).toBeNull();
      const falhou = { ...base, recuperacaoPrimeiraEm: seg(9, 31), recuperacaoSegundaEm: seg(13, 31), recuperacaoFalhou: true };
      expect(avaliarRecuperacao(falhou, R, seg(23, 0))).toBeNull();
    });

    it.each([
      ["pediu PARAR", { naoReceberEm: seg(9, 10) }],
      ["está em Perdido", { etapa: "perdido" }],
      ["está em Fechado", { etapa: "fechado" }],
      ["foi passado ao consultor (modo humano)", { modoAtendimento: "humano" }],
      ["bot pausado", { modoAtendimento: "pausado" }],
      ["aguarda um humano", { aguardandoHumano: true }],
      ["está arquivado", { arquivadoEm: seg(9, 10) }],
      ["é pós-venda", { classificacao: "pos_venda" }],
      ["tem visita marcada", { temVisitaFutura: true }],
    ])("não dispara se o lead %s", (_nome, mudanca) => {
      expect(avaliarRecuperacao({ ...base, ...mudanca }, R, seg(10, 0))).toBeNull();
      const segunda = { ...base, ...mudanca, recuperacaoPrimeiraEm: seg(9, 31) };
      expect(avaliarRecuperacao(segunda, R, seg(13, 31))).toBeNull();
      const perdido = { ...segunda, recuperacaoSegundaEm: seg(13, 31) };
      expect(avaliarRecuperacao(perdido, R, seg(18, 31))).toBeNull();
    });
  });
});

// ---------------------------------------------------------------- com o banco

const TEL = "+5588900000071";

/** Lead que escreveu segunda 9h e foi respondido pela loja às 9h01. */
async function montarLead(telefone = TEL, ajustes: Record<string, unknown> = {}) {
  vi.setSystemTime(seg(9, 0));
  const lead = await obterOuCriarLead(telefone);
  await db.lead.update({ where: { id: lead.id }, data: { nome: "Maria da Silva" } });
  await registrarMensagemCliente(lead.id, "Oi, quero uma cozinha");
  vi.setSystemTime(seg(9, 1));
  await enviarMensagemLoja({ leadId: lead.id, autor: "bot", texto: "Olá! Qual ambiente você quer fazer?" });
  if (Object.keys(ajustes).length) await db.lead.update({ where: { id: lead.id }, data: ajustes });
  return lead.id;
}

const ler = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });
const recuperacoes = (id: string) => db.mensagem.findMany({ where: { leadId: id, autorNome: "Recuperação automática" }, orderBy: { enviadaEm: "asc" } });
const eventos = (tipo: string) => db.eventoMetrica.count({ where: { tipo } });
async function em(quando: Date) {
  vi.setSystemTime(quando);
  await rodarRotinas();
}
async function ligar(mudancas: Partial<RegrasRecuperacao> = {}) {
  await definirRegrasDeRecuperacao({ ...R, ...mudancas });
}

describe("recuperação de leads: rotina com o banco", () => {
  beforeEach(async () => {
    await limparBanco();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("2ª mensagem desligada na tela: só a 1ª sai e o lead vai para Perdido X horas depois dela", async () => {
    await ligar({ segundaLigada: false });
    const id = await montarLead();
    await em(seg(9, 31));
    await em(seg(13, 31));
    expect(await recuperacoes(id)).toHaveLength(1);
    await em(seg(14, 30));
    expect((await ler(id)).etapa).toBe("novo");
    await em(seg(14, 31));
    const l = await ler(id);
    expect(l.etapa).toBe("perdido");
    expect(l.motivoPerda).toBe(MOTIVO_SEM_RESPOSTA_AUTOMATICO);
    expect(await recuperacoes(id)).toHaveLength(1);
    expect(await eventos("recuperacao_segunda")).toBe(0);
  });

  it("desligada (padrão de fábrica): nada é enviado nem movido", async () => {
    const id = await montarLead();
    await em(seg(9, 40));
    await em(ter(8, 0));
    expect(await recuperacoes(id)).toHaveLength(0);
    expect((await ler(id)).etapa).toBe("novo");
  });

  it("fluxo completo no modo 'após X horas': 1ª, 2ª e Perdido com o motivo certo", async () => {
    await ligar();
    const id = await montarLead();
    await em(seg(9, 30));
    expect(await recuperacoes(id)).toHaveLength(0);

    await em(seg(9, 31));
    let msgs = await recuperacoes(id);
    expect(msgs.map((m) => m.texto)).toEqual(["Oi, Maria! Continuo por aqui. Ficou alguma dúvida ou posso te ajudar em mais alguma coisa sobre o seu projeto?"]);
    expect(msgs[0].autor).toBe("sistema");
    expect(msgs[0].status).toBe("enviado");
    await em(seg(9, 32)); // não repete
    expect(await recuperacoes(id)).toHaveLength(1);

    await em(seg(13, 30));
    expect(await recuperacoes(id)).toHaveLength(1);
    await em(seg(13, 31));
    msgs = await recuperacoes(id);
    expect(msgs).toHaveLength(2);
    expect(msgs[1].texto).toBe("Oi, Maria! Passando só para não te deixar sem retorno. Se ainda tiver interesse no seu projeto, é só me responder por aqui que a gente continua de onde parou.");
    await em(seg(13, 32));
    expect(await recuperacoes(id)).toHaveLength(2);

    await em(seg(18, 30));
    expect((await ler(id)).etapa).toBe("novo");
    await em(seg(18, 31));
    const lead = await ler(id);
    expect(lead.etapa).toBe("perdido");
    expect(lead.motivoPerda).toBe(MOTIVO_SEM_RESPOSTA_AUTOMATICO);
    expect(lead.etapaAnterior).toBe("novo");
    const motivo = await db.motivoPerda.findUnique({ where: { codigo: MOTIVO_SEM_RESPOSTA_AUTOMATICO } });
    expect(motivo?.nome).toBe("Sem resposta (automático)");

    expect(await eventos("recuperacao_primeira")).toBe(1);
    expect(await eventos("recuperacao_segunda")).toBe(1);
    expect(await eventos("recuperacao_perdido")).toBe(1);
    // O "Parou de responder" é outro motivo e outro contador.
    expect(await eventos("sem_resposta")).toBe(0);
  });

  it("modo 'dia seguinte às HH:MM': a 2ª sai na terça no horário escolhido", async () => {
    await ligar({ segundaModo: "dia_seguinte", segundaHora: "10:00" });
    // Cliente escreve às 14h: a janela vai até terça 14h.
    vi.setSystemTime(seg(14, 0));
    const lead = await obterOuCriarLead("+5588900000072");
    await registrarMensagemCliente(lead.id, "Oi");
    vi.setSystemTime(seg(14, 1));
    await enviarMensagemLoja({ leadId: lead.id, autor: "bot", texto: "Olá!" });
    await em(seg(14, 31));
    expect(await recuperacoes(lead.id)).toHaveLength(1);
    await em(seg(23, 0));
    expect(await recuperacoes(lead.id)).toHaveLength(1);
    await em(ter(9, 59));
    expect(await recuperacoes(lead.id)).toHaveLength(1);
    await em(ter(10, 0));
    expect(await recuperacoes(lead.id)).toHaveLength(2);
    // Perdido 5 horas depois, em relógio corrido.
    await em(ter(14, 59));
    expect((await ler(lead.id)).etapa).toBe("novo");
    await em(ter(15, 0));
    expect((await ler(lead.id)).etapa).toBe("perdido");
  });

  it("2ª fora da janela de 24h é antecipada para o fim do mesmo dia", async () => {
    await ligar({ segundaModo: "dia_seguinte", segundaHora: "10:00" });
    const id = await montarLead(); // cliente 9h: janela até terça 9h
    await em(seg(9, 31));
    await em(ter(8, 54));
    expect(await recuperacoes(id)).toHaveLength(1);
    await em(ter(8, 55));
    expect(await recuperacoes(id)).toHaveLength(2);
  });

  it("se nem antecipando cabe, a 2ª não sai e o lead fica onde está (nunca vai para Perdido)", async () => {
    await ligar({ segundaModo: "dia_seguinte", segundaHora: "10:00" });
    // Cliente escreve segunda 7h30 (antes do horário permitido); a 1ª espera até as 8h.
    vi.setSystemTime(seg(7, 30));
    const lead = await obterOuCriarLead("+5588900000073");
    await registrarMensagemCliente(lead.id, "Bom dia");
    vi.setSystemTime(seg(7, 31));
    await enviarMensagemLoja({ leadId: lead.id, autor: "bot", texto: "Olá!" });
    await em(seg(8, 5));
    expect(await recuperacoes(lead.id)).toHaveLength(1);
    await em(ter(7, 20));
    await em(ter(8, 5));
    await em(ter(23, 0));
    expect(await recuperacoes(lead.id)).toHaveLength(1);
    const l = await ler(lead.id);
    expect(l.etapa).toBe("novo");
    expect(l.recuperacaoSegundaEm).toBeNull();
  });

  it("horário permitido: a 1ª que cairia à noite espera o dia seguinte às 8h (ainda dentro da janela)", async () => {
    await ligar();
    vi.setSystemTime(seg(19, 50));
    const lead = await obterOuCriarLead("+5588900000074");
    await registrarMensagemCliente(lead.id, "Oi");
    vi.setSystemTime(seg(19, 51));
    await enviarMensagemLoja({ leadId: lead.id, autor: "bot", texto: "Olá!" });
    await em(seg(20, 30));
    await em(seg(23, 0));
    await em(ter(7, 59));
    expect(await recuperacoes(lead.id)).toHaveLength(0);
    await em(ter(8, 0));
    expect(await recuperacoes(lead.id)).toHaveLength(1);
  });

  it("cliente respondeu depois da 1ª: cancela a 2ª e o Perdido; a resposta conta no painel", async () => {
    await ligar();
    const id = await montarLead();
    await em(seg(9, 31));
    vi.setSystemTime(seg(10, 0));
    await registrarMensagemCliente(id, "Tenho sim, uma dúvida");
    expect(await eventos("recuperacao_respondeu_primeira")).toBe(1);
    vi.setSystemTime(seg(10, 1));
    await enviarMensagemLoja({ leadId: id, autor: "bot", texto: "Claro, pode falar" });
    await em(seg(13, 31));
    await em(seg(20, 0));
    await em(ter(8, 0));
    expect(await recuperacoes(id)).toHaveLength(1);
    expect((await ler(id)).etapa).toBe("novo");
  });

  it("uma vez por lead: respondeu, sumiu de novo e não recebe mais recuperação", async () => {
    await ligar();
    const id = await montarLead();
    await em(seg(9, 31));
    vi.setSystemTime(seg(10, 0));
    await registrarMensagemCliente(id, "Oi de novo");
    vi.setSystemTime(seg(10, 1));
    await enviarMensagemLoja({ leadId: id, autor: "bot", texto: "Me conta mais" });
    await em(seg(10, 40));
    await em(seg(14, 30));
    await em(seg(19, 0));
    expect(await recuperacoes(id)).toHaveLength(1);
    expect((await ler(id)).etapa).toBe("novo"); // fica na coluna para o consultor
  });

  it("cliente respondeu depois da 2ª: não vai para Perdido; a resposta conta", async () => {
    await ligar();
    const id = await montarLead();
    await em(seg(9, 31));
    await em(seg(13, 31));
    vi.setSystemTime(seg(15, 0));
    await registrarMensagemCliente(id, "Oi, ainda quero");
    expect(await eventos("recuperacao_respondeu_segunda")).toBe(1);
    expect(await eventos("recuperacao_respondeu_primeira")).toBe(0);
    await em(seg(20, 0));
    expect((await ler(id)).etapa).toBe("novo");
  });

  it("depois do Perdido automático, o cliente que escreve volta para a coluna em que estava (funciona com o motivo novo)", async () => {
    await ligar();
    const id = await montarLead();
    await em(seg(9, 31));
    await em(seg(13, 31));
    await em(seg(18, 31));
    expect((await ler(id)).etapa).toBe("perdido");
    vi.setSystemTime(ter(9, 0));
    await registrarMensagemCliente(id, "Desculpa a demora, ainda quero");
    const l = await ler(id);
    expect(l.etapa).toBe("novo");
    expect(l.motivoPerda).toBeNull();
    // E não recebe recuperação de novo.
    vi.setSystemTime(ter(9, 1));
    await enviarMensagemLoja({ leadId: id, autor: "bot", texto: "Que bom!" });
    await em(ter(11, 0));
    expect(await recuperacoes(id)).toHaveLength(2);
  });

  it.each([
    ["pediu PARAR", { naoReceberEm: seg(9, 10) }],
    ["está em Perdido", { etapa: "perdido", motivoPerda: "preco" }],
    ["foi passado ao consultor", { modoAtendimento: "humano" }],
    ["está com o bot pausado", { modoAtendimento: "pausado", aguardandoHumano: true }],
  ])("não envia nada se o lead %s", async (_nome, ajustes) => {
    await ligar();
    const id = await montarLead(TEL, ajustes);
    await em(seg(9, 31));
    await em(seg(13, 31));
    await em(seg(18, 31));
    expect(await recuperacoes(id)).toHaveLength(0);
    const l = await ler(id);
    expect(l.recuperacaoPrimeiraEm).toBeNull();
    expect(l.motivoPerda).not.toBe(MOTIVO_SEM_RESPOSTA_AUTOMATICO);
  });

  it("consultor assume depois da 1ª: a 2ª e o Perdido são cancelados", async () => {
    await ligar();
    const id = await montarLead();
    await em(seg(9, 31));
    await db.lead.update({ where: { id }, data: { modoAtendimento: "humano" } });
    await em(seg(13, 31));
    await em(seg(18, 31));
    expect(await recuperacoes(id)).toHaveLength(1);
    expect((await ler(id)).etapa).toBe("novo");
  });

  it("só vai para Perdido se a 2ª foi realmente enviada: envio que falha deixa o lead onde está", async () => {
    await ligar();
    // Número terminado em 0000 "não tem WhatsApp" no simulador: o envio falha.
    const id = await montarLead("+5588900000000", { ultimaMsgLojaEm: seg(9, 1) });
    await em(seg(9, 31));
    const l = await ler(id);
    expect(l.recuperacaoFalhou).toBe(true);
    await em(seg(13, 31));
    await em(seg(18, 31));
    await em(ter(8, 0));
    const depois = await ler(id);
    expect(depois.etapa).toBe("novo");
    expect(depois.motivoPerda).toBeNull();
    expect(await eventos("recuperacao_primeira")).toBe(0);
    expect(await eventos("recuperacao_perdido")).toBe(0);
    expect((await recuperacoes(id)).every((m) => m.status === "falhou")).toBe(true);
    expect(await recuperacoes(id)).toHaveLength(1); // não tenta de novo a cada minuto
  });

  it("lead sem nome na ficha: a mensagem começa com 'Oi!'", async () => {
    await ligar();
    const id = await montarLead();
    await db.lead.update({ where: { id }, data: { nome: null } });
    await em(seg(9, 31));
    expect((await recuperacoes(id))[0].texto).toMatch(/^Oi! Continuo por aqui\./);
  });

  it("textos editados na tela valem", async () => {
    await ligar({ primeiraTexto: "Olá {nome}, tudo certo por aí?" });
    const id = await montarLead();
    await em(seg(9, 31));
    expect((await recuperacoes(id))[0].texto).toBe("Olá Maria, tudo certo por aí?");
  });
});
