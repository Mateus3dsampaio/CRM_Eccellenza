import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { editarInstrucao, excluirInstrucao } from "@/servicos/instrucoes";

const corpo = z.object({
  titulo: z.string().trim().min(1, "Dê um título à instrução.").max(120).optional(),
  texto: z.string().trim().min(1, "Escreva o texto da instrução.").max(20000).optional(),
  ativa: z.boolean().optional(),
});

export const PATCH = rota(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await exigirUsuario("configurar");
  const { id } = await ctx.params;
  return { instrucao: await editarInstrucao(id, corpo.parse(await req.json())) };
});

export const DELETE = rota(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await exigirUsuario("configurar");
  const { id } = await ctx.params;
  await excluirInstrucao(id);
  return { ok: true };
});
