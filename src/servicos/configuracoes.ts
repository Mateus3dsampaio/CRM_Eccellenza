import { db } from "@/lib/db";
import { marcarMudanca } from "@/lib/versao";
import type { ModoDistribuicao } from "@/regras/distribuicao";

const CHAVE_MODO = "distribuicao_modo";
export const CHAVE_ULTIMO_RODIZIO = "distribuicao_ultimo";

export async function lerConfig(chave: string): Promise<string | null> {
  return (await db.configuracao.findUnique({ where: { chave } }))?.valor ?? null;
}

export async function gravarConfig(chave: string, valor: string): Promise<void> {
  await db.configuracao.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
}

// Padrão: quem tem menos leads (como era antes). O admin liga o rodízio em Configurações.
export async function modoDistribuicao(): Promise<ModoDistribuicao> {
  return (await lerConfig(CHAVE_MODO)) === "rodizio" ? "rodizio" : "menos_leads";
}

export async function definirModoDistribuicao(modo: ModoDistribuicao): Promise<void> {
  await gravarConfig(CHAVE_MODO, modo);
  await marcarMudanca();
}
