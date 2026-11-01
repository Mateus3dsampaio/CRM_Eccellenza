import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { exportarDesempenho } from "@/servicos/exportacao";

// Exporta o desempenho de um vendedor (até 30 dias) em .zip, para analisar fora do CRM. Só o admin.
export const POST = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const pedido = z
    .object({ vendedorId: z.string().min(1), de: z.string(), ate: z.string(), incluirMidia: z.boolean() })
    .parse(await req.json());
  const { nomeArquivo, zip } = await exportarDesempenho(pedido);
  return new Response(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${nomeArquivo}"` },
  });
});
