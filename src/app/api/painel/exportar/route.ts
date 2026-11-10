import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { exportarPainelEmHtml } from "@/servicos/painel-exportar";

export const dynamic = "force-dynamic";

// Baixa o Painel inteiro (tudo desde o último "Zerar painel") num arquivo HTML com filtro de período. Só o admin.
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  const { nomeArquivo, html } = await exportarPainelEmHtml();
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="${nomeArquivo}"`, "Cache-Control": "no-store" },
  });
});
