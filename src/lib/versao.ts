import { db } from "./db";

// Contador de mudanças: as telas consultam e recarregam quando ele muda (KAN-05, sem recarregar a página).
const CHAVE = "versao_dados";

export async function marcarMudanca(): Promise<void> {
  const atual = await db.configuracao.findUnique({ where: { chave: CHAVE } });
  const novo = String(Number(atual?.valor ?? 0) + 1);
  await db.configuracao.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor: novo }, update: { valor: novo } });
}

export async function versaoAtual(): Promise<number> {
  const atual = await db.configuracao.findUnique({ where: { chave: CHAVE } });
  return Number(atual?.valor ?? 0);
}
