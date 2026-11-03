import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { HORA } from "@/regras/tempo";

export interface UsoDaChamada {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Guarda só os números de uma chamada à API (sem texto de cliente). Falha aqui não pode derrubar o atendimento. */
export async function registrarUso(uso: UsoDaChamada): Promise<void> {
  try {
    await db.usoApi.create({
      data: {
        criadoEm: await agora(),
        entrada: uso.input_tokens ?? 0,
        saida: uso.output_tokens ?? 0,
        cacheLeitura: uso.cache_read_input_tokens ?? 0,
        cacheEscrita: uso.cache_creation_input_tokens ?? 0,
      },
    });
  } catch {
    console.error("[uso-api] não consegui registrar o uso");
  }
}

export interface ResumoDeUso {
  dias: number;
  chamadas: number;
  entrada: number;
  saida: number;
  cacheLeitura: number;
  cacheEscrita: number;
}

/** Totais dos últimos N dias (para o admin acompanhar o custo). Dinheiro fica de fora de propósito: preço muda. */
export async function resumoDeUso(dias = 30): Promise<ResumoDeUso> {
  const desde = new Date((await agora()).getTime() - dias * 24 * HORA);
  const soma = await db.usoApi.aggregate({
    where: { criadoEm: { gte: desde } },
    _count: { _all: true },
    _sum: { entrada: true, saida: true, cacheLeitura: true, cacheEscrita: true },
  });
  return {
    dias,
    chamadas: soma._count._all,
    entrada: soma._sum.entrada ?? 0,
    saida: soma._sum.saida ?? 0,
    cacheLeitura: soma._sum.cacheLeitura ?? 0,
    cacheEscrita: soma._sum.cacheEscrita ?? 0,
  };
}
