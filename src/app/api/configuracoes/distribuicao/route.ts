import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { definirModoDistribuicao } from "@/servicos/configuracoes";

// Só o admin escolhe como os leads são distribuídos.
export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const { modo } = z.object({ modo: z.enum(["rodizio", "menos_leads"]) }).parse(await req.json());
  await definirModoDistribuicao(modo);
  return { ok: true };
});
