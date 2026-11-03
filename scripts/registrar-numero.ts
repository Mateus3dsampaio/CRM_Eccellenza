// Registra o número da loja na API oficial do WhatsApp (passo obrigatório antes de enviar; só dá para fazer pela API).
// Uso (as variáveis WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID precisam estar no ambiente ou no .env):
//   npx tsx scripts/registrar-numero.ts <PIN de 6 dígitos>
// O PIN é o código de verificação em duas etapas do número: se o número já tem um, use o mesmo; se não tem, o que você
// digitar aqui passa a ser o PIN. GUARDE-O: vai precisar se um dia mudar o número de lugar.
// O número precisa estar verificado no WhatsApp Manager (código por SMS ou ligação) antes deste passo.
import { lerConfigWhatsapp } from "../src/lib/whatsapp-config";

async function main() {
  const pin = process.argv[2];
  if (!pin || !/^\d{6}$/.test(pin)) {
    console.error("Uso: npx tsx scripts/registrar-numero.ts <PIN de 6 dígitos>");
    process.exit(1);
  }
  const cfg = lerConfigWhatsapp();
  if (!cfg) {
    console.error("Faltam variáveis do WhatsApp (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, META_APP_SECRET, WHATSAPP_VERIFY_TOKEN).");
    process.exit(1);
  }
  const resposta = await fetch(`https://graph.facebook.com/${cfg.versaoApi}/${cfg.numeroId}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await resposta.json().catch(() => ({}))) as { success?: boolean; error?: { code?: number; message?: string } };
  if (resposta.ok && json.success) {
    console.log("Número registrado com sucesso.");
    return;
  }
  // Nunca imprime o token. Mostra o código e a mensagem da Meta para você poder pesquisar.
  console.error(`A Meta recusou (HTTP ${resposta.status}, código ${json.error?.code ?? "?"}): ${json.error?.message ?? "sem detalhes"}`);
  process.exit(1);
}

main().catch(() => {
  console.error("Não consegui falar com a Meta.");
  process.exit(1);
});
