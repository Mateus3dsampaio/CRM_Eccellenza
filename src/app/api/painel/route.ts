import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { dadosDoPainel } from "@/servicos/painel";

export const dynamic = "force-dynamic";

// Painel: ?atalho=semana|mes|hoje|7d|30d ou ?de=AAAA-MM-DD&ate=AAAA-MM-DD, e ?vendedor=<id> (só vale para o admin).
export const GET = rota(async (req: Request) => {
  const usuario = await exigirUsuario("ver_metricas");
  const q = new URL(req.url).searchParams;
  return dadosDoPainel({
    atalho: q.get("atalho"),
    de: q.get("de"),
    ate: q.get("ate"),
    vendedorId: usuario.perfil === "admin" ? q.get("vendedor") : null,
  });
});
