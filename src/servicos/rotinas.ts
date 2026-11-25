import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { deveExcluirArquivado, deveExcluirFechado, DIAS_ARQUIVADO_ATE_EXCLUIR, DIAS_FECHADO_ATE_EXCLUIR } from "@/regras/limpeza";
import { formatarDataHora } from "@/regras/tempo";
import { rodarArquivarPerdidos } from "./arquivar-perdido";
import { avisarDecisoesVencidas, avisarPrazosVermelhos, avisarRetornos } from "./alertas";
import { excluirLeads } from "./leads";
import { apagarMidiasAntigas, apagarMidiasSoltas } from "./midias";
import { rodarPresenca } from "./presenca";
import { rodarRecuperacao } from "./recuperacao";
import { rodarRedeDeSeguranca } from "./rede-seguranca";
import { enviarRetornosAutomaticos } from "./retorno-fechada";
import { limparLogsAntigos, reprocessarEventosPendentes } from "./whatsapp";

export interface ResultadoRotinas {
  /** Mensagens de recuperação enviadas (1ª e 2ª). */
  mensagens: number;
  /** Leads que as rotinas moveram para Perdido (recuperação e rede de segurança). */
  perdidos: number;
  /** Leads que as rotinas mandaram para o arquivo (Perdido vencido e pós-venda parado). */
  arquivados: number;
  excluidos: number;
  /** Parte de `excluidos` que foi por passar 180 dias do fechamento. */
  fechadosExcluidos?: number;
}

/** Leads em "Fechado" há 180 dias ou mais. A data é a última vez que entraram em Fechado; sem esse registro (dado antigo), vale a última alteração. */
async function leadsFechadosVencidos(quando: Date): Promise<string[]> {
  const fechados = await db.lead.findMany({ where: { etapa: "fechado" }, select: { id: true, atualizadoEm: true } });
  if (!fechados.length) return [];
  const mudancas = await db.mudancaEtapa.groupBy({ by: ["leadId"], where: { leadId: { in: fechados.map((l) => l.id) }, para: "fechado" }, _max: { criadoEm: true } });
  const fechadoEm = new Map(mudancas.map((m) => [m.leadId, m._max.criadoEm]));
  return fechados.filter((l) => deveExcluirFechado(fechadoEm.get(l.id) ?? l.atualizadoEm, quando)).map((l) => l.id);
}

async function registrar(texto: string) {
  await db.registroRotina.create({ data: { texto, criadoEm: await agora() } });
}

// Evita duas execuções ao mesmo tempo (ex.: duas abas avançando o relógio).
let emExecucao: Promise<ResultadoRotinas> | null = null;

/** Rotinas de tempo: recuperação, rede de segurança, arquivar perdidos, limpezas (LIMP-04). Rodam a cada minuto, ao avançar o relógio e ao abrir o kanban. */
export function rodarRotinas(): Promise<ResultadoRotinas> {
  if (!emExecucao) emExecucao = executar().finally(() => (emExecucao = null));
  return emExecucao;
}

async function executar(): Promise<ResultadoRotinas> {
  const quando = await agora();
  const resultado: ResultadoRotinas = { mensagens: 0, perdidos: 0, arquivados: 0, excluidos: 0 };

  // Cliente que fechou projeto segue a regra dos 180 dias (abaixo), mesmo arquivado; os demais arquivados saem em 30 dias.
  const arquivados = await db.lead.findMany({ where: { arquivadoEm: { not: null }, etapa: { not: "fechado" } }, select: { id: true, arquivadoEm: true } });
  const vencidos = arquivados.filter((l) => deveExcluirArquivado(l.arquivadoEm, quando)).map((l) => l.id);
  if (vencidos.length) resultado.excluidos = await excluirLeads(vencidos);

  const fechadosVencidos = await leadsFechadosVencidos(quando);
  if (fechadosVencidos.length) {
    const telefones = await db.lead.findMany({ where: { id: { in: fechadosVencidos } }, select: { telefone: true } });
    const apagados = await excluirLeads(fechadosVencidos);
    if (apagados) {
      // Mesmo registro da exclusão pedida por pessoa: só a ação, quem e os 4 últimos dígitos.
      await db.pedidoLgpd.createMany({ data: telefones.map((l) => ({ acao: "exclusao", quem: `sistema (${DIAS_FECHADO_ATE_EXCLUIR} dias após fechar)`, telefoneFim: (l.telefone ?? "").replace(/\D/g, "").slice(-4) })) });
      resultado.excluidos += apagados;
      resultado.fechadosExcluidos = apagados;
    }
  }

  // A limpeza de arquivos nunca pode derrubar o resto das rotinas.
  try {
    const midiasApagadas = await apagarMidiasAntigas();
    if (midiasApagadas) await registrar(`${formatarDataHora(quando)}: ${midiasApagadas} arquivo(s) apagado(s) por terem mais de 180 dias.`);
    await apagarMidiasSoltas();
  } catch {
    console.error("[rotinas] a limpeza de arquivos falhou");
  }
  await limparLogsAntigos();
  await reprocessarEventosPendentes();

  // Presença (tarefa 35): desliga no fechamento, reparte a fila e avisa quem não ficou online. Erro aqui não para o resto.
  try {
    await rodarPresenca();
  } catch (erro) {
    console.error("[rotinas] presença falhou:", erro instanceof Error ? erro.message : "desconhecido");
  }

  // Retorno do lead que chegou com a loja fechada (tarefa 36): o modelo sai no horário, só com dono online.
  try {
    await enviarRetornosAutomaticos();
  } catch (erro) {
    console.error("[rotinas] retorno automático falhou:", erro instanceof Error ? erro.message : "desconhecido");
  }

  // Recuperação de leads: 1ª e 2ª mensagem para quem sumiu e, depois, Perdido. Erro aqui não para o resto.
  try {
    const r = await rodarRecuperacao();
    resultado.mensagens += r.primeiras + r.segundas;
    resultado.perdidos += r.perdidos;
  } catch (erro) {
    console.error("[rotinas] recuperação de leads falhou:", erro instanceof Error ? erro.message : "desconhecido");
  }

  // Rede de segurança: por último, para pegar só o que a recuperação não tirou do quadro.
  try {
    const r = await rodarRedeDeSeguranca();
    resultado.perdidos += r.perdidos;
    resultado.arquivados += r.arquivados;
  } catch (erro) {
    console.error("[rotinas] rede de segurança falhou:", erro instanceof Error ? erro.message : "desconhecido");
  }

  // Perdido arquiva sozinho (tarefa 42). Depois das regras que movem para Perdido: o prazo conta da entrada na coluna.
  try {
    resultado.arquivados += await rodarArquivarPerdidos();
  } catch (erro) {
    console.error("[rotinas] arquivar perdidos falhou:", erro instanceof Error ? erro.message : "desconhecido");
  }

  // O relógio simulado pode ter andado: confere os prazos de espera.
  await avisarPrazosVermelhos();
  await avisarRetornos();
  await avisarDecisoesVencidas();

  const partes: string[] = [];
  if (resultado.mensagens) partes.push(`${resultado.mensagens} mensagem(ns) de recuperação enviada(s)`);
  if (resultado.perdidos) partes.push(`${resultado.perdidos} lead(s) movido(s) para Perdido sem resposta`);
  if (resultado.arquivados) partes.push(`${resultado.arquivados} card(s) arquivado(s) automaticamente`);
  if (resultado.excluidos) partes.push(`${resultado.excluidos} arquivado(s) excluído(s) de vez (${DIAS_ARQUIVADO_ATE_EXCLUIR} dias no arquivo)`);
  if (resultado.fechadosExcluidos) partes.push(`${resultado.fechadosExcluidos} cliente(s) que fecharam projeto excluído(s) de vez (${DIAS_FECHADO_ATE_EXCLUIR} dias após fechar)`);
  if (partes.length) {
    await registrar(`${formatarDataHora(quando)}: ${partes.join("; ")}.`);
    await marcarMudanca();
  }
  return resultado;
}

export async function registrarAvanco(texto: string) {
  await registrar(texto);
}
