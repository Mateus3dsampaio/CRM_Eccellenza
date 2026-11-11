import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { definirRegrasDeRecuperacao } from "@/servicos/configuracoes";

// Só o admin define as regras da recuperação de leads (Configurações > Recuperação de leads).
export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const regras = z
    .object({
      ligado: z.boolean(),
      primeiraMin: z.number(),
      primeiraTexto: z.string(),
      segundaModo: z.enum(["horas", "dia_seguinte"]),
      segundaHoras: z.number(),
      segundaHora: z.string(),
      segundaTexto: z.string(),
      horarioInicio: z.number(),
      horarioFim: z.number(),
      perdidoHoras: z.number(),
    })
    .parse(await req.json());
  try {
    await definirRegrasDeRecuperacao(regras);
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Regras inválidas.");
  }
  return { ok: true };
});
