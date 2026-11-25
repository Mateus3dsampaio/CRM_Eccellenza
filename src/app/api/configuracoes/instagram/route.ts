import { rota } from "@/lib/api";
import { instagramConfigurado, variaveisInstagramFaltando } from "@/lib/instagram-config";
import { modoSimulador } from "@/lib/modo";
import { exigirUsuario } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Situação do Instagram para o admin: modo e o que falta preencher (só os NOMES das variáveis). Os avisos da Meta ficam no log do WhatsApp.
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  return { configurado: instagramConfigurado(), simulador: modoSimulador(), faltando: variaveisInstagramFaltando() };
});
