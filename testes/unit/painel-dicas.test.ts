import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INDICADORES_DO_PAINEL } from "@/regras/painel";
import { DICAS_DO_PAINEL } from "@/regras/painel-dicas";
import { SCRIPT_DO_PAINEL_EXPORTADO } from "@/regras/painel-html";

// Toda dica que o Painel e o arquivo exportado pedem precisa existir: chave errada = número sem explicação.
describe("dicas do painel", () => {
  it("todo indicador do período tem dica, inclusive os da visão por vendedor", () => {
    for (const [tipo] of INDICADORES_DO_PAINEL) expect(DICAS_DO_PAINEL[tipo], tipo).toBeTruthy();
    for (const tipo of ["recebidos", "atendidos"]) expect(DICAS_DO_PAINEL[tipo], tipo).toBeTruthy();
  });

  it("toda chave fixa usada pela tela e pelo arquivo exportado existe", () => {
    const tela = readFileSync("src/componentes/painel/painel.tsx", "utf8");
    const html = readFileSync("src/regras/painel-html.ts", "utf8");
    const chaves = new Set<string>();
    for (const m of tela.matchAll(/dicaDoPainel\("([a-z_]+)"\)/g)) chaves.add(m[1]);
    for (const m of tela.matchAll(/"([a-z_]+)"\]/g)) chaves.add(m[1]); // última coluna das listas de cartões
    for (const m of tela.matchAll(/"(funil(?:_vendedor)?)"/g)) chaves.add(m[1]);
    for (const m of SCRIPT_DO_PAINEL_EXPORTADO.matchAll(/, "([a-z_]+)"\)/g)) chaves.add(m[1]);
    for (const m of html.matchAll(/data-dica="([a-z_]+)"/g)) chaves.add(m[1]);
    expect(chaves.size).toBeGreaterThan(20);
    for (const c of chaves) expect(DICAS_DO_PAINEL[c], c).toBeTruthy();
  });
});
