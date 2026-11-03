import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { exportarDadosDoCliente } from "@/servicos/lgpd";

export const dynamic = "force-dynamic";

// LGPD (direito de acesso): admin baixa tudo o que o CRM guarda de um cliente.
export const GET = rota(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const usuario = await exigirUsuario("excluir_lead");
  const { id } = await params;
  if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) throw new ErroHttp(404, "Lead não encontrado.");
  const { nome, zip } = await exportarDadosDoCliente(id, usuario.nome);
  return new Response(new Uint8Array(zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${nome}"`, "Cache-Control": "no-store" } });
});
