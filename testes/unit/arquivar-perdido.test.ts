import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { diasParaArquivar, REGRAS_ARQUIVAR_PADRAO, validarRegrasArquivar, type EstadoPerdido, type RegrasArquivarPerdido } from "@/regras/arquivar-perdido";
import { dataLocal } from "@/regras/tempo";
import { definirRegrasDeArquivarPerdido } from "@/servicos/configuracoes";
import { moverEtapa, obterOuCriarLead, restaurarLead } from "@/servicos/leads";
import { registrarMensagemCliente } from "@/servicos/mensagens";
import { rodarRotinas } from "@/servicos/rotinas";
import { limparBanco } from "./ajuda";

// Novembro de 2026 em diante, horário de Fortaleza (dia 31 = 1º de dezembro, e assim por diante).
const dia = (d: number, h = 9, m = 0) => dataLocal(2026, 11, d, h, m);

const R: RegrasArquivarPerdido = { ligado: true, diasAutomatico: 7, vendedorLigado: true, diasVendedor: 60 };
const base: EstadoPerdido = { etapa: "perdido", arquivadoEm: null, perdidoEm: dia(1), autorDaMudanca: "sistema" };

describe("perdido arquiva sozinho: regras puras", () => {
  it("de fábrica vem desligado, com 7 e 60 dias", () => {
    expect(REGRAS_ARQUIVAR_PADRAO).toEqual({ ligado: false, diasAutomatico: 7, vendedorLigado: true, diasVendedor: 60 });
    expect(validarRegrasArquivar(REGRAS_ARQUIVAR_PADRAO)).toBeNull();
    expect(validarRegrasArquivar({ ...R, diasAutomatico: 0 })).not.toBeNull();
    expect(validarRegrasArquivar({ ...R, diasVendedor: 400 })).not.toBeNull();
  });

  it("desligado: nada acontece", () => {
    expect(diasParaArquivar(base, { ...R, ligado: false }, dia(90))).toBeNull();
  });

  it("movido pelo sistema: 7 dias; movido por uma pessoa: 60 dias", () => {
    expect(diasParaArquivar(base, R, dia(8, 8, 59))).toBeNull();
    expect(diasParaArquivar(base, R, dia(8))).toBe(7);
    const vendedor = { ...base, autorDaMudanca: "Ana" };
    expect(diasParaArquivar(vendedor, R, dia(8))).toBeNull();
    expect(diasParaArquivar(vendedor, R, dia(60))).toBeNull();
    expect(diasParaArquivar(vendedor, R, dia(61))).toBe(60);
  });

  it("dado antigo sem registro de quem moveu conta como movido por uma pessoa", () => {
    expect(diasParaArquivar({ ...base, autorDaMudanca: null }, R, dia(8))).toBeNull();
    expect(diasParaArquivar({ ...base, autorDaMudanca: null }, R, dia(61))).toBe(60);
  });

  it("perdido do vendedor desligado: só o automático arquiva", () => {
    const regras = { ...R, vendedorLigado: false };
    expect(diasParaArquivar({ ...base, autorDaMudanca: "Ana" }, regras, dia(200))).toBeNull();
    expect(diasParaArquivar(base, regras, dia(8))).toBe(7);
  });

  it("só card em Perdido e fora do arquivo", () => {
    expect(diasParaArquivar({ ...base, etapa: "negociacao" }, R, dia(90))).toBeNull();
    expect(diasParaArquivar({ ...base, arquivadoEm: dia(2) }, R, dia(90))).toBeNull();
    expect(diasParaArquivar({ ...base, perdidoEm: null }, R, dia(90))).toBeNull();
  });
});

// ---------------------------------------------------------------- com o banco

async function perder(telefone: string, autor: string, motivoPerda: string) {
  vi.setSystemTime(dia(1, 8));
  const lead = await obterOuCriarLead(telefone);
  await registrarMensagemCliente(lead.id, "Oi");
  vi.setSystemTime(dia(1));
  await moverEtapa(lead.id, "perdido", autor, { guardarAnterior: true, semExigencias: true, dados: { motivoPerda } });
  return lead.id;
}
const ler = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });
async function em(quando: Date) {
  vi.setSystemTime(quando);
  await rodarRotinas();
}

describe("perdido arquiva sozinho: rotina com o banco", () => {
  beforeEach(async () => {
    await limparBanco();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("automático vai para o arquivo em 7 dias; o do vendedor em 60; os dois com registro na ficha", async () => {
    await definirRegrasDeArquivarPerdido(R);
    const auto = await perder("+5588900000101", "sistema", "outro");
    const vend = await perder("+5588900000102", "Ana", "preco");
    await em(dia(8, 8, 59));
    expect((await ler(auto)).arquivadoEm).toBeNull();
    await em(dia(8));
    expect((await ler(auto)).arquivadoEm).not.toBeNull();
    expect((await ler(auto)).etapa).toBe("perdido");
    expect((await ler(vend)).arquivadoEm).toBeNull();
    expect(await db.alteracao.count({ where: { leadId: auto, descricao: "Arquivado automaticamente (7 dias em Perdido)" } })).toBe(1);
    // O do vendedor: 60 dias. (O automático, arquivado no dia 8, já foi excluído de vez 30 dias depois.)
    await em(dia(60));
    expect((await ler(vend)).arquivadoEm).toBeNull();
    await em(dia(61));
    expect((await ler(vend)).arquivadoEm).not.toBeNull();
    expect(await db.eventoMetrica.count({ where: { tipo: "perdido_arquivado" } })).toBe(2);
  });

  it("desligado (padrão de fábrica): ninguém é arquivado", async () => {
    const id = await perder("+5588900000103", "sistema", "outro");
    await em(dia(25));
    expect((await ler(id)).arquivadoEm).toBeNull();
  });

  it("cliente arquivado que escreve sai do arquivo e volta para a coluna em que estava", async () => {
    await definirRegrasDeArquivarPerdido(R);
    const id = await perder("+5588900000104", "sistema", "outro");
    await em(dia(8));
    vi.setSystemTime(dia(10));
    await registrarMensagemCliente(id, "Oi, voltei");
    expect(await ler(id)).toMatchObject({ arquivadoEm: null, etapa: "novo" });
  });

  it("card restaurado do arquivo e deixado em Perdido ganha o prazo inteiro de novo", async () => {
    await definirRegrasDeArquivarPerdido(R);
    const id = await perder("+5588900000105", "sistema", "outro");
    await em(dia(8));
    vi.setSystemTime(dia(10));
    await restaurarLead(id, "Ana");
    await em(dia(10, 9, 1));
    expect((await ler(id)).arquivadoEm).toBeNull();
    await em(dia(16, 23));
    expect((await ler(id)).arquivadoEm).toBeNull();
    await em(dia(17));
    expect((await ler(id)).arquivadoEm).not.toBeNull();
  });
});
