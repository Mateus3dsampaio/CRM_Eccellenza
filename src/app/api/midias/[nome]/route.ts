import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { lerMidia } from "@/lib/midias";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { familiaDoTipo, intervaloDeBytes, nomeSeguroDeArquivo, tipoDaExtensao } from "@/regras/midia";

export const dynamic = "force-dynamic";

// Fotos, vídeos e PDFs ficam fora da pasta pública (SEG-03): só quem está logado vê.
// Imagem e vídeo abrem na tela (vídeo aceita avançar/voltar). PDF e "?baixar=1" sempre baixam, nunca abrem dentro do site.
export const GET = rota(async (req: Request, { params }: { params: Promise<{ nome: string }> }) => {
  await exigirUsuario();
  const { nome } = await params;
  let dados: Buffer;
  try {
    dados = await lerMidia(nome);
  } catch {
    throw new ErroHttp(404, "Não encontrado.");
  }
  const tipo = tipoDaExtensao(nome.split(".").pop() ?? "") ?? "application/octet-stream";
  // Documentos (PDF, Word, Excel, DWG) nunca abrem dentro do site: sempre baixam.
  const baixar = familiaDoTipo(tipo) === "documento" || new URL(req.url).searchParams.get("baixar") === "1";
  const cabecalhos: Record<string, string> = {
    "Content-Type": tipo,
    // Vídeo e PDF não ficam guardados no navegador (depois de apagados não devem continuar acessíveis); imagem pode por poucos minutos.
    "Cache-Control": tipo.startsWith("image/") ? "private, max-age=300" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  };
  if (baixar) {
    const m = await db.mensagem.findFirst({ where: { midiaArquivo: nome }, select: { midiaNome: true } });
    const nomeArquivo = nomeSeguroDeArquivo(m?.midiaNome, nome);
    cabecalhos["Content-Disposition"] = `attachment; filename="${nomeArquivo.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`;
  }
  const faixa = intervaloDeBytes(req.headers.get("range"), dados.length);
  if (req.headers.get("range") && !faixa) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${dados.length}` } });
  if (faixa) {
    const trecho = dados.subarray(faixa.inicio, faixa.fim + 1);
    return new Response(new Uint8Array(trecho), { status: 206, headers: { ...cabecalhos, "Content-Range": `bytes ${faixa.inicio}-${faixa.fim}/${dados.length}`, "Content-Length": String(trecho.length) } });
  }
  return new Response(new Uint8Array(dados), { headers: { ...cabecalhos, "Content-Length": String(dados.length) } });
});
