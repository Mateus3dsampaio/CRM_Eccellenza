// Cria um banco só para os testes (prisma/teste.db), sem tocar no banco do simulador (crm.db).
import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export default function preparar() {
  // Teste contra Postgres (npm run test:postgres): recria as tabelas do banco de teste a partir das migrações.
  const urlPostgres = process.env.CRM_TESTE_POSTGRES;
  if (urlPostgres) {
    if (!/teste/i.test(urlPostgres)) throw new Error('A URL do Postgres de teste precisa ter "teste" no nome do banco (o teste apaga tudo).');
    const env = { ...process.env, DATABASE_URL: urlPostgres };
    // Apaga e recria só o banco de teste (o nome já foi conferido acima) e aplica as migrações do jeito do Railway.
    execSync("npx prisma db execute --stdin --schema prisma/postgres/schema.prisma", { input: "DROP SCHEMA public CASCADE; CREATE SCHEMA public;", stdio: ["pipe", "ignore", "ignore"], env });
    execSync("npx prisma migrate deploy --schema prisma/postgres/schema.prisma", { stdio: "ignore", env });
    return () => {};
  }
  const pasta = path.join(process.cwd(), "prisma");
  const teste = path.join(pasta, "teste.db");
  const esquemaTeste = path.join(pasta, "schema.teste.prisma");
  rmSync(teste, { force: true });
  // Mesmo esquema, apontando para o banco de teste.
  const original = readFileSync(path.join(pasta, "schema.prisma"), "utf8");
  const esquema = original.replace(/url\s*=\s*"file:\.\/crm\.db"/, 'url = "file:./teste.db"');
  if (esquema === original) throw new Error("Não achei a URL do banco no schema.prisma: o teste não pode rodar no banco do simulador.");
  writeFileSync(esquemaTeste, esquema);
  try {
    execSync(`npx prisma db push --skip-generate --schema "${esquemaTeste}"`, { stdio: "ignore" });
  } finally {
    rmSync(esquemaTeste, { force: true });
  }
  return () => rmSync(teste, { force: true });
}
