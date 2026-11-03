import { z } from "zod";
import { VALOR_MAXIMO_CENTAVOS, type DadosDeVenda } from "@/regras/vendas";

// Dados de venda como chegam da tela (data em ISO, dinheiro em centavos) e como o serviço os entende.
export const esquemaDadosDeVenda = z
  .object({
    proximoContatoEm: z.iso.datetime({ offset: true }).nullable().optional(),
    valorOrcamento: z.number().int().min(1).max(VALOR_MAXIMO_CENTAVOS).nullable().optional(),
    valorFechado: z.number().int().min(1).max(VALOR_MAXIMO_CENTAVOS).nullable().optional(),
    motivoPerda: z.string().min(1).max(60).nullable().optional(),
    concorrente: z.string().trim().max(120).nullable().optional(),
  })
  .strict();

export function dadosDeVenda(entrada: z.infer<typeof esquemaDadosDeVenda> | undefined): DadosDeVenda {
  if (!entrada) return {};
  const { proximoContatoEm, ...resto } = entrada;
  return { ...resto, ...(proximoContatoEm === undefined ? {} : { proximoContatoEm: proximoContatoEm ? new Date(proximoContatoEm) : null }) };
}
