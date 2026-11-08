import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { listarModelos } from "@/servicos/modelos-ia";
import { PROVEDORES_BOT } from "@/servicos/provedor-bot";

export const dynamic = "force-dynamic";

// Modelos disponíveis na conta da empresa escolhida (?provedor=claude|openai). Só admin.
export const GET = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const provedor = z.enum(PROVEDORES_BOT).parse(new URL(req.url).searchParams.get("provedor"));
  return listarModelos(provedor);
});
