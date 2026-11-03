import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { apagarMidiaDaMensagem } from "@/servicos/midias";

export const dynamic = "force-dynamic";

// Só o admin apaga um arquivo da conversa (a mensagem fica, com o aviso "arquivo apagado").
export const DELETE = rota(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const usuario = await exigirUsuario("apagar_midia");
  const { id } = await params;
  if (!(await apagarMidiaDaMensagem(id, "pelo administrador", usuario.nome))) throw new ErroHttp(404, "Arquivo não encontrado.");
  return { ok: true };
});
