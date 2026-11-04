import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ETAPAS, mesclarNomesDasEtapas, NOME_ETAPA_MAX, nomesPadraoDasEtapas, validarNomeDaEtapa } from "@/regras/etapas";
import { pode } from "@/regras/permissoes";
import { criarConsultores, limparBanco } from "./ajuda";
import { definirNomeDaEtapa, nomesDasEtapas } from "@/servicos/etapas";
import { moverEtapa, obterOuCriarLead } from "@/servicos/leads";

describe("nomes das colunas (regras)", () => {
  it("valida: tira espaços repetidos, recusa vazio, grande demais e sinais de HTML", () => {
    expect(validarNomeDaEtapa("  Em   negociação  ")).toEqual({ ok: true, nome: "Em negociação" });
    expect(validarNomeDaEtapa("   ").ok).toBe(false);
    expect(validarNomeDaEtapa(null).ok).toBe(false);
    expect(validarNomeDaEtapa("a".repeat(NOME_ETAPA_MAX + 1)).ok).toBe(false);
    expect(validarNomeDaEtapa("a".repeat(NOME_ETAPA_MAX)).ok).toBe(true);
    expect(validarNomeDaEtapa("<b>oi</b>").ok).toBe(false);
  });

  it("mescla: o guardado vale, o resto é de fábrica, e lixo é ignorado", () => {
    const padrao = nomesPadraoDasEtapas();
    expect(mesclarNomesDasEtapas(null)).toEqual(padrao);
    expect(mesclarNomesDasEtapas("{quebrado")).toEqual(padrao);
    expect(mesclarNomesDasEtapas(JSON.stringify({ fechado: "Vendido", novo: 5, inexistente: "x" }))).toEqual({ ...padrao, fechado: "Vendido" });
  });

  it("só o admin renomeia", () => {
    expect(pode("admin", "configurar")).toBe(true);
    expect(pode("consultor", "configurar")).toBe(false);
  });
});

describe("nomes das colunas (serviço)", () => {
  beforeEach(limparBanco);

  it("renomeia, guarda só o que difere do padrão e volta ao padrão com nome vazio ou igual", async () => {
    expect(await nomesDasEtapas()).toEqual(nomesPadraoDasEtapas());
    await definirNomeDaEtapa("fechado", "Vendido");
    expect((await nomesDasEtapas()).fechado).toBe("Vendido");
    const guardado = await db.configuracao.findUnique({ where: { chave: "nomes_etapas" } });
    expect(JSON.parse(guardado!.valor)).toEqual({ fechado: "Vendido" });
    await definirNomeDaEtapa("fechado", "");
    expect((await nomesDasEtapas()).fechado).toBe("Fechado");
    await definirNomeDaEtapa("fechado", "Vendido");
    await definirNomeDaEtapa("fechado", "Fechado"); // igual ao de fábrica
    expect(JSON.parse((await db.configuracao.findUniqueOrThrow({ where: { chave: "nomes_etapas" } })).valor)).toEqual({});
  });

  it("recusa coluna desconhecida, nome inválido e nome repetido (sem diferenciar maiúscula)", async () => {
    await expect(definirNomeDaEtapa("nao_existe", "X")).rejects.toThrow(/desconhecida/);
    await expect(definirNomeDaEtapa("novo", "x".repeat(NOME_ETAPA_MAX + 1))).rejects.toThrow(/máximo/);
    await expect(definirNomeDaEtapa("novo", "apresentação agendada")).rejects.toThrow(/Já existe/);
    expect((await nomesDasEtapas()).novo).toBe(ETAPAS[0].nome);
  });

  it("o histórico do lead usa o nome atual da coluna", async () => {
    await criarConsultores();
    await definirNomeDaEtapa("pronto", "Com o consultor");
    const lead = await obterOuCriarLead("+5588999990001", "Teste");
    await moverEtapa(lead.id, "pronto", "Mateus", { semExigencias: true });
    const registro = await db.alteracao.findFirst({ where: { leadId: lead.id, descricao: { contains: "Moveu de" } } });
    expect(registro?.descricao).toContain('para "Com o consultor"');
  });
});
