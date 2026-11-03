import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { exigirUsuario } from "@/lib/sessao";
import { periodoPadrao } from "@/regras/exportacao";
import { modoDistribuicao, prazosDeEspera } from "@/servicos/configuracoes";
import { leadsNaFila } from "@/servicos/distribuicao";

export const dynamic = "force-dynamic";

// Configurações da loja (só admin).
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  const equipe = await db.usuario.findMany({
    orderBy: [{ perfil: "asc" }, { criadoEm: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, login: true, perfil: true, ativo: true, status: true },
  });
  return {
    equipe,
    distribuicao: await modoDistribuicao(),
    prazosEspera: await prazosDeEspera(),
    naFila: (await leadsNaFila()).length,
    periodoExportacao: periodoPadrao(await agora()),
  };
});
