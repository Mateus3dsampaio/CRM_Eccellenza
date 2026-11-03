import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { alertasDesde } from "@/servicos/alertas";

export const dynamic = "force-dynamic";

// Avisos novos para o usuário (som e notificação do navegador). `?depois=N` traz só o que veio depois do aviso N.
export const GET = rota(async (req: Request) => {
  const usuario = await exigirUsuario();
  const bruto = new URL(req.url).searchParams.get("depois");
  const depois = bruto !== null && /^\d+$/.test(bruto) ? Number(bruto) : undefined;
  return alertasDesde(usuario, depois);
});
