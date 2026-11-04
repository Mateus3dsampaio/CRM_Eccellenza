import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { agora, avancarRelogio } from "@/lib/relogio";
import { datasDosAtalhos, resolverPeriodoPainel } from "@/regras/painel";
import { chaveDia, dataLocal, HORA } from "@/regras/tempo";
import { formatarDuracao } from "@/regras/tempo-resposta";
import { moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { dadosDoPainel } from "@/servicos/painel";
import { criarConsultores, limparBanco } from "./ajuda";

const MIN = 60 * 1000;

describe("período do painel", () => {
  const hoje = dataLocal(2026, 10, 31, 15); // sábado
  it("atalhos terminam hoje", () => {
    const a = datasDosAtalhos(hoje);
    expect(a.hoje).toEqual({ de: "2026-10-31", ate: "2026-10-31" });
    expect(a["7d"].de).toBe("2026-10-25");
    expect(a["30d"].de).toBe("2026-10-02");
    expect(a.semana.de).toBe("2026-10-26");
    expect(a.mes.de).toBe("2026-10-01");
  });
  it("compara com o período anterior do mesmo tamanho", () => {
    const p = resolverPeriodoPainel({ de: "2026-10-10", ate: "2026-10-14" }, hoje);
    expect(p.dias).toBe(5);
    expect(p.anteriorInicio).toEqual(dataLocal(2026, 10, 5));
    expect(p.fim).toEqual(dataLocal(2026, 10, 15));
  });
  it("recusa data invertida, futura ou período enorme", () => {
    expect(() => resolverPeriodoPainel({ de: "2026-10-20", ate: "2026-10-10" }, hoje)).toThrow(/depois/);
    expect(() => resolverPeriodoPainel({ de: "2026-10-20", ate: "2026-11-02" }, hoje)).toThrow(/futuro/);
    expect(() => resolverPeriodoPainel({ de: "2025-01-01", ate: "2026-10-10" }, hoje)).toThrow(/366/);
  });
  it("sem nada informado usa a semana", () => {
    expect(resolverPeriodoPainel({}, hoje).de).toBe("2026-10-26");
  });
});

describe("duração", () => {
  it("formata segundos, minutos, horas e dias", () => {
    expect([null, 45, 12 * 60, 65 * 60, 27 * 3600].map(formatarDuracao)).toEqual(["–", "45 s", "12 min", "1 h 05 min", "1 d 3 h"]);
  });
});

describe("painel por vendedor e tempo de resposta", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("mostra o geral e filtra pelos leads do vendedor, separando bot e consultor", async () => {
    const [a, b] = await criarConsultores();

    // Lead de A: bot responde em 2 min, consultor em 30 min.
    const leadA = await obterOuCriarLead("+5588900009001");
    await db.lead.update({ where: { id: leadA.id }, data: { consultorId: a.id } });
    await registrarMensagemCliente(leadA.id, "Oi");
    await avancarRelogio(2 * MIN);
    await enviarMensagemLoja({ leadId: leadA.id, autor: "bot", texto: "Olá!" });
    await moverEtapa(leadA.id, "qualificacao", "bot");
    await db.lead.update({ where: { id: leadA.id }, data: { aguardandoHumano: true, repassadoEm: await agora() } });
    await avancarRelogio(HORA);
    await registrarMensagemCliente(leadA.id, "Quero uma visita");
    await avancarRelogio(30 * MIN);
    await enviarMensagemLoja({ leadId: leadA.id, autor: "consultor", autorNome: a.nome, texto: "Claro" });
    await moverEtapa(leadA.id, "qualificacao", a.nome, { semExigencias: true });

    // Lead de B: consultor responde em 10 min.
    const leadB = await obterOuCriarLead("+5588900009002");
    await db.lead.update({ where: { id: leadB.id }, data: { consultorId: b.id } });
    await registrarMensagemCliente(leadB.id, "Bom dia");
    await avancarRelogio(10 * MIN);
    await enviarMensagemLoja({ leadId: leadB.id, autor: "consultor", autorNome: b.nome, texto: "Bom dia!" });

    const geral = await dadosDoPainel({ atalho: "hoje" });
    expect(geral.vendedorId).toBeNull();
    expect(geral.tempos.geral.quantidade).toBe(3);
    expect(geral.tempos.consultor.quantidade).toBe(2);
    expect(geral.tempos.consultor.mediaSegundos).toBe(20 * 60);
    expect(geral.tempos.bot.mediaSegundos).toBe(2 * 60);
    expect(geral.indicadores.find((i) => i.tipo === "lead_novo")?.atual).toBe(2);

    const deA = await dadosDoPainel({ atalho: "hoje", vendedorId: a.id });
    expect(deA.vendedorNome).toBe(a.nome);
    expect(deA.tempos.consultor.mediaSegundos).toBe(30 * 60);
    expect(deA.tempos.bot.quantidade).toBe(1);
    // Bot passou o lead aos 2 min; o consultor respondeu 1 h 30 min depois disso.
    expect(deA.tempos.primeiraResposta.mediaSegundos).toBe(90 * 60);
    expect(deA.tempos.primeiraResposta.aguardando).toBe(0);
    expect(deA.indicadores.find((i) => i.tipo === "recebidos")?.atual).toBe(1);
    expect(deA.indicadores.find((i) => i.tipo === "atendidos")?.atual).toBe(1);
    // Chegou até "Em qualificação": passou por IA atendendo também.
    expect(deA.funil.map((f) => f.total)).toEqual([1, 1, 0, 0]);

    const deB = await dadosDoPainel({ atalho: "hoje", vendedorId: b.id });
    expect(deB.tempos.consultor.mediaSegundos).toBe(10 * 60);
    expect(deB.tempos.bot.quantidade).toBe(0);
    expect(deB.funil.map((f) => f.total)).toEqual([1, 0, 0, 0]);
  });

  it("período fora da conversa fica vazio e vendedor inexistente dá erro", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900009003");
    await registrarMensagemCliente(lead.id, "Oi");
    const hoje = await agora();
    const ontem = new Date(hoje.getTime() - 24 * HORA);
    const chave = chaveDia(ontem);
    const vazio = await dadosDoPainel({ de: chave, ate: chave });
    expect(vazio.tempos.geral.quantidade).toBe(0);
    expect(vazio.tempos.semResposta).toBe(0);
    await expect(dadosDoPainel({ atalho: "hoje", vendedorId: "nao-existe" })).rejects.toThrow(/não encontrado/);
  });
});
