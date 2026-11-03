import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { prazosDeEspera } from "@/servicos/configuracoes";
import { leadsAguardando } from "@/servicos/consultas";

export const dynamic = "force-dynamic";

// Leads esperando um humano (só os do usuário; o admin vê todos) e os prazos de cor. Alimenta o topo da tela e os cards.
export const GET = rota(async () => {
  const usuario = await exigirUsuario();
  return { leads: await leadsAguardando(usuario), prazos: await prazosDeEspera() };
});
