import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { modoDistribuicao } from "@/servicos/configuracoes";
import { leadsNaFila } from "@/servicos/distribuicao";

export const dynamic = "force-dynamic";

// Configurações da loja (só admin).
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  const equipe = await db.usuario.findMany({
    orderBy: [{ perfil: "asc" }, { criadoEm: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, login: true, perfil: true, ativo: true, status: true },
  });
  return { equipe, distribuicao: await modoDistribuicao(), naFila: (await leadsNaFila()).length };
});
