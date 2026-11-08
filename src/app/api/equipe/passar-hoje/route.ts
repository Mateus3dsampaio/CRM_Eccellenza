import { z } from "zod";
import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { passarOsDeHoje, resumoDeHoje } from "@/servicos/presenca";

export const dynamic = "force-dynamic";

// O que o vendedor ausente tem hoje (a janela "Passar os de hoje para…" mostra antes de confirmar).
export const GET = rota(async (req: Request) => {
  await exigirUsuario();
  const deId = new URL(req.url).searchParams.get("deId");
  if (!deId) throw new ErroHttp(400, "Informe o vendedor.");
  const consultores = await db.usuario.findMany({ where: { perfil: "consultor", ativo: true, id: { not: deId } }, orderBy: { nome: "asc" }, select: { id: true, nome: true, status: true } });
  return { ...(await resumoDeHoje(deId)), consultores };
});

const esquema = z.object({ deId: z.string().min(1), paraId: z.string().min(1) });

// Qualquer pessoa logada pode passar os de hoje (o aviso de ausência vai para todos); fica registrado na ficha com o nome de quem passou.
export const POST = rota(async (req: Request) => {
  const usuario = await exigirUsuario();
  const { deId, paraId } = esquema.parse(await req.json());
  try {
    return await passarOsDeHoje(deId, paraId, usuario.nome);
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Não foi possível passar os de hoje.");
  }
});
