import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao";
import { pode } from "@/regras/permissoes";
import { Painel } from "@/componentes/painel/painel";

// Só o administrador vê o Painel (a API confere de novo).
export default async function PaginaPainel() {
  const usuario = await usuarioAtual();
  if (!usuario || !pode(usuario.perfil, "ver_metricas")) redirect("/");
  return <Painel />;
}
