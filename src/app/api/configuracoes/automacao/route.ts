import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { definirRegrasDaRedeDeSeguranca, definirRegrasDeArquivarPerdido } from "@/servicos/configuracoes";

// Só o admin define as regras da automação de leads (Configurações > Automação de leads): rede de segurança e arquivar perdidos. Grava só os blocos enviados.
export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const corpo = z
    .object({
      rede: z.object({ ligado: z.boolean(), dias: z.number() }).strict().optional(),
      arquivar: z.object({ ligado: z.boolean(), diasAutomatico: z.number(), vendedorLigado: z.boolean(), diasVendedor: z.number() }).strict().optional(),
    })
    .strict()
    .parse(await req.json());
  try {
    if (corpo.rede) await definirRegrasDaRedeDeSeguranca(corpo.rede);
    if (corpo.arquivar) await definirRegrasDeArquivarPerdido(corpo.arquivar);
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Regras inválidas.");
  }
  return { ok: true };
});
