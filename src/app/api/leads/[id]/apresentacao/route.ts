import { z } from "zod";
import { naoEncontrado, rota } from "@/lib/api";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { concluirMedicao, confirmarEstimativa, pularMedicao } from "@/servicos/apresentacoes";

type Contexto = { params: Promise<{ id: string }> };

const esquema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("concluir_medicao") }),
  z.object({ acao: z.literal("pular_medicao"), pular: z.boolean() }),
  z.object({ acao: z.literal("estimativa_alinhada") }),
]);

// Caminho até a apresentação: medição concluída, "cliente tem projeto" (pular a medição) e a estimativa de valores alinhada.
export const POST = rota(async (req: Request, { params }: Contexto) => {
  const usuario = await exigirUsuario("editar_lead");
  const { id } = await params;
  const corpo = esquema.parse(await req.json());
  if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) naoEncontrado();
  if (corpo.acao === "concluir_medicao") await concluirMedicao(id, usuario.nome);
  else if (corpo.acao === "pular_medicao") await pularMedicao(id, corpo.pular, usuario.nome);
  else await confirmarEstimativa(id, usuario.nome);
  return { ok: true };
});
