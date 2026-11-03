import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { definirAtivo, editarUsuario, redefinirSenha } from "@/servicos/usuarios";

// Só o admin mexe em usuários. Cada campo é opcional: a tela manda só o que mudou.
const corpo = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(80).optional(),
  perfil: z.enum(["admin", "consultor"]).optional(),
  senha: z.string().min(1).max(200).optional(),
  ativo: z.boolean().optional(),
  transferirPara: z.string().min(1).optional(),
});

export const PATCH = rota(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await exigirUsuario("configurar");
  const { id } = await ctx.params;
  const dados = corpo.parse(await req.json());
  let transferidos = 0;
  // Desativar vem primeiro: se falhar (último admin, leads sem destino), nada mais é gravado.
  if (dados.ativo !== undefined) transferidos = await definirAtivo(id, dados.ativo, admin.id, dados.transferirPara);
  if (dados.nome !== undefined || dados.perfil !== undefined) await editarUsuario(id, { nome: dados.nome, perfil: dados.perfil });
  if (dados.senha !== undefined) await redefinirSenha(id, dados.senha);
  return { ok: true, transferidos };
});
