import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { TIPOS_CHAVE } from "@/regras/chaves-api";
import { ErroChave, copiarChave, removerChave, salvarChave, situacaoDasChaves } from "@/servicos/chaves-api";

export const dynamic = "force-dynamic";

// Chaves de API (só admin). A chave inteira nunca sai daqui: a resposta traz só "configurada" e os 4 últimos caracteres.
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  return situacaoDasChaves();
});

export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const { tipo, chave } = z.object({ tipo: z.enum(TIPOS_CHAVE), chave: z.string().max(1000) }).parse(await req.json());
  try {
    await salvarChave(tipo, chave);
  } catch (erro) {
    if (erro instanceof ErroChave) throw new ErroHttp(400, erro.message);
    throw erro;
  }
  return situacaoDasChaves();
});

// "Usar a mesma chave do texto" no campo de áudio: o servidor copia, a chave não passa pela tela.
export const POST = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const { de, para } = z.object({ de: z.enum(TIPOS_CHAVE), para: z.enum(TIPOS_CHAVE) }).parse(await req.json());
  try {
    await copiarChave(de, para);
  } catch (erro) {
    if (erro instanceof ErroChave) throw new ErroHttp(400, erro.message);
    throw erro;
  }
  return situacaoDasChaves();
});

export const DELETE = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const { tipo } = z.object({ tipo: z.enum(TIPOS_CHAVE) }).parse(await req.json());
  await removerChave(tipo);
  return situacaoDasChaves();
});
