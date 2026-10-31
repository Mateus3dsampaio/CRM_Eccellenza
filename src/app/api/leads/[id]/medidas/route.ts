import { z } from "zod";
import { naoEncontrado, rota } from "@/lib/api";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { exigirUsuario } from "@/lib/sessao";
import { marcarMudanca } from "@/lib/versao";
import { registrarAlteracao } from "@/servicos/historico";
import { atualizarResumo } from "@/servicos/leads";

type Contexto = { params: Promise<{ id: string }> };

const esquema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("adicionar"),
    ambiente: z.string().trim().min(1).max(100),
    descricao: z.string().trim().min(1).max(300),
    fonte: z.enum(["texto", "foto", "planta", "audio"]),
    confirmada: z.boolean(),
  }),
  z.object({ acao: z.literal("editar"), medidaId: z.string(), descricao: z.string().trim().min(1).max(300), confirmada: z.boolean() }),
  z.object({ acao: z.literal("remover"), medidaId: z.string() }),
]);

// Consultor corrige as medidas (FICHA-04).
export const POST = rota(async (req: Request, { params }: Contexto) => {
  const usuario = await exigirUsuario("editar_lead");
  const { id } = await params;
  if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) naoEncontrado();
  const corpo = esquema.parse(await req.json());
  if (corpo.acao === "adicionar") {
    await db.medida.create({ data: { leadId: id, ambiente: corpo.ambiente, descricao: corpo.descricao, fonte: corpo.fonte, confirmada: corpo.confirmada, criadoEm: await agora() } });
    await registrarAlteracao(id, usuario.nome, `Adicionou medida: ${corpo.ambiente} ${corpo.descricao}`);
  } else {
    const medida = await db.medida.findFirst({ where: { id: corpo.medidaId, leadId: id } });
    if (!medida) naoEncontrado();
    if (corpo.acao === "editar") {
      await db.medida.update({ where: { id: medida.id }, data: { descricao: corpo.descricao, confirmada: corpo.confirmada } });
      await registrarAlteracao(id, usuario.nome, `Corrigiu medida de ${medida.ambiente}: ${medida.descricao} → ${corpo.descricao}`);
    } else {
      await db.medida.delete({ where: { id: medida.id } });
      await registrarAlteracao(id, usuario.nome, `Removeu medida de ${medida.ambiente}: ${medida.descricao}`);
    }
  }
  await atualizarResumo(id);
  await marcarMudanca();
  return { ok: true };
});
