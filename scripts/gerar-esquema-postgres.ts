// Gera prisma/postgres/schema.prisma a partir do schema.prisma (SQLite, usado no computador e nos testes).
// O sistema tem UM esquema só (o do SQLite). Este script copia tudo e troca apenas o tipo de banco, para o Railway.
// Uso: npm run esquema:postgres   (confira com: npm test, que barra os dois esquemas fora de sincronia)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function esquemaPostgres(original: string): string {
  const trocado = original
    .replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"')
    .replace(/url\s*=\s*"file:[^"]*"/, 'url      = env("DATABASE_URL")');
  if (trocado === original || !trocado.includes("postgresql")) throw new Error("Não achei o bloco do banco no schema.prisma.");
  return `// ARQUIVO GERADO por "npm run esquema:postgres" a partir de prisma/schema.prisma. NÃO edite à mão.\n${trocado}`;
}

if (process.argv[1]?.endsWith("gerar-esquema-postgres.ts")) {
  const pasta = path.join(process.cwd(), "prisma");
  writeFileSync(path.join(pasta, "postgres", "schema.prisma"), esquemaPostgres(readFileSync(path.join(pasta, "schema.prisma"), "utf8")));
  console.log("prisma/postgres/schema.prisma atualizado.");
}
