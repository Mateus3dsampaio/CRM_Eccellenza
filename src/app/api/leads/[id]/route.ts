import { z } from "zod";
import { naoEncontrado, rota } from "@/lib/api";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { CODIGOS_CLASSIFICACAO } from "@/regras/etapas";
import { fichaDoLead } from "@/servicos/consultas";
import { registrarAlteracao } from "@/servicos/historico";
import { atualizarCampos, atualizarResumo, restaurarLead } from "@/servicos/leads";
import { marcarMudanca } from "@/lib/versao";

type Contexto = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = rota(async (_req: Request, { params }: Contexto) => {
  await exigirUsuario();
  const ficha = await fichaDoLead((await params).id);
  return ficha ?? naoEncontrado();
});

const texto = z.string().max(500).nullable().optional();
const lista = z.array(z.string().trim().min(1).max(500)).max(30).optional();
const esquemaEdicao = z
  .object({
    nome: texto,
    cidade: texto,
    endereco: texto,
    ambientes: lista,
    exigencias: lista,
    situacaoImovel: texto,
    prazo: texto,
    investimento: texto,
    pedidosTecnicos: lista,
    observacoes: z.string().max(2000).nullable().optional(),
    consultorId: z.string().max(40).nullable().optional(),
    classificacao: z.enum(CODIGOS_CLASSIFICACAO as [string, ...string[]]).nullable().optional(),
    restaurar: z.boolean().optional(),
  })
  .strict();

// Consultor corrige os dados que o bot preencheu (FICHA-04).
export const PATCH = rota(async (req: Request, { params }: Contexto) => {
  const usuario = await exigirUsuario("editar_lead");
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) naoEncontrado();
  const { classificacao, restaurar, ...campos } = esquemaEdicao.parse(await req.json());
  if (restaurar) await restaurarLead(id, usuario.nome);
  if (campos.consultorId) {
    const existe = await db.usuario.findFirst({ where: { id: campos.consultorId, perfil: "consultor" } });
    if (!existe) campos.consultorId = undefined;
  }
  await atualizarCampos(id, campos, usuario.nome, "substituir");
  if (classificacao !== undefined && classificacao !== lead.classificacao) {
    await db.lead.update({ where: { id }, data: { classificacao } });
    await registrarAlteracao(id, usuario.nome, `Alterou a classificação para "${classificacao ?? "sem classificação"}"`);
    await atualizarResumo(id);
    await marcarMudanca();
  }
  return fichaDoLead(id);
});
