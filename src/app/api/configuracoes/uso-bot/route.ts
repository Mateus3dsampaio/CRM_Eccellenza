import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { resumoDeUso } from "@/servicos/uso-api";

export const dynamic = "force-dynamic";

// Uso da API do Claude pelo bot nos últimos 30 dias (só admin).
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  return resumoDeUso(30);
});
