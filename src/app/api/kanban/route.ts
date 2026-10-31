import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { cardsDoKanban } from "@/servicos/consultas";
import { rodarRotinas } from "@/servicos/rotinas";

export const dynamic = "force-dynamic";

export const GET = rota(async () => {
  await exigirUsuario();
  await rodarRotinas();
  return { cards: await cardsDoKanban() };
});
