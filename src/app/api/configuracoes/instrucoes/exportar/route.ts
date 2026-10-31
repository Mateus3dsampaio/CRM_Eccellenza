import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { montarZip } from "@/lib/zip";
import { paraExportar } from "@/servicos/instrucoes";

// Exporta todas as instruções ou só as escolhidas, em um .txt único ou em .zip (um .txt por instrução).
export const POST = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const { ids, formato } = z.object({ ids: z.array(z.string()).nullable(), formato: z.enum(["txt", "zip"]) }).parse(await req.json());
  const { texto, arquivos } = await paraExportar(ids);
  const dia = new Date().toISOString().slice(0, 10);
  if (formato === "zip") {
    return new Response(new Uint8Array(montarZip(arquivos)), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="instrucoes-${dia}.zip"` },
    });
  }
  return new Response(texto + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="instrucoes-${dia}.txt"` },
  });
});
