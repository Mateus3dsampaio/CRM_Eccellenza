import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { voltarParaAnterior } from "@/servicos/instrucoes";

export const POST = rota(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await exigirUsuario("configurar");
  const { id } = await ctx.params;
  return { instrucao: await voltarParaAnterior(id) };
});
