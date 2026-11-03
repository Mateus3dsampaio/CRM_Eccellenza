// Roda os testes contra um Postgres de verdade (o que vai para o Railway), e depois volta o cliente para SQLite.
// Uso: CRM_TESTE_POSTGRES=postgresql://usuario:senha@host:5432/crm_teste npm run test:postgres
// O banco precisa ter "teste" no nome: os testes apagam tudo nele.
import { execSync } from "node:child_process";

const url = process.env.CRM_TESTE_POSTGRES;
if (!url) {
  console.error("Defina CRM_TESTE_POSTGRES com o endereço de um banco Postgres de TESTE (com 'teste' no nome).");
  process.exit(1);
}
const rodar = (cmd: string) => execSync(cmd, { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
let falhou = false;
try {
  rodar("npx prisma generate --schema prisma/postgres/schema.prisma");
  rodar("npx vitest run");
} catch {
  falhou = true;
} finally {
  rodar("npx prisma generate");
}
process.exit(falhou ? 1 : 0);
