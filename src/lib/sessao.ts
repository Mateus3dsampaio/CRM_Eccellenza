import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { pode, type Acao } from "@/regras/permissoes";

export const COOKIE_SESSAO = "crm_sessao";
const DURACAO_MS = 12 * 60 * 60 * 1000;
const CHAVE_SEGREDO = "segredo_sessao";

// Segredo de assinatura gerado na primeira execução e guardado no banco local.
let segredoEmMemoria: string | null = null;
async function segredo(): Promise<string> {
  if (segredoEmMemoria) return segredoEmMemoria;
  const existente = await db.configuracao.findUnique({ where: { chave: CHAVE_SEGREDO } });
  if (existente) return (segredoEmMemoria = existente.valor);
  const novo = randomBytes(32).toString("hex");
  await db.configuracao.upsert({ where: { chave: CHAVE_SEGREDO }, create: { chave: CHAVE_SEGREDO, valor: novo }, update: {} });
  const salvo = await db.configuracao.findUniqueOrThrow({ where: { chave: CHAVE_SEGREDO } });
  return (segredoEmMemoria = salvo.valor);
}

function assinar(conteudo: string, chave: string): string {
  return createHmac("sha256", chave).update(conteudo).digest("base64url");
}

export async function criarToken(usuarioId: string): Promise<string> {
  // Sessão usa o horário real (não o relógio simulado), para não expirar ao avançar dias no simulador.
  const conteudo = `${usuarioId}.${Date.now() + DURACAO_MS}`;
  return `${conteudo}.${assinar(conteudo, await segredo())}`;
}

export async function lerToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [usuarioId, expira, assinatura] = partes;
  const esperado = Buffer.from(assinar(`${usuarioId}.${expira}`, await segredo()));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  if (Number(expira) < Date.now()) return null;
  return usuarioId;
}

export interface UsuarioLogado {
  id: string;
  nome: string;
  perfil: "admin" | "consultor";
}

export async function usuarioAtual(): Promise<UsuarioLogado | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  const id = await lerToken(token);
  if (!id) return null;
  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario || !usuario.ativo) return null;
  return { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil === "admin" ? "admin" : "consultor" };
}

export class ErroHttp extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

/** Exige login (e, se informada, a permissão). Lança ErroHttp 401/403. */
export async function exigirUsuario(acao?: Acao): Promise<UsuarioLogado> {
  const usuario = await usuarioAtual();
  if (!usuario) throw new ErroHttp(401, "Faça login para continuar.");
  if (acao && !pode(usuario.perfil, acao)) throw new ErroHttp(403, "Você não tem permissão para esta ação.");
  return usuario;
}
