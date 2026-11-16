import { agora } from "@/lib/relogio";
import type { RegrasArquivarPerdido } from "@/regras/arquivar-perdido";
import type { RegrasDesclassificados } from "@/regras/desclassificados";
import type { RegrasRedeDeSeguranca } from "@/regras/rede-seguranca";
import { perdidosVencidos } from "./arquivar-perdido";
import { regrasDaRedeDeSeguranca, regrasDeArquivarPerdido, regrasDeDesclassificados } from "./configuracoes";
import { desclassificadosVencidos } from "./desclassificados";
import { redeVencidos } from "./rede-seguranca";

/** Quantos cards cada regra pegaria AGORA se estivesse ligada, com os prazos salvos. A tela mostra antes de o admin ligar. */
export interface PreviaDaAutomacao {
  desclassificados: number;
  redePerdido: number;
  redeArquivar: number;
  arquivarAutomatico: number;
  arquivarVendedor: number;
}

export interface DadosDaAutomacao {
  desclassificados: RegrasDesclassificados;
  rede: RegrasRedeDeSeguranca;
  arquivar: RegrasArquivarPerdido;
  previa: PreviaDaAutomacao;
}

/** Regras das três automações (tarefas 40 a 42) e a prévia, para Configurações > Automação de leads. Só lê, não move nada. */
export async function dadosDaAutomacao(): Promise<DadosDaAutomacao> {
  const quando = await agora();
  const desclassificados = await regrasDeDesclassificados();
  const rede = await regrasDaRedeDeSeguranca();
  const arquivar = await regrasDeArquivarPerdido();
  const daRede = await redeVencidos({ ...rede, ligado: true }, quando);
  const doArquivo = await perdidosVencidos({ ...arquivar, ligado: true }, quando);
  return {
    desclassificados,
    rede,
    arquivar,
    previa: {
      desclassificados: (await desclassificadosVencidos({ ...desclassificados, ligado: true }, quando)).length,
      redePerdido: daRede.filter((l) => l.acao === "perdido").length,
      redeArquivar: daRede.filter((l) => l.acao === "arquivar").length,
      arquivarAutomatico: doArquivo.filter((l) => l.automatico).length,
      arquivarVendedor: doArquivo.filter((l) => !l.automatico).length,
    },
  };
}
