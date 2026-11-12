import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { LIMITE_REVISAO } from "@/regras/revisao-texto";
import { revisarTexto } from "@/servicos/revisao-texto";

const esquema = z.object({ texto: z.string().max(LIMITE_REVISAO + 1000) });

// Revisão de texto do vendedor (botão "Revisar texto"): só devolve a sugestão, não grava nem envia nada.
export const POST = rota(async (req: Request) => {
  await exigirUsuario("enviar_mensagem");
  const { texto } = esquema.parse(await req.json());
  return await revisarTexto(texto);
});
