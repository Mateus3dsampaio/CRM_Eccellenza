import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { retornosDeHoje } from "@/servicos/consultas";

export const dynamic = "force-dynamic";

// "Retornos de hoje": o consultor vê os seus leads; o admin vê todos.
export const GET = rota(async () => {
  const usuario = await exigirUsuario();
  return { leads: await retornosDeHoje(usuario) };
});
