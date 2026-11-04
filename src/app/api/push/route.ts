import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { assinarPush, cancelarPush, chavesVapid, pushAtivo } from "@/servicos/push";

export const dynamic = "force-dynamic";

// Avisos com o CRM fechado (Web Push). Cada pessoa liga ou desliga o seu navegador; qualquer usuário logado.

/** Chave pública do servidor (a que o navegador precisa para assinar) e se este navegador (`?endpoint=`) já está ligado. */
export const GET = rota(async (req: Request) => {
  const usuario = await exigirUsuario();
  const chaves = await chavesVapid();
  if (!chaves) throw new ErroHttp(503, "Os avisos com o CRM fechado não estão disponíveis: falta a CHAVE_MESTRA no servidor.");
  const endpoint = new URL(req.url).searchParams.get("endpoint");
  return { chavePublica: chaves.publica, ativo: endpoint ? await pushAtivo(usuario.id, endpoint) : false };
});

const Endereco = z.string().url().max(2000).refine((u) => u.startsWith("https://"), "O endereço do navegador precisa ser https.");
const Assinatura = z.object({ endpoint: Endereco, keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }) });

export const POST = rota(async (req: Request) => {
  const usuario = await exigirUsuario();
  await assinarPush(usuario.id, Assinatura.parse(await req.json()));
  return { ok: true };
});

export const DELETE = rota(async (req: Request) => {
  const usuario = await exigirUsuario();
  const { endpoint } = z.object({ endpoint: Endereco }).parse(await req.json());
  await cancelarPush(usuario.id, endpoint);
  return { ok: true };
});
