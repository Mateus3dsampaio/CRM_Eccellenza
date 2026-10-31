import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { TAMANHO_MAXIMO } from "@/lib/midias";
import { normalizarTelefone } from "@/regras/telefone";
import { nomeExibicao } from "@/servicos/consultas";
import { ErroConversa, receberMensagemCliente } from "@/servicos/conversa";
import { marcarLidas, statusEfetivo } from "@/servicos/mensagens";

export const dynamic = "force-dynamic";

// Tela do simulador (CHAT-01): lista de clientes e conversa vista pelo lado do cliente.
export const GET = rota(async (req: Request) => {
  await exigirUsuario();
  const telefone = normalizarTelefone(new URL(req.url).searchParams.get("telefone") ?? "");
  const leads = await db.lead.findMany({ orderBy: { ultimaMensagemEm: "desc" }, take: 100 });
  const contatos = leads.map((l) => ({ telefone: l.telefone, nome: nomeExibicao(l), nomePerfil: l.nomePerfil, previa: l.ultimaMensagemPrevia, avatarCor: l.avatarCor }));
  if (!telefone) return { contatos };
  const lead = await db.lead.findUnique({ where: { telefone } });
  if (!lead) return { contatos, conversa: null };
  // O cliente está com a conversa aberta: as mensagens da loja ficam como lidas.
  await marcarLidas(lead.id);
  const quando = await agora();
  const mensagens = await db.mensagem.findMany({ where: { leadId: lead.id }, orderBy: { enviadaEm: "asc" } });
  return {
    contatos,
    conversa: {
      leadId: lead.id,
      nome: nomeExibicao(lead),
      modo: lead.modoAtendimento,
      erroBot: lead.erroBot,
      mensagens: mensagens
        // Mensagens que falharam nunca chegam ao cliente.
        .filter((m) => m.status !== "falhou")
        .map((m) => ({ id: m.id, autor: m.autor, texto: m.texto, midia: m.midiaArquivo, enviadaEm: m.enviadaEm.toISOString(), status: statusEfetivo(m, quando) })),
    },
  };
});

export const POST = rota(async (req: Request) => {
  await exigirUsuario();
  const form = await req.formData();
  const arquivo = form.get("imagem");
  let imagem: { dados: Buffer; tipo: string } | null = null;
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > TAMANHO_MAXIMO) throw new ErroHttp(400, "Imagem maior que 5 MB.");
    imagem = { dados: Buffer.from(await arquivo.arrayBuffer()), tipo: arquivo.type };
  }
  try {
    return await receberMensagemCliente({
      telefone: String(form.get("telefone") ?? ""),
      nomePerfil: String(form.get("nome") ?? "") || null,
      texto: String(form.get("texto") ?? ""),
      imagem,
    });
  } catch (erro) {
    if (erro instanceof ErroConversa) throw new ErroHttp(400, erro.message);
    throw erro;
  }
});
