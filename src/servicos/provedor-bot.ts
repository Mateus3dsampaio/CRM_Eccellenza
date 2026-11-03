import { lerConfig, gravarConfig } from "./configuracoes";

// Qual IA atende o texto: Claude (padrão) ou GPT (OpenAI). Escolha do admin em Configurações > Chaves de API.
export const PROVEDORES_BOT = ["claude", "openai"] as const;
export type ProvedorBot = (typeof PROVEDORES_BOT)[number];
/** PROVISÓRIO: o Mateus testa e troca pela tela. Não foi validado com o bot real. */
export const MODELO_OPENAI_PADRAO = "gpt-5.5";

const CHAVE_PROVEDOR = "bot_provedor";
const CHAVE_MODELO_OPENAI = "bot_modelo_openai";

export interface ConfigDoBot {
  provedor: ProvedorBot;
  modeloOpenai: string;
}

export async function configDoBot(): Promise<ConfigDoBot> {
  const provedor = (await lerConfig(CHAVE_PROVEDOR)) === "openai" ? "openai" : "claude";
  const modeloOpenai = (await lerConfig(CHAVE_MODELO_OPENAI))?.trim() || MODELO_OPENAI_PADRAO;
  return { provedor, modeloOpenai };
}

export function problemaNoModelo(modelo: string): string | null {
  return /^[A-Za-z0-9._:-]{2,80}$/.test(modelo.trim()) ? null : "Nome de modelo inválido (use só letras, números, ponto e hífen).";
}

export async function definirConfigDoBot(provedor: ProvedorBot, modeloOpenai: string): Promise<void> {
  const problema = problemaNoModelo(modeloOpenai);
  if (problema) throw new Error(problema);
  await gravarConfig(CHAVE_PROVEDOR, provedor);
  await gravarConfig(CHAVE_MODELO_OPENAI, modeloOpenai.trim());
}
