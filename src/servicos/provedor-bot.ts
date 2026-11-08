import { MODELO_CLAUDE_PADRAO, MODELO_OPENAI_PADRAO, problemaNoModelo } from "@/regras/modelos-ia";
import { lerConfig, gravarConfig } from "./configuracoes";

// Qual IA atende o texto (Claude, padrão, ou GPT) e o modelo de cada uma. Escolha do admin em Configurações > Chaves de API.
export const PROVEDORES_BOT = ["claude", "openai"] as const;
export type ProvedorBot = (typeof PROVEDORES_BOT)[number];
export { MODELO_CLAUDE_PADRAO, MODELO_OPENAI_PADRAO, problemaNoModelo };

const CHAVE_PROVEDOR = "bot_provedor";
const CHAVE_MODELO_CLAUDE = "bot_modelo_claude";
const CHAVE_MODELO_OPENAI = "bot_modelo_openai";

export interface ConfigDoBot {
  provedor: ProvedorBot;
  modeloClaude: string;
  modeloOpenai: string;
}

export async function configDoBot(): Promise<ConfigDoBot> {
  const provedor = (await lerConfig(CHAVE_PROVEDOR)) === "openai" ? "openai" : "claude";
  const modeloClaude = (await lerConfig(CHAVE_MODELO_CLAUDE))?.trim() || MODELO_CLAUDE_PADRAO;
  const modeloOpenai = (await lerConfig(CHAVE_MODELO_OPENAI))?.trim() || MODELO_OPENAI_PADRAO;
  return { provedor, modeloClaude, modeloOpenai };
}

/** Grava só o que veio. Modelo com nome inválido é recusado antes de gravar qualquer coisa. */
export async function definirConfigDoBot(mudanca: Partial<ConfigDoBot>): Promise<void> {
  for (const modelo of [mudanca.modeloClaude, mudanca.modeloOpenai]) {
    const problema = modelo === undefined ? null : problemaNoModelo(modelo);
    if (problema) throw new Error(problema);
  }
  if (mudanca.provedor) await gravarConfig(CHAVE_PROVEDOR, mudanca.provedor);
  if (mudanca.modeloClaude !== undefined) await gravarConfig(CHAVE_MODELO_CLAUDE, mudanca.modeloClaude.trim());
  if (mudanca.modeloOpenai !== undefined) await gravarConfig(CHAVE_MODELO_OPENAI, mudanca.modeloOpenai.trim());
}
