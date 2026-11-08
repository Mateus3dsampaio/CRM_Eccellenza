import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { definirRegrasDeRetorno } from "@/servicos/configuracoes";

// Só o admin define as regras do retorno com a loja fechada (Configurações > Geral).
export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const regras = z.object({ automatico: z.boolean(), modelo: z.string().min(1).max(60), semHorarioMin: z.number() }).parse(await req.json());
  try {
    await definirRegrasDeRetorno(regras);
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Regras inválidas.");
  }
  return { ok: true };
});
