import { naoEncontrado, rota } from "@/lib/api";
import { db } from "@/lib/db";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { formatarTamanho, LIMITE_CORPO_ANEXO, limiteDoTipo, tipoPodeEnviar } from "@/regras/midia";
import { responderComoConsultorComArquivo } from "@/servicos/conversa";

export const dynamic = "force-dynamic";

// Consultor envia imagem, vídeo (MP4) ou PDF ao cliente, com legenda opcional. O servidor confere tipo, tamanho e o conteúdo.
export const POST = rota(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const usuario = await exigirUsuario("enviar_mensagem");
  const { id } = await params;
  if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) naoEncontrado();
  // Recusa antes de ler o corpo: um envio enorme não ocupa a memória do servidor.
  if (Number(req.headers.get("content-length") ?? 0) > LIMITE_CORPO_ANEXO) throw new ErroHttp(413, "Arquivo grande demais.");
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroHttp(400, "Escolha um arquivo.");
  const tipo = arquivo.type.split(";")[0].trim().toLowerCase();
  if (!tipoPodeEnviar(tipo)) throw new ErroHttp(400, "Para enviar, use imagem JPG ou PNG, vídeo MP4 ou PDF.");
  if (arquivo.size > limiteDoTipo(tipo)) throw new ErroHttp(400, `Arquivo maior que ${formatarTamanho(limiteDoTipo(tipo))}.`);
  const legenda = String(form.get("legenda") ?? "").slice(0, 1000);
  try {
    const mensagem = await responderComoConsultorComArquivo(id, usuario, { dados: Buffer.from(await arquivo.arrayBuffer()), tipo, nome: arquivo.name }, legenda || undefined);
    return { ok: true, mensagemId: mensagem.id };
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Não foi possível enviar.");
  }
});
