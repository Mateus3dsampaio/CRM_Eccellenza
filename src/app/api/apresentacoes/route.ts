import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { placarDoMes } from "@/servicos/apresentacoes";

export const dynamic = "force-dynamic";

// Placar de apresentações do mês (consultor: só o dele; admin: todos os vendedores e as metas).
export const GET = rota(async () => {
  const usuario = await exigirUsuario();
  return placarDoMes(usuario);
});
