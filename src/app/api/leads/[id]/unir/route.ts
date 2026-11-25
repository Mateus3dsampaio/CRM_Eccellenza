import { z } from "zod";
import { naoEncontrado, rota } from "@/lib/api";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { formatarTelefone, nomeExibicao } from "@/regras/telefone";
import { unirLeadInstagramComWhatsapp } from "@/servicos/leads";

type Contexto = { params: Promise<{ id: string }> };

// União do contato do Instagram (sem telefone) com o lead do WhatsApp do mesmo cliente (tarefa 47).

/** Candidatos: leads do WhatsApp que ainda não têm Instagram ligado, filtrados pelo que o vendedor digitou (nome ou telefone). */
export const GET = rota(async (req: Request, { params }: Contexto) => {
  await exigirUsuario("editar_lead");
  const { id } = await params;
  const origem = await db.lead.findUnique({ where: { id }, select: { id: true, igsid: true, telefone: true } });
  if (!origem) naoEncontrado();
  const busca = (new URL(req.url).searchParams.get("busca") ?? "").trim().toLowerCase();
  const digitos = busca.replace(/\D/g, "");
  const leads = await db.lead.findMany({
    where: { id: { not: id }, telefone: { not: null }, igsid: null, bloqueadoEm: null },
    select: { id: true, nome: true, nomePerfil: true, telefone: true, igUsuario: true, etapa: true, arquivadoEm: true, criadoEm: true },
    orderBy: { criadoEm: "desc" },
    take: 500,
  });
  const achados = leads
    .filter((l) => !busca || nomeExibicao(l).toLowerCase().includes(busca) || (!!digitos && (l.telefone ?? "").replace(/\D/g, "").includes(digitos)))
    .slice(0, 8)
    .map((l) => ({ id: l.id, nome: nomeExibicao(l), telefone: formatarTelefone(l.telefone), etapa: l.etapa, arquivado: !!l.arquivadoEm }));
  return { candidatos: achados };
});

export const POST = rota(async (req: Request, { params }: Contexto) => {
  const usuario = await exigirUsuario("editar_lead");
  const { id } = await params;
  const { leadWhatsappId } = z.object({ leadWhatsappId: z.string().min(1, "Escolha o lead do WhatsApp.") }).parse(await req.json());
  const leadId = await unirLeadInstagramComWhatsapp(id, leadWhatsappId, usuario.nome);
  return { ok: true, leadId };
});
