import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { esperaDoLead } from "@/regras/espera";
import { SCRIPT_DO_PAINEL_EXPORTADO, gerarHtmlDoPainel } from "@/regras/painel-html";
import { chaveDia } from "@/regras/tempo";
import { leadsAguardando } from "@/servicos/consultas";
import { excluirLeads, moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { registrarEvento } from "@/servicos/metricas";
import { dadosDoPainel } from "@/servicos/painel";
import { zerarPainel } from "@/servicos/painel-dados";
import { dadosParaExportar } from "@/servicos/painel-exportar";
import { criarMotivo, excluirMotivo, motivosDePerda } from "@/servicos/vendas";
import { criarConsultores, limparBanco } from "./ajuda";

// Painel permanente: excluir leads não muda o painel; "Não é lead" não conta como perdido; zerar painel; exportação em HTML.

async function novo(telefone: string, consultorId: string | null) {
  const l = await obterOuCriarLead(telefone, "Fulano");
  if (consultorId) await db.lead.update({ where: { id: l.id }, data: { consultorId } });
  return l.id;
}

async function compromisso(leadId: string, consultorId: string, tipo: "medicao" | "apresentacao", marcadaEm: Date) {
  await db.visita.create({ data: { leadId, consultorId, tipo, inicio: new Date(marcadaEm.getTime() + 3 * 86_400_000), fim: new Date(marcadaEm.getTime() + 3 * 86_400_000 + 3_600_000), criadoPor: "t", criadoEm: marcadaEm } });
}

describe("Perdido não espera resposta", () => {
  beforeEach(limparBanco);

  it("entrar em Perdido limpa a espera e tira o card da lista de aguardando", async () => {
    const [a] = await criarConsultores();
    const id = await novo("+5588900001001", a.id);
    await db.lead.update({ where: { id }, data: { aguardandoHumano: true, esperandoDesde: new Date(), naoLidas: 3, modoAtendimento: "humano" } });
    expect(await leadsAguardando({ id: a.id, perfil: "consultor" })).toHaveLength(1);
    await moverEtapa(id, "perdido", "t", { dados: { motivoPerda: "desistiu" } });
    const l = await db.lead.findUniqueOrThrow({ where: { id } });
    expect([l.aguardandoHumano, l.esperandoDesde, l.naoLidas]).toEqual([false, null, 0]);
    expect(await leadsAguardando({ id: a.id, perfil: "consultor" })).toHaveLength(0);
  });

  it("card antigo que ainda tem a marca de espera em Perdido também não espera", () => {
    const base = { aguardandoHumano: true, esperandoDesde: new Date(), repassadoEm: null, ultimaMsgClienteEm: null };
    expect(esperaDoLead({ ...base, etapa: "perdido" })).toBeNull();
    expect(esperaDoLead({ ...base, etapa: "novo" })).not.toBeNull();
  });
});

describe("excluir lead não muda o painel", () => {
  beforeEach(limparBanco);

  it("vendido e perdidos (com motivo e concorrente) continuam depois de excluir os leads", async () => {
    const [a, b] = await criarConsultores();
    const f = await novo("+5588900001101", a.id);
    await moverEtapa(f, "fechado", "t", { dados: { valorFechado: 250000 } });
    const p = await novo("+5588900001102", b.id);
    await moverEtapa(p, "perdido", "t", { dados: { motivoPerda: "concorrente", concorrente: "Todeschini" } });
    const antes = (await dadosDoPainel({ atalho: "hoje" })).vendas;
    expect(await excluirLeads([f, p])).toBe(2);
    const depois = (await dadosDoPainel({ atalho: "hoje" })).vendas;
    expect(depois).toEqual(antes);
    expect(depois.vendido).toEqual({ quantidade: 1, total: 250000 });
    expect(depois.perdidos.motivos.find((m) => m.codigo === "concorrente")?.detalhes).toEqual(["Todeschini"]);
    // E por vendedor.
    expect((await dadosDoPainel({ atalho: "hoje", vendedorId: a.id })).vendas.vendido.total).toBe(250000);
    expect((await dadosDoPainel({ atalho: "hoje", vendedorId: b.id })).vendas.perdidos.quantidade).toBe(1);
  });

  it("a cópia guardada não tem nome, telefone nem texto", async () => {
    const id = await novo("+5588900001103", null);
    await moverEtapa(id, "perdido", "t", { dados: { motivoPerda: "preco" } });
    await excluirLeads([id]);
    const linhas = await db.leadExcluidoMetrica.findMany();
    expect(linhas).toHaveLength(1);
    expect(JSON.stringify(linhas)).not.toMatch(/Fulano|5588900001103/);
  });

  it("lead sem nada a guardar (ainda em Novo, sem agenda) não gera cópia", async () => {
    const id = await novo("+5588900001104", null);
    await excluirLeads([id]);
    expect(await db.leadExcluidoMetrica.count()).toBe(0);
  });

  it("medição e apresentação marcadas contam mesmo com o lead excluído (apresentação que não converteu)", async () => {
    const [a] = await criarConsultores();
    const quando = await agora();
    const sumiu = await novo("+5588900001201", a.id);
    await compromisso(sumiu, a.id, "medicao", new Date(quando.getTime() - 1000));
    await compromisso(sumiu, a.id, "apresentacao", quando);
    const fechou = await novo("+5588900001202", a.id);
    await compromisso(fechou, a.id, "apresentacao", quando);
    await moverEtapa(fechou, "fechado", "t", { dados: { valorFechado: 100000 }, semExigencias: true });
    const antes = (await dadosDoPainel({ atalho: "hoje" })).conversoes;
    expect(antes).toEqual({ medicoes: 1, medicoesComApresentacao: 1, apresentacoes: 2, apresentacoesFechadas: 1 });
    await excluirLeads([sumiu]);
    expect((await dadosDoPainel({ atalho: "hoje" })).conversoes).toEqual(antes);
    expect((await dadosDoPainel({ atalho: "hoje", vendedorId: a.id })).conversoes).toEqual(antes);
    await excluirLeads([fechou]);
    expect((await dadosDoPainel({ atalho: "hoje" })).conversoes).toEqual(antes);
  });

  it("motivo que o painel guardou de um lead excluído não pode ser apagado", async () => {
    const id = await novo("+5588900001105", null);
    await moverEtapa(id, "perdido", "t", { dados: { motivoPerda: "prazo" } });
    await excluirLeads([id]);
    await expect(excluirMotivo("prazo")).rejects.toThrow(/Desative/);
  });
});

describe('motivo "Não é lead"', () => {
  beforeEach(limparBanco);

  it("não conta como perdido, aparece em descartados e sai de Leads novos; o card pode ser apagado sem mudar isso", async () => {
    const [a] = await criarConsultores();
    await motivosDePerda();
    await criarMotivo({ nome: "Pós-venda", naoELead: true });
    const codigo = (await motivosDePerda()).find((m) => m.nome === "Pós-venda")!.codigo;
    const lead = await novo("+5588900001301", a.id);
    const real = await novo("+5588900001302", a.id);
    // Criar o lead já registra "lead_novo" (2 leads = 2); o descartado sai dessa conta.
    await moverEtapa(lead, "perdido", "t", { dados: { motivoPerda: codigo } });
    await moverEtapa(real, "perdido", "t", { dados: { motivoPerda: "preco" } });

    const painel = await dadosDoPainel({ atalho: "hoje" });
    expect(painel.vendas.perdidos.quantidade).toBe(1);
    expect(painel.vendas.perdidos.motivos.map((m) => m.codigo)).toEqual(["preco"]);
    expect(painel.vendas.descartados.quantidade).toBe(1);
    expect(painel.vendas.descartados.motivos.map((m) => m.nome)).toEqual(["Pós-venda"]);
    expect(painel.indicadores.find((i) => i.tipo === "lead_novo")?.atual).toBe(1);

    await excluirLeads([lead]);
    const depois = await dadosDoPainel({ atalho: "hoje" });
    expect(depois.vendas.descartados.quantidade).toBe(1);
    expect(depois.vendas.perdidos.quantidade).toBe(1);
    expect(depois.indicadores.find((i) => i.tipo === "lead_novo")?.atual).toBe(1);
  });

  it("Leads novos nunca fica negativo", async () => {
    await motivosDePerda();
    await criarMotivo({ nome: "Emprego", naoELead: true });
    const codigo = (await motivosDePerda()).find((m) => m.nome === "Emprego")!.codigo;
    const id = await novo("+5588900001303", null);
    await moverEtapa(id, "perdido", "t", { dados: { motivoPerda: codigo } });
    expect((await dadosDoPainel({ atalho: "hoje" })).indicadores.find((i) => i.tipo === "lead_novo")?.atual).toBe(0);
  });
});

describe("zerar painel", () => {
  beforeEach(limparBanco);

  it("apaga o histórico, mostra só o que vier depois e mantém os leads", async () => {
    const [a] = await criarConsultores();
    const f = await novo("+5588900001401", a.id);
    await moverEtapa(f, "fechado", "t", { dados: { valorFechado: 80000 } });
    const p = await novo("+5588900001402", a.id);
    await moverEtapa(p, "perdido", "t", { dados: { motivoPerda: "preco" } });
    await excluirLeads([p]);
    await registrarEvento("lead_novo");
    const antes = await dadosDoPainel({ atalho: "hoje" });
    expect(antes.vendas.vendido.quantidade + antes.vendas.perdidos.quantidade).toBe(2);

    const r = await zerarPainel();
    expect(r.contadores).toBeGreaterThan(0);
    expect(r.excluidos).toBe(1);
    expect(await db.eventoMetrica.count()).toBe(0);
    expect(await db.leadExcluidoMetrica.count()).toBe(0);
    expect(await db.lead.count({ where: { id: f } })).toBe(1);

    const zerado = await dadosDoPainel({ atalho: "hoje" });
    expect(zerado.zeradoEm).not.toBeNull();
    expect(zerado.vendas.vendido).toEqual({ quantidade: 0, total: 0 });
    expect(zerado.vendas.perdidos.quantidade).toBe(0);
    expect(zerado.indicadores.every((i) => i.atual === 0)).toBe(true);

    // O que acontece depois do reset conta, e não sai mais, mesmo excluindo o lead.
    const novoPerdido = await novo("+5588900001403", a.id);
    await moverEtapa(novoPerdido, "perdido", "t", { dados: { motivoPerda: "prazo" } });
    await excluirLeads([novoPerdido]);
    expect((await dadosDoPainel({ atalho: "hoje" })).vendas.perdidos.quantidade).toBe(1);
  });
});

describe("exportação do painel em HTML", () => {
  beforeEach(limparBanco);

  it("o script do arquivo calcula os mesmos números do Painel", async () => {
    const [a, b] = await criarConsultores();
    await motivosDePerda();
    await criarMotivo({ nome: "Parceiro", naoELead: true });
    const naoLead = (await motivosDePerda()).find((m) => m.nome === "Parceiro")!.codigo;
    const quando = await agora();
    const f = await novo("+5588900001501", a.id);
    await compromisso(f, a.id, "apresentacao", quando);
    await moverEtapa(f, "fechado", "t", { dados: { valorFechado: 123400 }, semExigencias: true });
    const p1 = await novo("+5588900001502", b.id);
    await moverEtapa(p1, "perdido", "t", { dados: { motivoPerda: "concorrente", concorrente: "Todeschini" } });
    const p2 = await novo("+5588900001503", b.id);
    await moverEtapa(p2, "perdido", "t", { dados: { motivoPerda: naoLead } });
    const m = await novo("+5588900001504", b.id);
    await compromisso(m, b.id, "medicao", new Date(quando.getTime() - 5000));
    await compromisso(m, b.id, "apresentacao", quando);
    await registrarEvento("lead_novo", a.id);
    await registrarEvento("lead_novo", b.id);
    await registrarEvento("lead_novo", b.id);
    await registrarEvento("apresentacao_agendada", a.id);
    await registrarEvento("etapa_novo", a.id);
    await excluirLeads([p1, m]);

    const painel = await dadosDoPainel({ atalho: "hoje" });
    const dados = await dadosParaExportar();
    const criarPainel = new Function("document", `${SCRIPT_DO_PAINEL_EXPORTADO}\nreturn criarPainel;`)(undefined) as (d: unknown) => (de: string, ate: string, vendedor: string) => Record<string, unknown>;
    const hoje = chaveDia(quando);
    const r = criarPainel(dados)(hoje, hoje, "") as {
      indicadores: { tipo: string; total: number }[];
      funil: { tipo: string; total: number }[];
      vendido: unknown;
      perdidos: { quantidade: number; motivos: { codigo: string; total: number; detalhes: string[] }[] };
      descartados: { quantidade: number };
      conversoes: unknown;
      porConsultor: { nome: string; total: number }[];
    };
    expect(r.vendido).toEqual(painel.vendas.vendido);
    expect(r.perdidos).toEqual(painel.vendas.perdidos);
    expect(r.descartados.quantidade).toBe(painel.vendas.descartados.quantidade);
    expect(r.conversoes).toEqual(painel.conversoes);
    expect(r.indicadores.map((i) => [i.tipo, i.total])).toEqual(painel.indicadores.map((i) => [i.tipo, i.atual]));
    expect(r.funil.map((f) => [f.tipo, f.total])).toEqual(painel.funil.map((f) => [f.tipo, f.total]));
    expect(r.porConsultor).toEqual(painel.apresentacoesPorConsultor);
    // Filtro de vendedor e de período vazio.
    expect(criarPainel(dados)(hoje, hoje, a.id).vendido).toEqual({ quantidade: 1, total: 123400 });
    expect((criarPainel(dados)("2000-01-01", "2000-01-02", "") as { vendido: { quantidade: number } }).vendido.quantidade).toBe(0);
  });

  it("o arquivo é HTML completo, sem dados pessoais e com os dados escapados", async () => {
    const id = await novo("+5588900001601", null);
    await moverEtapa(id, "perdido", "t", { dados: { motivoPerda: "concorrente", concorrente: "</script><b>x" } });
    const html = gerarHtmlDoPainel(await dadosParaExportar());
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('id="dados"');
    expect(html).not.toMatch(/Fulano|5588900001601/);
    // O texto do concorrente não pode fechar a tag do script.
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });
});
