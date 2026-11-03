import { db } from "@/lib/db";
import { gerarHashSenha } from "@/lib/senha";

export const SENHA_MINIMA = 10;

/** Cria um usuário (admin ou consultor). Recusa login repetido e senha curta. */
export async function criarUsuario(params: { nome: string; login: string; senha: string; perfil: "admin" | "consultor" }) {
  const login = params.login.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,30}$/.test(login)) throw new Error("Login inválido: use 2 a 30 letras minúsculas, números, ponto, traço ou sublinhado.");
  if (params.senha.length < SENHA_MINIMA) throw new Error(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
  if (!params.nome.trim()) throw new Error("Informe o nome.");
  if (await db.usuario.findUnique({ where: { login } })) throw new Error("Já existe um usuário com esse login.");
  return db.usuario.create({ data: { nome: params.nome.trim(), login, senhaHash: gerarHashSenha(params.senha), perfil: params.perfil } });
}

/**
 * Primeiro uso em produção: se o banco não tem nenhum usuário e as variáveis ADMIN_LOGIN, ADMIN_SENHA (e ADMIN_NOME) existem,
 * cria o administrador. Depois disso as variáveis são ignoradas (trocar a senha lá não muda a senha do banco).
 */
export async function garantirPrimeiroAdmin(env: Record<string, string | undefined> = process.env): Promise<boolean> {
  if (!env.ADMIN_LOGIN || !env.ADMIN_SENHA) return false;
  if ((await db.usuario.count()) > 0) return false;
  await criarUsuario({ nome: env.ADMIN_NOME || "Administrador", login: env.ADMIN_LOGIN, senha: env.ADMIN_SENHA, perfil: "admin" });
  console.log("[usuarios] administrador inicial criado.");
  return true;
}
