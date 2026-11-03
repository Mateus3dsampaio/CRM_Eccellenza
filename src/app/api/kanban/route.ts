import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { prazosDeEspera } from "@/servicos/configuracoes";
import { cardsDoKanban } from "@/servicos/consultas";
import { rodarRotinas } from "@/servicos/rotinas";

export const dynamic = "force-dynamic";

export const GET = rota(async () => {
  await exigirUsuario();
  await rodarRotinas();
  const consultores = await db.usuario.findMany({ where: { perfil: "consultor", ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
  return { cards: await cardsDoKanban(), consultores, prazosEspera: await prazosDeEspera() };
});
