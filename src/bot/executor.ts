import { ZodError } from "zod";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { ETIQUETA_DA_CLASSIFICACAO, type Classificacao } from "@/regras/etapas";
import { registrarAlerta } from "@/servicos/alertas";
import { registrarAlteracao } from "@/servicos/historico";
import { escolherProximoConsultor } from "@/servicos/distribuicao";
import { alterarEtiqueta, atualizarCampos, atualizarResumo, moverEtapa } from "@/servicos/leads";
import { registrarUmaVez } from "@/servicos/metricas";
import { esquemaCampos, esquemaClassificar, esquemaMedidas, esquemaPassar } from "./ferramentas";

export interface ResultadoFerramenta {
  conteudo: string;
  erro?: boolean;
}

export async function executarFerramenta(leadId: string, nome: string, entrada: unknown): Promise<ResultadoFerramenta> {
  try {
    switch (nome) {
      case "registrar_lead":
      case "atualizar_lead": {
        const c = esquemaCampos.parse(entrada);
        await atualizarCampos(
          leadId,
          {
            nome: c.nome,
            cidade: c.cidade,
            endereco: c.endereco,
            ambientes: c.ambientes,
            exigencias: c.exigencias,
            situacaoImovel: c.situacao_imovel,
            prazo: c.prazo,
            investimento: c.investimento,
            pedidosTecnicos: c.pedidos_tecnicos,
            observacoes: c.observacoes,
          },
          "bot",
          "acrescentar",
        );
        return { conteudo: "Gravado." };
      }

      case "classificar_lead": {
        const { classificacao, motivo } = esquemaClassificar.parse(entrada);
        await db.lead.update({ where: { id: leadId }, data: { classificacao } });
        await registrarAlteracao(leadId, "bot", `Classificou como "${classificacao}"${motivo ? ` (${motivo})` : ""}`);
        const etiqueta = ETIQUETA_DA_CLASSIFICACAO[classificacao as Classificacao];
        if (etiqueta) await alterarEtiqueta(leadId, etiqueta, true, "bot");
        await registrarUmaVez(leadId, classificacao as Classificacao);
        await atualizarResumo(leadId);
        await marcarMudanca();
        return { conteudo: "Classificação gravada." };
      }

      case "registrar_medidas": {
        const { medidas } = esquemaMedidas.parse(entrada);
        const quando = await agora();
        for (const m of medidas) {
          await db.medida.create({ data: { leadId, ambiente: m.ambiente, descricao: m.descricao, fonte: m.fonte, confirmada: m.confirmada, criadoEm: quando } });
        }
        await registrarAlteracao(leadId, "bot", `Registrou ${medidas.length} medida(s)`);
        await atualizarResumo(leadId);
        await marcarMudanca();
        return { conteudo: "Medidas gravadas com origem \"informada pelo cliente\"." };
      }

      case "passar_para_consultor": {
        const { motivo } = esquemaPassar.parse(entrada ?? {});
        const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
        const consultorId = lead.consultorId ?? (await escolherProximoConsultor());
        const quando = await agora();
        await db.lead.update({
          where: { id: leadId },
          data: {
            modoAtendimento: "pausado",
            aguardandoHumano: true,
            consultorId,
            repassadoEm: lead.aguardandoHumano && lead.repassadoEm ? lead.repassadoEm : quando,
            // O consultor ainda não viu nada: a espera começa agora e a mensagem que motivou o repasse conta como não lida.
            esperandoDesde: lead.esperandoDesde ?? quando,
            naoLidas: Math.max(lead.naoLidas, 1),
          },
        });
        // Tarefa 22: sem "Aguardando consultor"; o card vai direto para Em qualificação, já com o vendedor do rodízio (ou na fila).
        if (lead.etapa === "novo") await moverEtapa(leadId, "qualificacao", "bot");
        // Só avisa na primeira vez: repasse repetido de um lead que já espera não é novidade.
        if (!lead.aguardandoHumano) await registrarAlerta({ tipo: "lead_passado", leadId });
        await registrarAlteracao(leadId, "bot", `Passou para o consultor${motivo ? ` (${motivo})` : ""}; bot pausado nesta conversa`);
        await atualizarResumo(leadId);
        await marcarMudanca();
        return { conteudo: "Lead passado ao consultor." };
      }

      default:
        return { conteudo: `Ferramenta desconhecida: ${nome}`, erro: true };
    }
  } catch (erro) {
    if (erro instanceof ZodError) return { conteudo: `Dados inválidos: ${erro.issues.map((i) => i.message).join("; ")}`, erro: true };
    console.error("[bot] erro na ferramenta", nome, erro instanceof Error ? erro.message : "");
    return { conteudo: "Erro ao gravar.", erro: true };
  }
}
