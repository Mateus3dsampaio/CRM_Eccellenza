import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { resumoDeMidias } from "@/servicos/midias";

export const dynamic = "force-dynamic";

const esquema = z.union([z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(500) }), z.object({ etapa: z.string().min(1).max(40) })]);

// Antes de excluir leads: quantos arquivos (e quantos MB) vão junto. Só quem pode excluir.
export const POST = rota(async (req: Request) => {
  await exigirUsuario("excluir_lead");
  return resumoDeMidias(esquema.parse(await req.json()));
});
