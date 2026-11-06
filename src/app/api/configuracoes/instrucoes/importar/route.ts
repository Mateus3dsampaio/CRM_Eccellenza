import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { ARQUIVOS_MAX } from "@/regras/importar-instrucoes";
import { importarInstrucoes } from "@/servicos/instrucoes";

const corpo = z.object({
  arquivos: z
    .array(z.object({ nome: z.string().max(200), texto: z.string().max(200000) }))
    .min(1, "Escolha ao menos um arquivo.")
    .max(ARQUIVOS_MAX, `No máximo ${ARQUIVOS_MAX} arquivos por vez.`),
});

// Importar instruções de arquivos .txt (só admin). O título e o número saem do começo de cada texto.
export const POST = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  return { ok: true, ...(await importarInstrucoes(corpo.parse(await req.json()).arquivos)) };
});
