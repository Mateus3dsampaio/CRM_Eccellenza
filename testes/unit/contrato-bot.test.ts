import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { montarContratoDoBot } from "@/bot/contrato";
import { FERRAMENTAS } from "@/bot/ferramentas";

// O contrato do bot (docs/contrato-do-bot.md) é lido pelo agente das instruções. Se o código do bot mudou e o arquivo não, ele fica enganado.
describe("contrato do bot (tarefa 38)", () => {
  it("docs/contrato-do-bot.md está igual ao código", () => {
    const arquivo = readFileSync(path.join(process.cwd(), "docs", "contrato-do-bot.md"), "utf8").replace(/\r\n/g, "\n");
    expect(arquivo === montarContratoDoBot(), "O contrato do bot está desatualizado: rode `npm run contrato:bot` e faça o commit do arquivo.").toBe(true);
  });

  it("cita todas as ferramentas e não tem data (para não mudar sozinho)", () => {
    const texto = montarContratoDoBot();
    for (const f of FERRAMENTAS) expect(texto).toContain(`### \`${f.name}\``);
    expect(texto).not.toMatch(/gerado em \d/i);
  });
});
