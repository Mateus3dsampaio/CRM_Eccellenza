import { z } from "zod";
import { rota } from "@/lib/api";
import { agora } from "@/lib/relogio";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { janelaAberta } from "@/regras/janela24h";
import { buscarModelo } from "@/regras/modelos";
import { normalizarTelefone } from "@/regras/telefone";
import { CODIGOS_ORIGEM_CONSENTIMENTO, temConsentimento } from "@/regras/consentimento";
import { nomeExibicao } from "@/servicos/consultas";
import { responderComoConsultor } from "@/servicos/conversa";
import { acharLeadPorTelefone, obterOuCriarLead } from "@/servicos/leads";
import { registrarConsentimento } from "@/servicos/lgpd";

export const dynamic = "force-dynamic";

// Consulta o número digitado: já existe? a janela de 24h está aberta? (MSG-01/02)
export const GET = rota(async (req: Request) => {
  await exigirUsuario("enviar_mensagem");
  const telefone = normalizarTelefone(new URL(req.url).searchParams.get("telefone") ?? "");
  if (!telefone) return { valido: false };
  // Acha o cliente com ou sem o 9 (Brasil).
  const lead = await acharLeadPorTelefone(telefone);
  return {
    valido: true,
    telefone,
    lead: lead ? { id: lead.id, nome: nomeExibicao(lead) } : null,
    janelaAberta: janelaAberta(lead?.ultimaMsgClienteEm, await agora()),
    // Modelo (mensagem iniciada pela loja) pede consentimento registrado e não vale para quem pediu para parar.
    naoReceber: !!lead?.naoReceberEm,
    temConsentimento: lead ? temConsentimento(lead) : false,
  };
});

// Um número por vez, sem disparo em massa (MSG-04).
const esquema = z
  .object({
    telefone: z.string().max(30),
    texto: z.string().max(4000).optional(),
    modelo: z.string().max(50).optional(),
    // Como o cliente autorizou receber mensagens da loja (obrigatório ao mandar modelo para quem ainda não tem consentimento).
    consentimento: z.enum(CODIGOS_ORIGEM_CONSENTIMENTO).optional(),
  })
  .strict();

export const POST = rota(async (req: Request) => {
  const usuario = await exigirUsuario("enviar_mensagem");
  const corpo = esquema.parse(await req.json());
  const telefone = normalizarTelefone(corpo.telefone);
  if (!telefone) throw new ErroHttp(400, "Número inválido. Use DDI + DDD + número, ex.: +55 88 99999-1234.");
  if (!corpo.texto?.trim() && !corpo.modelo) throw new ErroHttp(400, "Escreva a mensagem ou escolha um modelo.");
  // Valida a regra das 24h antes de criar o lead: envio recusado não deixa card vazio nem conta "lead novo".
  const existente = await acharLeadPorTelefone(telefone);
  if (!corpo.modelo) {
    if (!janelaAberta(existente?.ultimaMsgClienteEm, await agora())) {
      throw new ErroHttp(400, "Fora da janela de 24h: só é possível enviar um modelo aprovado.");
    }
  } else {
    if (!buscarModelo(corpo.modelo)) throw new ErroHttp(400, "Modelo de mensagem não encontrado.");
    if (existente?.naoReceberEm) throw new ErroHttp(400, "Este cliente pediu para parar de receber mensagens: não dá para enviar modelo.");
    if (!(existente && temConsentimento(existente)) && !corpo.consentimento) {
      throw new ErroHttp(400, "Informe como o cliente autorizou receber mensagens da loja.");
    }
  }
  const lead = await obterOuCriarLead(telefone);
  if (corpo.modelo && corpo.consentimento && !temConsentimento(lead)) await registrarConsentimento(lead.id, corpo.consentimento, usuario.nome);
  try {
    const mensagem = await responderComoConsultor(lead.id, usuario, corpo.texto, corpo.modelo);
    return { ok: true, leadId: lead.id, mensagemId: mensagem.id };
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Não foi possível enviar.");
  }
});
