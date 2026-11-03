import { NextResponse } from "next/server";
import { z } from "zod";
import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { conferirSenha, gerarHashSenha } from "@/lib/senha";
import { COOKIE_SESSAO, criarToken, ErroHttp } from "@/lib/sessao";
import { LimiteDeTentativas } from "@/regras/tentativas-login";

const esquema = z.object({ login: z.string().trim().min(1).max(50), senha: z.string().min(1).max(200) });

const limite = new LimiteDeTentativas();
// Segunda trava só por usuário: quem forja o cabeçalho de origem para fugir do limite acima ainda bate aqui.
const limitePorUsuario = new LimiteDeTentativas(20);
// Para o usuário inexistente gastar o mesmo tempo de um existente (não revela quem tem conta).
const HASH_FALSO = gerarHashSenha("senha-falsa-para-igualar-o-tempo");

// Cookie "seguro" só quando o acesso é por https (Railway). Em http://127.0.0.1 (seu computador) ele não seria enviado.
function viaHttps(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || new URL(req.url).protocol.replace(":", "");
  return proto === "https";
}

export const POST = rota(async (req: Request) => {
  const { login, senha } = esquema.parse(await req.json());
  // Atrás do proxy do Railway o endereço real vem em x-forwarded-for.
  // A ÚLTIMA entrada é a que o proxy do Railway acrescentou; as anteriores o próprio visitante pode inventar.
  const origem = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
  const chave = `${login.toLowerCase()}|${origem}`;
  const espera = Math.max(limite.bloqueadoPorMin(chave), limitePorUsuario.bloqueadoPorMin(login.toLowerCase()));
  if (espera) throw new ErroHttp(429, `Muitas tentativas erradas. Tente de novo em ${espera} min.`);
  const usuario = await db.usuario.findUnique({ where: { login: login.toLowerCase() } });
  const senhaCerta = conferirSenha(senha, usuario?.senhaHash ?? HASH_FALSO);
  if (!usuario || !usuario.ativo || !senhaCerta) {
    limite.registrarErro(chave);
    limitePorUsuario.registrarErro(login.toLowerCase());
    throw new ErroHttp(401, "Usuário ou senha incorretos.");
  }
  limite.limpar(chave);
  limitePorUsuario.limpar(login.toLowerCase());
  const resposta = NextResponse.json({ ok: true, nome: usuario.nome });
  resposta.cookies.set(COOKIE_SESSAO, await criarToken(usuario.id), { httpOnly: true, sameSite: "lax", secure: viaHttps(req), path: "/", maxAge: 12 * 60 * 60 });
  return resposta;
});

export const DELETE = rota(async () => {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.delete(COOKIE_SESSAO);
  return resposta;
});
