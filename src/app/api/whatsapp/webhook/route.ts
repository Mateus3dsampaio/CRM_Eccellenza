import { after } from "next/server";
import { lerConfigWhatsapp } from "@/lib/whatsapp-config";
import { assinaturaValida, responderVerificacao } from "@/regras/whatsapp";
import { processarWebhook, registrarLogWebhook } from "@/servicos/whatsapp";

export const dynamic = "force-dynamic";

const LIMITE_CORPO = 1_000_000;

// Webhook da API oficial do WhatsApp (Meta). Fica pública de propósito: quem garante que a chamada é da Meta é a assinatura.
// Endereço para cadastrar na Meta: https://SEU-DOMINIO/api/whatsapp/webhook

/** Verificação inicial: a Meta pergunta se o endereço é nosso, mandando o token que você escolheu. */
export async function GET(req: Request) {
  const cfg = lerConfigWhatsapp();
  if (!cfg) return new Response("WhatsApp não configurado.", { status: 503 });
  const desafio = responderVerificacao(new URL(req.url).searchParams, cfg.tokenVerificacao);
  if (desafio === null) {
    // Rota pública: não grava no banco a cada tentativa de estranho (qualquer um poderia encher o banco).
    console.warn("[whatsapp] verificação recusada");
    return new Response("Não autorizado.", { status: 403 });
  }
  await registrarLogWebhook("verificacao", "Webhook verificado pela Meta");
  return new Response(desafio, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/** Mensagens e status. Responde 200 logo (a Meta reenvia se demorar) e processa em seguida. */
export async function POST(req: Request) {
  const cfg = lerConfigWhatsapp();
  if (!cfg) return new Response("WhatsApp não configurado.", { status: 503 });
  // A assinatura é calculada sobre o texto exato recebido: lê como texto antes de qualquer conversão.
  if (Number(req.headers.get("content-length") ?? 0) > LIMITE_CORPO) return new Response("Corpo grande demais.", { status: 413 });
  const corpo = await req.text();
  if (corpo.length > LIMITE_CORPO || !assinaturaValida(corpo, req.headers.get("x-hub-signature-256"), cfg.segredoApp)) {
    console.warn("[whatsapp] chamada recusada: assinatura inválida"); // sem gravar no banco: rota pública
    return new Response("Assinatura inválida.", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(corpo);
  } catch {
    console.warn("[whatsapp] chamada com JSON inválido");
    return new Response("JSON inválido.", { status: 400 });
  }
  after(() => processarWebhook(payload));
  return new Response("ok", { status: 200 });
}
