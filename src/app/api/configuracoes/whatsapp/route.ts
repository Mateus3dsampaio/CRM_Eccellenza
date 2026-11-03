import { rota } from "@/lib/api";
import { modoSimulador } from "@/lib/modo";
import { exigirUsuario } from "@/lib/sessao";
import { variaveisFaltando, whatsappConfigurado } from "@/lib/whatsapp-config";
import { ultimosLogs } from "@/servicos/whatsapp";

export const dynamic = "force-dynamic";

// Situação do WhatsApp para o admin: modo, o que falta preencher (só os NOMES das variáveis) e o log do webhook.
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  const logs = await ultimosLogs(30);
  return {
    configurado: whatsappConfigurado(),
    simulador: modoSimulador(),
    faltando: variaveisFaltando(),
    logs: logs.map((l) => ({ id: l.id, quando: l.criadoEm.toISOString(), tipo: l.tipo, resumo: l.resumo, ok: l.ok })),
  };
});
