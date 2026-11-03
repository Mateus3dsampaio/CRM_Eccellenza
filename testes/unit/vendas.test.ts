import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { faltaParaMover, formatarReais, lerReais } from "@/regras/vendas";
import { conferirMudanca, moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { limparBanco } from "./ajuda";

const retorno = new Date("2026-11-10T14:00:00Z");

describe("dinheiro (Bloco 2)", () => {
  it("formata em reais", () => {
    expect(formatarReais(162100)).toBe("R$ 1.621,00");
    expect(formatarReais(5)).toBe("R$ 0,05");
    expect(formatarReais(123456789)).toBe("R$ 1.234.567,89");
    expect(formatarReais(null)).toBe("");
  });
  it("lê o que o vendedor digita", () => {
    expect(lerReais("1621")).toBe(162100);
    expect(lerReais("1.621,00")).toBe(162100);
    expect(lerReais("R$ 1.621,5")).toBe(162150);
    expect(lerReais("1.621")).toBe(162100);
    expect(lerReais("abc")).toBeNull();
    expect(lerReais("")).toBeNull();
    expect(lerReais("1,234")).toBeNull();
  });
  it("o que cada etapa exige", () => {
    expect(faltaParaMover("orcamento", {})).toMatch(/próximo contato/);
    expect(faltaParaMover("negociacao", { proximoContatoEm: retorno })).toBeNull();
    expect(faltaParaMover("fechado", {})).toMatch(/valor fechado/);
    expect(faltaParaMover("perdido", {})).toMatch(/motivo/);
    expect(faltaParaMover("perdido", { motivoPerda: "concorrente" })).toMatch(/concorrente/);
    expect(faltaParaMover("perdido", { motivoPerda: "concorrente", concorrente: "Todeschini" })).toBeNull();
    expect(faltaParaMover("perdido", { motivoPerda: "preco" })).toBeNull();
    expect(faltaParaMover("visita", {})).toBeNull();
  });
});

describe("mover etapa com dados de venda (Bloco 2)", () => {
  beforeEach(limparBanco);

  it("recusa Orçamento sem data e aceita com data", async () => {
    const lead = await obterOuCriarLead("+5588900000101");
    await expect(moverEtapa(lead.id, "orcamento", "Ana")).rejects.toThrow(/próximo contato/);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("novo");
    await moverEtapa(lead.id, "orcamento", "Ana", { dados: { proximoContatoEm: retorno, valorOrcamento: 162100 } });
    const a = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(a.etapa).toBe("orcamento");
    expect(a.proximoContatoEm?.toISOString()).toBe(retorno.toISOString());
    expect(a.valorOrcamento).toBe(162100);
  });

  it("de Orçamento para Negociação mantém a data; para Fechado exige o valor e limpa a data", async () => {
    const lead = await obterOuCriarLead("+5588900000102");
    await moverEtapa(lead.id, "orcamento", "Ana", { dados: { proximoContatoEm: retorno, valorOrcamento: 100000 } });
    await moverEtapa(lead.id, "negociacao", "Ana");
    await expect(moverEtapa(lead.id, "fechado", "Ana")).rejects.toThrow(/valor fechado/);
    await moverEtapa(lead.id, "fechado", "Ana", { dados: { valorFechado: 95000 } });
    const f = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(f.etapa).toBe("fechado");
    expect(f.proximoContatoEm).toBeNull();
    expect(f.valorFechado).toBe(95000);
    expect(f.valorOrcamento).toBe(100000);
  });

  it("Perdido exige motivo; concorrente exige nome; sair de Perdido limpa o motivo", async () => {
    const lead = await obterOuCriarLead("+5588900000103");
    await expect(moverEtapa(lead.id, "perdido", "Ana")).rejects.toThrow(/motivo/);
    await expect(moverEtapa(lead.id, "perdido", "Ana", { dados: { motivoPerda: "concorrente" } })).rejects.toThrow(/concorrente/);
    await moverEtapa(lead.id, "perdido", "Ana", { dados: { motivoPerda: "concorrente", concorrente: " Todeschini " } });
    const p = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect([p.motivoPerda, p.concorrente]).toEqual(["concorrente", "Todeschini"]);
    await moverEtapa(lead.id, "pronto", "Ana");
    const v = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect([v.motivoPerda, v.concorrente]).toEqual([null, null]);
  });

  it("conferirMudanca não grava nada; o retorno automático da retomada não exige dados", async () => {
    const lead = await obterOuCriarLead("+5588900000104");
    await expect(conferirMudanca(lead.id, "perdido", {})).rejects.toThrow(/motivo/);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("novo");
    await db.lead.update({ where: { id: lead.id }, data: { etapa: "sem_resposta", etapaAnterior: "orcamento" } });
    await moverEtapa(lead.id, "orcamento", "sistema", { semExigencias: true });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("orcamento");
  });

  it("troca a data e o valor sem mudar de etapa", async () => {
    const lead = await obterOuCriarLead("+5588900000105");
    await moverEtapa(lead.id, "orcamento", "Ana", { dados: { proximoContatoEm: retorno } });
    const nova = new Date("2026-11-12T13:00:00Z");
    await moverEtapa(lead.id, "orcamento", "Ana", { dados: { proximoContatoEm: nova, valorOrcamento: 250000 } });
    const a = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(a.proximoContatoEm?.toISOString()).toBe(nova.toISOString());
    expect(a.valorOrcamento).toBe(250000);
  });
});
