import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { definirPrazosDeEspera } from "@/servicos/configuracoes";

// Só o admin define quando o card do cliente que espera fica amarelo e vermelho (minutos).
export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const prazos = z.object({ amarelo: z.number(), vermelho: z.number() }).parse(await req.json());
  try {
    await definirPrazosDeEspera(prazos);
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Prazos inválidos.");
  }
  return { ok: true };
});
