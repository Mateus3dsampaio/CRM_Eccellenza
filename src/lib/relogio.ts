import { db } from "./db";

// Relógio simulado (RET-04): todas as regras de tempo usam agora(), nunca Date.now() direto.
// O deslocamento fica no banco para valer em todas as rotas e scripts.
const CHAVE = "relogio_deslocamento_ms";

export async function deslocamentoMs(): Promise<number> {
  const config = await db.configuracao.findUnique({ where: { chave: CHAVE } });
  const valor = Number(config?.valor ?? 0);
  return Number.isFinite(valor) ? valor : 0;
}

export async function agora(): Promise<Date> {
  return new Date(Date.now() + (await deslocamentoMs()));
}

export async function avancarRelogio(ms: number): Promise<Date> {
  const atual = await deslocamentoMs();
  const novo = atual + ms;
  await db.configuracao.upsert({
    where: { chave: CHAVE },
    create: { chave: CHAVE, valor: String(novo) },
    update: { valor: String(novo) },
  });
  return new Date(Date.now() + novo);
}
