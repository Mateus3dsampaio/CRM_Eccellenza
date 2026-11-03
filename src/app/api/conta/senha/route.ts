import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { LimiteDeTentativas } from "@/regras/tentativas-login";
import { trocarMinhaSenha } from "@/servicos/usuarios";

const corpo = z.object({ senhaAtual: z.string().min(1, "Informe a senha atual.").max(200), senhaNova: z.string().min(1, "Informe a senha nova.").max(200) });

// Quem erra a senha atual muitas vezes espera (o cookie roubado não serve para descobrir a senha).
const limite = new LimiteDeTentativas();

// Qualquer usuário logado troca a própria senha.
export const POST = rota(async (req: Request) => {
  const usuario = await exigirUsuario();
  const { senhaAtual, senhaNova } = corpo.parse(await req.json());
  const espera = limite.bloqueadoPorMin(usuario.id);
  if (espera) throw new ErroHttp(429, `Muitas tentativas erradas. Tente de novo em ${espera} min.`);
  try {
    await trocarMinhaSenha(usuario.id, senhaAtual, senhaNova);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("A senha atual")) limite.registrarErro(usuario.id);
    throw e;
  }
  limite.limpar(usuario.id);
  return { ok: true };
});
