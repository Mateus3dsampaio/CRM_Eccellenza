import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { configDoBot, definirConfigDoBot, PROVEDORES_BOT } from "@/servicos/provedor-bot";

export const dynamic = "force-dynamic";

// Qual IA atende o texto (Claude ou GPT) e o modelo de cada uma. Só admin. Grava só os campos enviados.
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  return configDoBot();
});

export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const mudanca = z
    .object({ provedor: z.enum(PROVEDORES_BOT).optional(), modeloClaude: z.string().max(100).optional(), modeloOpenai: z.string().max(100).optional() })
    .parse(await req.json());
  try {
    await definirConfigDoBot(mudanca);
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Configuração inválida.");
  }
  return configDoBot();
});
