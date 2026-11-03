import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { esquemaPostgres } from "../../scripts/gerar-esquema-postgres";

const RAIZ = process.cwd();
const sqlite = readFileSync(path.join(RAIZ, "prisma", "schema.prisma"), "utf8");
const postgres = readFileSync(path.join(RAIZ, "prisma", "postgres", "schema.prisma"), "utf8");

describe("esquema do banco para o Railway (Postgres)", () => {
  it("está em sincronia com o schema.prisma (se falhar: npm run esquema:postgres)", () => {
    expect(postgres).toBe(esquemaPostgres(sqlite));
  });

  it("as migrações do Postgres cobrem toda tabela e coluna do esquema (se falhar, falta uma migração nova)", () => {
    const pasta = path.join(RAIZ, "prisma", "postgres", "migrations");
    const sql = readdirSync(pasta, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => readFileSync(path.join(pasta, d.name, "migration.sql"), "utf8"))
      .join("\n");
    const faltando: string[] = [];
    for (const [, modelo, corpo] of postgres.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      if (!sql.includes(`CREATE TABLE "${modelo}"`)) faltando.push(`tabela ${modelo}`);
      for (const [, campo] of corpo.matchAll(/^\s+(\w+)\s+(?:String|Int|Float|Boolean|DateTime|BigInt|Decimal|Json)\b/gm)) {
        if (!sql.includes(`"${campo}"`)) faltando.push(`${modelo}.${campo}`);
      }
    }
    expect(faltando).toEqual([]);
  });
});
