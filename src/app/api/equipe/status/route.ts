import { z } from "zod";
import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { definirStatusConsultor, leadsNaFila } from "@/servicos/distribuicao";

export const dynamic = "force-dynamic";

// Status do consultor logado (online ou em almoço).
export const GET = rota(async () => {
  const usuario = await exigirUsuario();
  const dados = await db.usuario.findUnique({ where: { id: usuario.id }, select: { status: true } });
  return { status: dados?.status ?? "online" };
});

const esquema = z.object({ status: z.enum(["online", "almoco", "offline"]), usuarioId: z.string().optional() });

// O consultor muda o próprio status; o admin muda o de qualquer consultor.
export const POST = rota(async (req: Request) => {
  const usuario = await exigirUsuario();
  const corpo = esquema.parse(await req.json());
  const alvoId = corpo.usuarioId ?? usuario.id;
  if (usuario.perfil !== "admin" && alvoId !== usuario.id) throw new ErroHttp(403, "Você só pode mudar o seu próprio status.");
  const alvo = await db.usuario.findFirst({ where: { id: alvoId, perfil: "consultor", ativo: true } });
  if (!alvo) throw new ErroHttp(400, "Só consultores têm status de presença.");
  if (corpo.status === "almoco" && alvo.status === "offline") throw new ErroHttp(400, "Fique online antes de sair para o almoço.");
  await definirStatusConsultor(alvo.id, corpo.status);
  // Online antes do horário de repartir: a fila acumulada espera (tarefa 35). Avisa quantos leads aguardam.
  const filaAguardando = corpo.status === "online" ? (await leadsNaFila()).length : 0;
  return { ok: true, filaAguardando };
});
