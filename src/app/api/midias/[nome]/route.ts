import { rota } from "@/lib/api";
import { lerMidia } from "@/lib/midias";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";

export const dynamic = "force-dynamic";

const TIPOS: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

// Fotos e plantas ficam fora da pasta pública (SEG-03): só quem está logado vê.
export const GET = rota(async (_req: Request, { params }: { params: Promise<{ nome: string }> }) => {
  await exigirUsuario();
  const { nome } = await params;
  let dados: Buffer;
  try {
    dados = await lerMidia(nome);
  } catch {
    throw new ErroHttp(404, "Não encontrado.");
  }
  const extensao = nome.split(".").pop() ?? "";
  return new Response(new Uint8Array(dados), {
    headers: { "Content-Type": TIPOS[extensao] ?? "application/octet-stream", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
});
