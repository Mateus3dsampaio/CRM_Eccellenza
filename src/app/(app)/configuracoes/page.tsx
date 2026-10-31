import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao";
import { pode } from "@/regras/permissoes";
import { Configuracoes } from "@/componentes/configuracoes/configuracoes";

// Só o admin entra aqui (a API confere de novo).
export default async function PaginaConfiguracoes() {
  const usuario = await usuarioAtual();
  if (!usuario || !pode(usuario.perfil, "configurar")) redirect("/");
  return <Configuracoes />;
}
