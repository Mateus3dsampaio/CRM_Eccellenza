import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Configurações da loja (só admin). As opções de distribuição, almoço e layout entram nas próximas etapas.
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  const equipe = await db.usuario.findMany({
    orderBy: [{ perfil: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, login: true, perfil: true, ativo: true },
  });
  return { equipe };
});
