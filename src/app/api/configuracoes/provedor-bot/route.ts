import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { configDoBot, definirConfigDoBot, PROVEDORES_BOT } from "@/servicos/provedor-bot";

export const dynamic = "force-dynamic";

// Qual IA atende o texto (Claude ou GPT) e o modelo do GPT. Só admin.
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  return configDoBot();
});

export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const { provedor, modeloOpenai } = z.object({ provedor: z.enum(PROVEDORES_BOT), modeloOpenai: z.string().max(100) }).parse(await req.json());
  try {
    await definirConfigDoBot(provedor, modeloOpenai);
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Configuração inválida.");
  }
  return configDoBot();
});
