import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { marcarMudanca } from "@/lib/versao";
import { criarUsuario } from "@/servicos/usuarios";

// Só o admin cadastra usuários.
const corpo = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(80),
  login: z.string().trim().min(1, "Informe o login.").max(30),
  senha: z.string().min(1, "Informe a senha.").max(200),
  perfil: z.enum(["admin", "consultor"]),
});

export const POST = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const u = await criarUsuario(corpo.parse(await req.json()));
  await marcarMudanca();
  return { id: u.id };
});
