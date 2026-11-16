import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  avaliarDesclassificado,
  MOTIVOS_DESCLASSIFICADO,
  REGRAS_DESCLASSIFICADOS_PADRAO,
  validarRegrasDesclassificados,
  type EstadoDesclassificado,
  type RegrasDesclassificados,
} from "@/regras/desclassificados";
import { avaliarRecuperacao, REGRAS_RECUPERACAO_PADRAO, type EstadoRecuperacao } from "@/regras/recuperacao";
import { CLASSIFICACOES } from "@/regras/etapas";
import { dataLocal } from "@/regras/tempo";
import { definirRegrasDeDesclassificados, definirRegrasDeRecuperacao } from "@/servicos/configuracoes";
import { obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { rodarRotinas } from "@/servicos/rotinas";
import { limparBanco } from "./ajuda";

// Segunda 09/11/2026 e terça 10/11/2026, horário de Fortaleza.
const seg = (h: number, m = 0) => dataLocal(2026, 11, 9, h, m);
const ter = (h: number, m = 0) => dataLocal(2026, 11, 10, h, m);

const R: RegrasDesclassificados = { ligado: true, horas: 24 };

const base: EstadoDesclassificado = {
  etapa: "novo",
  arquivadoEm: null,
  classificacao: "outra_cidade",
  modoAtendimento: "bot",
  aguardandoHumano: false,
  temVisitaFutura: false,
  ultimaMsgClienteEm: seg(9, 0),
};

describe("desclassificados: regras puras", () => {
  it("de fábrica vem desligado, com 24 horas", () => {
    expect(REGRAS_DESCLASSIFICADOS_PADRAO).toEqual({ ligado: false, horas: 24 });
    expect(validarRegrasDesclassificados(REGRAS_DESCLASSIFICADOS_PADRAO)).toBeNull();
    expect(validarRegrasDesclassificados({ ligado: true, horas: 0 })).not.toBeNull();
    expect(validarRegrasDesclassificados({ ligado: true, horas: 200 })).not.toBeNull();
  });

  it("toda classificação com motivo existe no CRM", () => {
    for (const codigo of Object.keys(MOTIVOS_DESCLASSIFICADO)) expect(Object.keys(CLASSIFICACOES)).toContain(codigo);
  });

  it("desligado: nada acontece", () => {
    expect(avaliarDesclassificado(base, { ...R, ligado: false }, ter(10, 0))).toBeNull();
  });

  it("outra cidade e curioso / sem perfil: Perdido X horas depois da última mensagem do cliente, cada um com o seu motivo", () => {
    expect(avaliarDesclassificado(base, R, ter(8, 59))).toBeNull();
    expect(avaliarDesclassificado(base, R, ter(9, 0))).toBe("outra_cidade_automatico");
    expect(avaliarDesclassificado({ ...base, classificacao: "curioso" }, R, ter(9, 0))).toBe("sem_perfil_automatico");
  });

  it.each(["qualificado", "parceiro", "ja_atendido", "pos_venda", null])("classificação %s fica de fora", (classificacao) => {
    expect(avaliarDesclassificado({ ...base, classificacao }, R, ter(12, 0))).toBeNull();
  });

  it.each([
    ["está em Perdido", { etapa: "perdido" }],
    ["está em Fechado", { etapa: "fechado" }],
    ["foi passado ao consultor (modo humano)", { modoAtendimento: "humano" }],
    ["bot pausado", { modoAtendimento: "pausado" }],
    ["aguarda um humano", { aguardandoHumano: true }],
    ["está arquivado", { arquivadoEm: seg(9, 10) }],
    ["tem visita marcada", { temVisitaFutura: true }],
    ["nunca escreveu", { ultimaMsgClienteEm: null }],
  ])("não move se o lead %s", (_nome, mudanca) => {
    expect(avaliarDesclassificado({ ...base, ...mudanca }, R, ter(12, 0))).toBeNull();
  });

  it("recuperação: com a regra ligada, desclassificado não recebe mensagem nem vai para Perdido por ela; desligada, tudo como antes", () => {
    const regras = { ...REGRAS_RECUPERACAO_PADRAO, ligado: true };
    const lead: EstadoRecuperacao = {
      ...base,
      naoReceberEm: null,
      ultimaMsgLojaEm: seg(9, 1),
      recuperacaoPrimeiraEm: null,
      recuperacaoSegundaEm: null,
      recuperacaoFalhou: false,
    };
    for (const classificacao of ["outra_cidade", "curioso"]) {
      expect(avaliarRecuperacao({ ...lead, classificacao }, regras, seg(10, 0), true)).toBeNull();
      expect(avaliarRecuperacao({ ...lead, classificacao }, regras, seg(10, 0), false)).toBe("enviar_primeira");
      expect(avaliarRecuperacao({ ...lead, classificacao }, regras, seg(10, 0))).toBe("enviar_primeira");
    }
    expect(avaliarRecuperacao({ ...lead, classificacao: "qualificado" }, regras, seg(10, 0), true)).toBe("enviar_primeira");
  });
});

// ---------------------------------------------------------------- com o banco

/** Lead que escreveu segunda 9h, foi respondido pela loja às 9h01 e recebeu a classificação. */
async function montarLead(classificacao: string, telefone = "+5588900000081") {
  vi.setSystemTime(seg(9, 0));
  const lead = await obterOuCriarLead(telefone);
  await registrarMensagemCliente(lead.id, "Oi, vocês fazem só as portas?");
  vi.setSystemTime(seg(9, 1));
  await enviarMensagemLoja({ leadId: lead.id, autor: "bot", texto: "Olá! Infelizmente não fazemos esse tipo de serviço." });
  await db.lead.update({ where: { id: lead.id }, data: { classificacao } });
  return lead.id;
}

const ler = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });
const recuperacoes = (id: string) => db.mensagem.count({ where: { leadId: id, autorNome: "Recuperação automática" } });
async function em(quando: Date) {
  vi.setSystemTime(quando);
  await rodarRotinas();
}

describe("desclassificados: rotina com o banco", () => {
  beforeEach(async () => {
    await limparBanco();
    vi.useFakeTimers({ toFake: ["Date"] });
    await definirRegrasDeRecuperacao({ ...REGRAS_RECUPERACAO_PADRAO, ligado: true });
  });
  afterEach(() => vi.useRealTimers());

  it("ligado: sem mensagem de recuperação e Perdido em 24 h com o motivo certo, criado sozinho", async () => {
    await definirRegrasDeDesclassificados(R);
    const cidade = await montarLead("outra_cidade");
    const perfil = await montarLead("curioso", "+5588900000082");
    await em(seg(10, 0));
    await em(ter(8, 59));
    for (const id of [cidade, perfil]) {
      expect(await recuperacoes(id)).toBe(0);
      expect((await ler(id)).etapa).toBe("novo");
    }
    await em(ter(9, 0));
    expect(await ler(cidade)).toMatchObject({ etapa: "perdido", motivoPerda: "outra_cidade_automatico" });
    expect(await ler(perfil)).toMatchObject({ etapa: "perdido", motivoPerda: "sem_perfil_automatico" });
    expect((await db.motivoPerda.findUniqueOrThrow({ where: { codigo: "sem_perfil_automatico" } })).nome).toBe("Curioso / sem perfil (automático)");
    expect(await db.eventoMetrica.count({ where: { tipo: "desclassificado_perdido" } })).toBe(2);
    expect(await recuperacoes(cidade)).toBe(0);
  });

  it("o cliente que escreve depois volta para a coluna em que estava", async () => {
    await definirRegrasDeDesclassificados(R);
    const id = await montarLead("outra_cidade");
    await em(ter(9, 0));
    expect((await ler(id)).etapa).toBe("perdido");
    vi.setSystemTime(ter(15, 0));
    await registrarMensagemCliente(id, "Na verdade o projeto é em Juazeiro");
    expect(await ler(id)).toMatchObject({ etapa: "novo", motivoPerda: null });
  });

  it("se o cliente escreve antes do prazo, as 24 h recomeçam", async () => {
    await definirRegrasDeDesclassificados(R);
    const id = await montarLead("curioso");
    vi.setSystemTime(seg(20, 0));
    await registrarMensagemCliente(id, "E quanto custa?");
    await em(ter(9, 0));
    expect((await ler(id)).etapa).toBe("novo");
    await em(ter(20, 0));
    expect((await ler(id)).etapa).toBe("perdido");
  });

  it("qualificado e lead passado ao consultor não são tocados", async () => {
    await definirRegrasDeDesclassificados(R);
    const bom = await montarLead("qualificado");
    const passado = await montarLead("outra_cidade", "+5588900000083");
    await db.lead.update({ where: { id: passado }, data: { modoAtendimento: "pausado", aguardandoHumano: true } });
    await em(ter(9, 0));
    expect((await ler(passado)).etapa).toBe("novo");
    expect((await ler(bom)).motivoPerda).not.toBe("outra_cidade_automatico");
  });

  it("desligado (padrão de fábrica): o desclassificado segue a recuperação de sempre", async () => {
    const id = await montarLead("outra_cidade");
    await em(seg(10, 0));
    expect(await recuperacoes(id)).toBe(1);
    expect(await db.eventoMetrica.count({ where: { tipo: "desclassificado_perdido" } })).toBe(0);
  });
});
