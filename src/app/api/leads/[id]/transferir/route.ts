import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { transferirLead } from "@/servicos/distribuicao";

// Passa UM lead para outro consultor. Só admin.
export const POST = rota(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await exigirUsuario("configurar");
  const { id } = await ctx.params;
  const { para } = z.object({ para: z.string().min(1, "Escolha o consultor.") }).parse(await req.json());
  await transferirLead(id, para, admin.nome);
  return { ok: true };
});
