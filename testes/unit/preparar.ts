// Cria um banco só para os testes (prisma/teste.db), sem tocar no banco do simulador (crm.db).
import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export default function preparar() {
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
