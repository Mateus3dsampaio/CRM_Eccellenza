import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { avaliarRede, REGRAS_REDE_PADRAO, validarRegrasRede, type EstadoRede, type RegrasRedeDeSeguranca } from "@/regras/rede-seguranca";
import { MOTIVO_SEM_RESPOSTA_AUTOMATICO } from "@/regras/recuperacao";
import { dataLocal } from "@/regras/tempo";
import { definirRegrasDaRedeDeSeguranca } from "@/servicos/configuracoes";
import { obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { rodarRotinas } from "@/servicos/rotinas";
import { limparBanco } from "./ajuda";

// Novembro de 2026, horário de Fortaleza.
const dia = (d: number, h = 9, m = 0) => dataLocal(2026, 11, d, h, m);

const R: RegrasRedeDeSeguranca = { ligado: true, dias: 5 };

const base: EstadoRede = {
  etapa: "novo",
  arquivadoEm: null,
  classificacao: null,
  modoAtendimento: "bot",
  aguardandoHumano: false,
  temVisitaFutura: false,
  proximoContatoEm: null,
  ultimaMsgClienteEm: dia(9),
};

describe("rede de segurança: regras puras", () => {
  it("de fábrica vem desligada, com 5 dias", () => {
    expect(REGRAS_REDE_PADRAO).toEqual({ ligado: false, dias: 5 });
    expect(validarRegrasRede(REGRAS_REDE_PADRAO)).toBeNull();
    expect(validarRegrasRede({ ligado: true, dias: 0 })).not.toBeNull();
    expect(validarRegrasRede({ ligado: true, dias: 61 })).not.toBeNull();
  });

  it("desligada: nada acontece", () => {
    expect(avaliarRede(base, { ...R, ligado: false }, dia(20))).toBeNull();
  });

  it("Perdido X dias depois da última mensagem do cliente, em relógio corrido", () => {
    expect(avaliarRede(base, R, dia(14, 8, 59))).toBeNull();
    expect(avaliarRede(base, R, dia(14))).toBe("perdido");
  });

  it("pós-venda vai direto para o arquivo", () => {
    expect(avaliarRede({ ...base, classificacao: "pos_venda" }, R, dia(14, 8, 59))).toBeNull();
    expect(avaliarRede({ ...base, classificacao: "pos_venda" }, R, dia(14))).toBe("arquivar");
  });

  it("retorno marcado para a frente segura o lead; retorno que já passou não", () => {
    expect(avaliarRede({ ...base, proximoContatoEm: dia(16) }, R, dia(15))).toBeNull();
    expect(avaliarRede({ ...base, proximoContatoEm: dia(12) }, R, dia(15))).toBe("perdido");
  });

  it.each([
    ["está em Perdido", { etapa: "perdido" }],
    ["está em Fechado", { etapa: "fechado" }],
    ["foi passado ao consultor (modo humano)", { modoAtendimento: "humano" }],
    ["bot pausado", { modoAtendimento: "pausado" }],
    ["aguarda um humano", { aguardandoHumano: true }],
    ["está arquivado", { arquivadoEm: dia(10) }],
    ["tem visita marcada", { temVisitaFutura: true }],
    ["nunca escreveu", { ultimaMsgClienteEm: null }],
  ])("não mexe se o lead %s", (_nome, mudanca) => {
    expect(avaliarRede({ ...base, ...mudanca }, R, dia(20))).toBeNull();
  });
});

// ---------------------------------------------------------------- com o banco

/** Lead que escreveu no dia 9 às 9h. `clientePorUltimo`: o cliente deu a última palavra (a loja não respondeu depois). */
async function montarLead(telefone: string, opcoes: { clientePorUltimo?: boolean; classificacao?: string } = {}) {
  vi.setSystemTime(dia(9, 8, 50));
  const lead = await obterOuCriarLead(telefone);
  await registrarMensagemCliente(lead.id, "Oi, quero uma cozinha");
  vi.setSystemTime(dia(9, 8, 55));
  await enviarMensagemLoja({ leadId: lead.id, autor: "bot", texto: "Olá! Qual ambiente você quer fazer?" });
  if (opcoes.clientePorUltimo) {
    vi.setSystemTime(dia(9));
    await registrarMensagemCliente(lead.id, "ok, obrigado");
  } else {
    await db.lead.update({ where: { id: lead.id }, data: { ultimaMsgClienteEm: dia(9) } });
  }
  if (opcoes.classificacao) await db.lead.update({ where: { id: lead.id }, data: { classificacao: opcoes.classificacao } });
  return lead.id;
}

const ler = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });
const retomadas = () => db.mensagem.count({ where: { autorNome: "Retomada automática" } });
async function em(quando: Date) {
  vi.setSystemTime(quando);
  await rodarRotinas();
}

describe("rede de segurança: rotina com o banco", () => {
  beforeEach(async () => {
    await limparBanco();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("cliente que deu a última palavra e sumiu vai para Perdido em 5 dias, e volta se escrever", async () => {
    await definirRegrasDaRedeDeSeguranca(R);
    const id = await montarLead("+5588900000091", { clientePorUltimo: true });
    await em(dia(14, 8, 59));
    expect((await ler(id)).etapa).toBe("novo");
    await em(dia(14));
    expect(await ler(id)).toMatchObject({ etapa: "perdido", motivoPerda: MOTIVO_SEM_RESPOSTA_AUTOMATICO });
    expect(await db.eventoMetrica.count({ where: { tipo: "rede_perdido" } })).toBe(1);
    vi.setSystemTime(dia(20));
    await registrarMensagemCliente(id, "Voltei, ainda quero");
    expect(await ler(id)).toMatchObject({ etapa: "novo", motivoPerda: null });
  });

  it("ligada: a retomada antiga não é mais enviada, e quem estava no meio dela sai pela rede", async () => {
    await definirRegrasDaRedeDeSeguranca(R);
    const id = await montarLead("+5588900000092");
    // Estava no meio da retomada antiga: recebeu o modelo no dia 12.
    await db.lead.update({ where: { id }, data: { retomadaEnviadaEm: dia(12) } });
    const novo = await montarLead("+5588900000093");
    await em(dia(13));
    expect(await retomadas()).toBe(0);
    expect((await ler(novo)).retomadaEnviadaEm).toBeNull();
    await em(dia(14));
    expect((await ler(id)).etapa).toBe("perdido");
    expect((await ler(novo)).etapa).toBe("perdido");
    // Uma vez só: rodar de novo não move nem conta de novo.
    await em(dia(17));
    expect(await db.eventoMetrica.count({ where: { tipo: "rede_perdido" } })).toBe(2);
    expect(await db.mudancaEtapa.count({ where: { leadId: id, para: "perdido" } })).toBe(1);
  });

  it("desligada (padrão de fábrica): a retomada antiga continua como antes", async () => {
    const id = await montarLead("+5588900000094");
    // Na retomada antiga a última mensagem precisa ser da loja (8h55): a do cliente volta para 8h50.
    await db.lead.update({ where: { id }, data: { ultimaMsgClienteEm: dia(9, 8, 50) } });
    await em(dia(13));
    expect((await ler(id)).retomadaEnviadaEm).not.toBeNull();
    expect(await db.eventoMetrica.count({ where: { tipo: "rede_perdido" } })).toBe(0);
  });

  it("pós-venda parado vai direto para o arquivo, sem passar por Perdido", async () => {
    await definirRegrasDaRedeDeSeguranca(R);
    const id = await montarLead("+5588900000095", { classificacao: "pos_venda" });
    await em(dia(14));
    const l = await ler(id);
    expect(l.arquivadoEm).not.toBeNull();
    expect(l.etapa).toBe("novo");
    expect(l.motivoPerda).toBeNull();
    expect(await db.eventoMetrica.count({ where: { tipo: "rede_arquivado" } })).toBe(1);
  });

  it("outra cidade com a regra dos desclassificados desligada leva o motivo próprio", async () => {
    await definirRegrasDaRedeDeSeguranca(R);
    const id = await montarLead("+5588900000096", { classificacao: "outra_cidade" });
    await em(dia(14));
    expect(await ler(id)).toMatchObject({ etapa: "perdido", motivoPerda: "outra_cidade_automatico" });
  });

  it("lead passado ao consultor não é tocado", async () => {
    await definirRegrasDaRedeDeSeguranca(R);
    const id = await montarLead("+5588900000097");
    await db.lead.update({ where: { id }, data: { modoAtendimento: "pausado", aguardandoHumano: true } });
    await em(dia(20));
    expect(await ler(id)).toMatchObject({ etapa: "novo", arquivadoEm: null });
  });
});
