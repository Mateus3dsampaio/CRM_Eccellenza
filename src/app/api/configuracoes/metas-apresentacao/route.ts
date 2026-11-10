import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { META_MAXIMA } from "@/regras/apresentacao";
import { definirMetasDeApresentacao } from "@/servicos/apresentacoes";

// Só o admin define a meta mensal de apresentações realizadas de cada vendedor (null tira a meta).
export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const { metas } = z.object({ metas: z.record(z.string().max(40), z.number().int().min(0).max(META_MAXIMA).nullable()) }).parse(await req.json());
  await definirMetasDeApresentacao(metas);
  return { ok: true };
});
