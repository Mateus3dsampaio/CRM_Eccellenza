import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { listaArquivados } from "@/servicos/consultas";
import { rodarRotinas } from "@/servicos/rotinas";

export const dynamic = "force-dynamic";

export const GET = rota(async () => {
  await exigirUsuario();
  await rodarRotinas();
  return { leads: await listaArquivados() };
});
