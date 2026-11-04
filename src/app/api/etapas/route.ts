import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { definirNomeDaEtapa, nomesDasEtapas } from "@/servicos/etapas";

export const dynamic = "force-dynamic";

// Nomes das colunas do Kanban. Qualquer usuário logado lê; só o admin renomeia (`configurar`).
export const GET = rota(async () => {
  await exigirUsuario();
  return { nomes: await nomesDasEtapas() };
});

const Corpo = z.object({ codigo: z.string(), nome: z.string().nullable().optional() });

export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const corpo = Corpo.parse(await req.json());
  return { nomes: await definirNomeDaEtapa(corpo.codigo, corpo.nome ?? null) };
});
