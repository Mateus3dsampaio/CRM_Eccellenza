import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { MANUAL_INICIAL } from "@/bot/manual-inicial";
import { impressaoDoManual, situacaoDoManual, VERSOES_DO_MANUAL } from "@/bot/manual-versoes";
import { db } from "@/lib/db";
import { editarInstrucao, obterManual, situacaoDoManualNoBanco, usarManualDoCodigo, voltarParaAnterior } from "@/servicos/instrucoes";
import { limparBanco } from "./ajuda";

// Versão do Manual de 04/11/2026, congelada (as impressões antigas nunca saem da lista).
const ANTIGO = readFileSync(path.join(__dirname, "manual-antigo.txt"), "utf8");
const agora = new Date();

beforeEach(async () => {
  await limparBanco();
});

async function bancoComManual(texto: string) {
  await db.instrucao.create({ data: { tipo: "manual", ordem: 0, titulo: "Manual do CRM", texto, criadoEm: agora, atualizadoEm: agora } });
}

describe("versões do Manual do CRM (tarefa 38)", () => {
  it("a versão atual do código está na lista (mudou manual-inicial.ts? acrescente a impressão nova em bot/manual-versoes.ts)", () => {
    expect(VERSOES_DO_MANUAL, `Acrescente "${impressaoDoManual(MANUAL_INICIAL)}" ao fim de VERSOES_DO_MANUAL`).toContain(impressaoDoManual(MANUAL_INICIAL));
    expect(VERSOES_DO_MANUAL.at(-1)).toBe(impressaoDoManual(MANUAL_INICIAL));
    expect(VERSOES_DO_MANUAL).toContain(impressaoDoManual(ANTIGO));
  });

  it("classifica o texto do banco", () => {
    expect(situacaoDoManual({ texto: `${MANUAL_INICIAL}\r\n`, anteriorTexto: null }, MANUAL_INICIAL)).toBe("igual");
    expect(situacaoDoManual({ texto: ANTIGO, anteriorTexto: null }, MANUAL_INICIAL)).toBe("desatualizado");
    expect(situacaoDoManual({ texto: ANTIGO, anteriorTexto: MANUAL_INICIAL }, MANUAL_INICIAL)).toBe("voltou");
    expect(situacaoDoManual({ texto: `${ANTIGO}\nlinha a mais`, anteriorTexto: null }, MANUAL_INICIAL)).toBe("editado");
  });

  it("versão antiga sem edição: troca sozinho e guarda a antiga como anterior", async () => {
    await bancoComManual(ANTIGO);
    const manual = await obterManual();
    expect(manual.texto).toBe(MANUAL_INICIAL);
    expect(manual.anteriorTexto).toBe(ANTIGO);
    expect(await situacaoDoManualNoBanco()).toBe("igual");
  });

  it("editado na tela: não mexe e avisa; o botão usa o texto do código e guarda o da tela", async () => {
    await bancoComManual(`${ANTIGO}\nTexto colado pelo Mateus`);
    expect((await obterManual()).texto).toContain("Texto colado pelo Mateus");
    expect(await situacaoDoManualNoBanco()).toBe("editado");
    const manual = await usarManualDoCodigo();
    expect(manual.texto).toBe(MANUAL_INICIAL);
    expect(manual.anteriorTexto).toContain("Texto colado pelo Mateus");
  });

  it("\"Voltar para a anterior\" depois da troca é respeitado (não troca de novo)", async () => {
    await bancoComManual(ANTIGO);
    const trocado = await obterManual();
    await voltarParaAnterior(trocado.id);
    expect((await obterManual()).texto).toBe(ANTIGO);
    expect(await situacaoDoManualNoBanco()).toBe("voltou");
  });

  it("editar na tela depois da troca vira \"editado\"", async () => {
    const manual = await obterManual();
    await editarInstrucao(manual.id, { texto: "MANUAL EDITADO" });
    expect(await situacaoDoManualNoBanco()).toBe("editado");
    expect((await obterManual()).texto).toBe("MANUAL EDITADO");
  });
});
