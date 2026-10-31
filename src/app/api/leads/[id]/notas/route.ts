import { z } from "zod";
import { naoEncontrado, rota } from "@/lib/api";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { exigirUsuario } from "@/lib/sessao";
import { marcarMudanca } from "@/lib/versao";
import { registrarAlteracao } from "@/servicos/historico";

type Contexto = { params: Promise<{ id: string }> };
const esquema = z.object({ texto: z.string().trim().min(1, "Escreva a nota.").max(2000) });

// Notas internas (FICHA-03): o cliente nunca vê.
export const POST = rota(async (req: Request, { params }: Contexto) => {
  const usuario = await exigirUsuario("editar_lead");
  const { id } = await params;
  const { texto } = esquema.parse(await req.json());
  if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) naoEncontrado();
  await db.nota.create({ data: { leadId: id, autorNome: usuario.nome, texto, criadoEm: await agora() } });
  await marcarMudanca();
  return { ok: true };
});

// Qualquer consultor pode excluir nota (decisão do Mateus). A exclusão fica no histórico do lead.
export const DELETE = rota(async (req: Request, { params }: Contexto) => {
  const usuario = await exigirUsuario("editar_lead");
  const { id } = await params;
  const { notaId } = z.object({ notaId: z.string().min(1) }).parse(await req.json());
  const nota = await db.nota.findFirst({ where: { id: notaId, leadId: id } });
  if (!nota) naoEncontrado();
  await db.nota.delete({ where: { id: nota.id } });
  await registrarAlteracao(id, usuario.nome, "Excluiu uma nota interna");
  await marcarMudanca();
  return { ok: true };
});
