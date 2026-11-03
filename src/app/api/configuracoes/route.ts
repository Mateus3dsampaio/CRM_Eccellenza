import { rota } from "@/lib/api";
import { agora } from "@/lib/relogio";
import { exigirUsuario } from "@/lib/sessao";
import { periodoPadrao } from "@/regras/exportacao";
import { modoDistribuicao, prazosDeEspera, regrasDaAgenda } from "@/servicos/configuracoes";
import { leadsNaFila } from "@/servicos/distribuicao";
import { listarEquipe } from "@/servicos/usuarios";

export const dynamic = "force-dynamic";

// Configurações da loja (só admin).
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  return {
    equipe: await listarEquipe(),
    distribuicao: await modoDistribuicao(),
    prazosEspera: await prazosDeEspera(),
    regrasAgenda: await regrasDaAgenda(),
    naFila: (await leadsNaFila()).length,
    periodoExportacao: periodoPadrao(await agora()),
  };
});
