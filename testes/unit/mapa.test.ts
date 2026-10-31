import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// O mapa do código (docs/mapa-do-codigo.md) tem de listar todo arquivo de código e não citar arquivo que não existe.
const RAIZ = process.cwd();
const PASTAS = ["src", "scripts", "testes"];
const EXTENSOES = /\.(ts|tsx|css)$/;

function arquivos(pasta: string): string[] {
  return readdirSync(path.join(RAIZ, pasta)).flatMap((nome) => {
    const relativo = `${pasta}/${nome}`;
    return statSync(path.join(RAIZ, relativo)).isDirectory() ? arquivos(relativo) : EXTENSOES.test(nome) ? [relativo] : [];
  });
}

const mapa = readFileSync(path.join(RAIZ, "docs", "mapa-do-codigo.md"), "utf8");
const reais = [...PASTAS.flatMap(arquivos), "prisma/seed.ts"];

describe("mapa do código", () => {
  it("lista todos os arquivos de código", () => {
    const faltando = reais.filter((a) => !mapa.includes(`\`${a}\``));
    expect(faltando, `Arquivos fora de docs/mapa-do-codigo.md: ${faltando.join(", ")}`).toEqual([]);
  });

  it("não cita arquivos que não existem", () => {
    const citados = [...mapa.matchAll(/`((?:src|scripts|testes)\/[^`\s]+\.(?:ts|tsx|css))`/g)].map((m) => m[1]);
    const fantasmas = citados.filter((a) => !reais.includes(a));
    expect(fantasmas, `Citados no mapa e inexistentes: ${fantasmas.join(", ")}`).toEqual([]);
  });
});
