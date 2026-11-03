import { z } from "zod";
import { naoEncontrado, rota } from "@/lib/api";
import { db } from "@/lib/db";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { assumirConversa, devolverAoBot, marcarConversaVista, responderComoConsultor } from "@/servicos/conversa";

type Contexto = { params: Promise<{ id: string }> };

const esquema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("assumir") }),
  z.object({ acao: z.literal("devolver") }),
  z.object({ acao: z.literal("vista") }),
  z.object({ acao: z.literal("responder"), texto: z.string().max(4000).optional(), modelo: z.string().max(50).optional() }),
]);

// Consultor assume, devolve ao bot ou responde (CHAT-03, BOT-05).
export const POST = rota(async (req: Request, { params }: Contexto) => {
  const usuario = await exigirUsuario("enviar_mensagem");
  const { id } = await params;
  if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) naoEncontrado();
  const corpo = esquema.parse(await req.json());
  if (corpo.acao === "assumir") await assumirConversa(id, usuario);
  else if (corpo.acao === "devolver") await devolverAoBot(id, usuario);
  else if (corpo.acao === "vista") await marcarConversaVista(id);
  else {
    if (!corpo.texto?.trim() && !corpo.modelo) throw new ErroHttp(400, "Escreva a mensagem ou escolha um modelo.");
    try {
      await responderComoConsultor(id, usuario, corpo.texto, corpo.modelo);
    } catch (erro) {
      throw new ErroHttp(400, erro instanceof Error ? erro.message : "Não foi possível enviar.");
    }
  }
  return { ok: true };
});
