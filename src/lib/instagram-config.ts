import { modoSimulador } from "./modo";

// Configuração do Instagram (API de mensagens da Meta, tarefa 47). Tudo vem de variáveis de ambiente, nunca do código.
// O segredo do app é o mesmo do WhatsApp (META_APP_SECRET): é o mesmo app da Meta.
export interface ConfigInstagram {
  token: string;
  /** Id da conta profissional do Instagram da loja (é para ela que o envio vai). */
  contaId: string;
  segredoApp: string;
  tokenVerificacao: string;
  versaoApi: string;
}

type Env = Record<string, string | undefined>;

export const VARIAVEIS_INSTAGRAM = ["INSTAGRAM_TOKEN", "INSTAGRAM_ACCOUNT_ID", "META_APP_SECRET", "INSTAGRAM_VERIFY_TOKEN"] as const;

/** Nomes (nunca valores) das variáveis que ainda faltam. */
export function variaveisInstagramFaltando(env: Env = process.env): string[] {
  return VARIAVEIS_INSTAGRAM.filter((nome) => !env[nome]?.trim());
}

export function instagramConfigurado(env: Env = process.env): boolean {
  return variaveisInstagramFaltando(env).length === 0;
}

/** O Instagram real SÓ envia com as 4 variáveis E o simulador desligado (mesma trava do WhatsApp). */
export function instagramRealAtivo(env: Env = process.env): boolean {
  return instagramConfigurado(env) && !modoSimulador(env);
}

export function lerConfigInstagram(env: Env = process.env): ConfigInstagram | null {
  if (!instagramConfigurado(env)) return null;
  return {
    token: env.INSTAGRAM_TOKEN!.trim(),
    contaId: env.INSTAGRAM_ACCOUNT_ID!.trim(),
    segredoApp: env.META_APP_SECRET!.trim(),
    tokenVerificacao: env.INSTAGRAM_VERIFY_TOKEN!.trim(),
    versaoApi: env.INSTAGRAM_API_VERSION?.trim() || env.WHATSAPP_API_VERSION?.trim() || "v23.0",
  };
}
