// Cria um usuário no banco configurado (DATABASE_URL). Uso:
//   npx tsx scripts/criar-usuario.ts <login> "<Nome>" <admin|consultor> <senha>
// Com a senha na linha de comando ela fica no histórico do terminal: use só em computador seu.
import { PrismaClient } from "@prisma/client";
import { criarUsuario } from "../src/servicos/usuarios";

async function main() {
  const [login, nome, perfil, senha] = process.argv.slice(2);
  if (!login || !nome || !senha || (perfil !== "admin" && perfil !== "consultor")) {
    console.error('Uso: npx tsx scripts/criar-usuario.ts <login> "<Nome>" <admin|consultor> <senha>');
    process.exit(1);
  }
  const u = await criarUsuario({ login, nome, perfil, senha });
  console.log(`Usuário criado: ${u.login} (${u.perfil}).`);
  await new PrismaClient().$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
