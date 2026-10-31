import { z } from "zod";
import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { janelaAberta } from "@/regras/janela24h";
import { buscarModelo } from "@/regras/modelos";
import { normalizarTelefone } from "@/regras/telefone";
import { nomeExibicao } from "@/servicos/consultas";
import { responderComoConsultor } from "@/servicos/conversa";
import { obterOuCriarLead } from "@/servicos/leads";

export const dynamic = "force-dynamic";

// Consulta o número digitado: já existe? a janela de 24h está aberta? (MSG-01/02)
export const GET = rota(async (req: Request) => {
  await exigirUsuario("enviar_mensagem");
  const telefone = normalizarTelefone(new URL(req.url).searchParams.get("telefone") ?? "");
  if (!telefone) return { valido: false };
  const lead = await db.lead.findUnique({ where: { telefone } });
  return {
    valido: true,
    telefone,
    lead: lead ? { id: lead.id, nome: nomeExibicao(lead) } : null,
    janelaAberta: janelaAberta(lead?.ultimaMsgClienteEm, await agora()),
  };
});

// Um número por vez, sem disparo em massa (MSG-04).
const esquema = z.object({ telefone: z.string().max(30), texto: z.string().max(4000).optional(), modelo: z.string().max(50).optional() }).strict();

export const POST = rota(async (req: Request) => {
  const usuario = await exigirUsuario("enviar_mensagem");
  const corpo = esquema.parse(await req.json());
  const telefone = normalizarTelefone(corpo.telefone);
  if (!telefone) throw new ErroHttp(400, "Número inválido. Use DDI + DDD + número, ex.: +55 88 99999-1234.");
  if (!corpo.texto?.trim() && !corpo.modelo) throw new ErroHttp(400, "Escreva a mensagem ou escolha um modelo.");
  // Valida a regra das 24h antes de criar o lead: envio recusado não deixa card vazio nem conta "lead novo".
  if (!corpo.modelo) {
    const existente = await db.lead.findUnique({ where: { telefone } });
    if (!janelaAberta(existente?.ultimaMsgClienteEm, await agora())) {
      throw new ErroHttp(400, "Fora da janela de 24h: só é possível enviar um modelo aprovado.");
    }
  }
  if (corpo.modelo && !buscarModelo(corpo.modelo)) throw new ErroHttp(400, "Modelo de mensagem não encontrado.");
  const lead = await obterOuCriarLead(telefone);
  try {
    const mensagem = await responderComoConsultor(lead.id, usuario, corpo.texto, corpo.modelo);
    return { ok: true, leadId: lead.id, mensagemId: mensagem.id };
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Não foi possível enviar.");
  }
});
