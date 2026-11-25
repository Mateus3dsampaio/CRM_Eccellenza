import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { exigirUsuario } from "@/lib/sessao";
import { cardsDoKanban } from "@/servicos/consultas";
import { previsoesDoKanban } from "@/servicos/previsao-automacao";
import { rodarRotinas } from "@/servicos/rotinas";

export const dynamic = "force-dynamic";

export const GET = rota(async () => {
  const usuario = await exigirUsuario();
  await rodarRotinas();
  const consultores = await db.usuario.findMany({ where: { perfil: "consultor", ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
  const base = { cards: await cardsDoKanban(), consultores };
  // Acompanhamento da automação (tarefa 48): só o admin. Para consultor o campo nem existe na resposta.
  return usuario.perfil === "admin" ? { ...base, automacao: await previsoesDoKanban(await agora()) } : base;
});
