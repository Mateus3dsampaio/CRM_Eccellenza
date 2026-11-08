import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { definirRegrasDePresenca } from "@/servicos/configuracoes";

// Só o admin define as regras de presença e da fila da loja fechada (Configurações > Geral).
export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const regras = z
    .object({
      desligarNoFechamento: z.boolean(),
      repartirFila: z.boolean(),
      repartirMin: z.number(),
      verificarPresenca: z.boolean(),
      verificarMin: z.number(),
      avisoCedoMin: z.number(),
      quemRecebe: z.enum(["admin", "todos"]),
    })
    .parse(await req.json());
  try {
    await definirRegrasDePresenca(regras);
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Regras inválidas.");
  }
  return { ok: true };
});
