import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { zerarPainel } from "@/servicos/painel-dados";

// Zera o Painel: apaga os contadores e as cópias de leads excluídos e recomeça a contar daqui. Só o admin, e só com a confirmação explícita.
export const POST = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  z.object({ confirmar: z.literal(true) }).parse(await req.json());
  const r = await zerarPainel();
  return { ok: true, zeradoEm: r.zeradoEm.toISOString() };
});
