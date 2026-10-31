import { NextResponse } from "next/server";
import { z } from "zod";
import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { conferirSenha } from "@/lib/senha";
import { COOKIE_SESSAO, criarToken, ErroHttp } from "@/lib/sessao";

const esquema = z.object({ login: z.string().trim().min(1).max(50), senha: z.string().min(1).max(200) });

export const POST = rota(async (req: Request) => {
  const { login, senha } = esquema.parse(await req.json());
  const usuario = await db.usuario.findUnique({ where: { login: login.toLowerCase() } });
  if (!usuario || !usuario.ativo || !conferirSenha(senha, usuario.senhaHash)) throw new ErroHttp(401, "Usuário ou senha incorretos.");
  const resposta = NextResponse.json({ ok: true, nome: usuario.nome });
  resposta.cookies.set(COOKIE_SESSAO, await criarToken(usuario.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 12 * 60 * 60 });
  return resposta;
});

export const DELETE = rota(async () => {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.delete(COOKIE_SESSAO);
  return resposta;
});
