import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { reordenarInstrucoes } from "@/servicos/instrucoes";

export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(await req.json());
  await reordenarInstrucoes(ids);
  return { ok: true };
});
