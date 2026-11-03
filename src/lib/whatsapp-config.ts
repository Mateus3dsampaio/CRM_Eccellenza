import { modoSimulador } from "./modo";

// Configuração do WhatsApp (API oficial da Meta). Tudo vem de variáveis de ambiente, nunca do código.
// O Mateus cola estes valores no Railway (ou no .env, em teste) quando tiver a conta da Meta pronta.
export interface ConfigWhatsapp {
  token: string;
  numeroId: string;
  segredoApp: string;
  tokenVerificacao: string;
  versaoApi: string;
  idiomaModelos: string;
}

type Env = Record<string, string | undefined>;

export const VARIAVEIS_WHATSAPP = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "META_APP_SECRET", "WHATSAPP_VERIFY_TOKEN"] as const;

/** Nomes (nunca valores) das variáveis que ainda faltam. */
export function variaveisFaltando(env: Env = process.env): string[] {
  return VARIAVEIS_WHATSAPP.filter((nome) => !env[nome]?.trim());
}

/**
 * O WhatsApp real SÓ envia quando as 4 variáveis existem E o modo simulador está desligado.
 * Assim, no computador do Mateus (iniciar-crm.bat liga o simulador) nenhum cliente fictício recebe mensagem de verdade,
 * mesmo que as chaves da Meta estejam no .env por engano.
 */
export function whatsappRealAtivo(env: Env = process.env): boolean {
  return whatsappConfigurado(env) && !modoSimulador(env);
}

/** As quatro variáveis estão preenchidas? (Ainda não quer dizer que envia: veja whatsappRealAtivo.) O WhatsApp real está ligado quando as quatro variáveis estão preenchidas. Senão, vale o modo simulado. */
export function whatsappConfigurado(env: Env = process.env): boolean {
  return variaveisFaltando(env).length === 0;
}

export function lerConfigWhatsapp(env: Env = process.env): ConfigWhatsapp | null {
  if (!whatsappConfigurado(env)) return null;
  return {
    token: env.WHATSAPP_TOKEN!.trim(),
    numeroId: env.WHATSAPP_PHONE_NUMBER_ID!.trim(),
    segredoApp: env.META_APP_SECRET!.trim(),
    tokenVerificacao: env.WHATSAPP_VERIFY_TOKEN!.trim(),
    // Versão da API Graph da Meta. A Meta aposenta versões antigas: se der erro de versão, troque aqui sem mexer no código.
    versaoApi: env.WHATSAPP_API_VERSION?.trim() || "v23.0",
    idiomaModelos: env.WHATSAPP_IDIOMA_MODELOS?.trim() || "pt_BR",
  };
}
