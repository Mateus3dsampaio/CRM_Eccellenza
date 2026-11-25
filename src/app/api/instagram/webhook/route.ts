import { after } from "next/server";
import { lerConfigInstagram } from "@/lib/instagram-config";
import { assinaturaValida, responderVerificacao } from "@/regras/whatsapp";
import { guardarEvento, processarEventoGuardado, registrarLogWebhook } from "@/servicos/whatsapp";

export const dynamic = "force-dynamic";

const LIMITE_CORPO = 1_000_000;

// Webhook das mensagens do Instagram (Meta, tarefa 47). Pública de propósito: quem garante que a chamada é da Meta é a assinatura.
// Endereço para cadastrar na Meta: https://SEU-DOMINIO/api/instagram/webhook

/** Verificação inicial: a Meta pergunta se o endereço é nosso, mandando o token que você escolheu. */
export async function GET(req: Request) {
  const cfg = lerConfigInstagram();
  if (!cfg) return new Response("Instagram não configurado.", { status: 503 });
  const desafio = responderVerificacao(new URL(req.url).searchParams, cfg.tokenVerificacao);
  if (desafio === null) {
    console.warn("[instagram] verificação recusada"); // rota pública: não grava no banco a cada tentativa de estranho
    return new Response("Não autorizado.", { status: 403 });
  }
  await registrarLogWebhook("verificacao", "Webhook do Instagram verificado pela Meta");
  return new Response(desafio, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/** Mensagens. Grava o evento, responde 200 logo (a Meta reenvia se demorar) e processa em seguida. */
export async function POST(req: Request) {
  const cfg = lerConfigInstagram();
  if (!cfg) return new Response("Instagram não configurado.", { status: 503 });
  if (Number(req.headers.get("content-length") ?? 0) > LIMITE_CORPO) return new Response("Corpo grande demais.", { status: 413 });
  const corpo = await req.text();
  if (corpo.length > LIMITE_CORPO || !assinaturaValida(corpo, req.headers.get("x-hub-signature-256"), cfg.segredoApp)) {
    console.warn("[instagram] chamada recusada: assinatura inválida");
    return new Response("Assinatura inválida.", { status: 401 });
  }
  try {
    JSON.parse(corpo);
  } catch {
    console.warn("[instagram] chamada com JSON inválido");
    return new Response("JSON inválido.", { status: 400 });
  }
  let id: number;
  try {
    id = await guardarEvento(corpo);
  } catch {
    console.error("[instagram] não consegui gravar o evento");
    return new Response("Erro ao gravar.", { status: 500 });
  }
  after(() => processarEventoGuardado(id));
  return new Response("ok", { status: 200 });
}
