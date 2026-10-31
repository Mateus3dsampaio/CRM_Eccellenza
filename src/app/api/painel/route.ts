import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { dadosDoPainel } from "@/servicos/consultas";

export const dynamic = "force-dynamic";

export const GET = rota(async (req: Request) => {
  await exigirUsuario("ver_metricas");
  const periodo = new URL(req.url).searchParams.get("periodo") === "mes" ? "mes" : "semana";
  return dadosDoPainel(periodo);
});
