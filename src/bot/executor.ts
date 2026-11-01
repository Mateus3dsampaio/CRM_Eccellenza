import { ZodError } from "zod";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { ETIQUETA_DA_CLASSIFICACAO, type Classificacao } from "@/regras/etapas";
import { formatarVisitaCurta, lerChaveDia, partesLocais } from "@/regras/tempo";
import { agendarVisita, ErroAgenda, horariosLivresParaLead } from "@/servicos/agenda";
import { registrarAlteracao } from "@/servicos/historico";
import { escolherProximoConsultor } from "@/servicos/distribuicao";
import { alterarEtiqueta, atualizarCampos, atualizarResumo, moverEtapa } from "@/servicos/leads";
import { registrarUmaVez } from "@/servicos/metricas";
import { esquemaAgendar, esquemaCampos, esquemaClassificar, esquemaHorarios, esquemaMedidas, esquemaPassar } from "./ferramentas";

export interface ResultadoFerramenta {
  conteudo: string;
  erro?: boolean;
}

/** ISO com o fuso de Fortaleza, para o bot devolver exatamente o mesmo valor. */
function isoLocal(d: Date): string {
  const p = partesLocais(d);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}T${dois(p.hora)}:${dois(p.minuto)}:00-03:00`;
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

      case "ver_horarios_livres": {
        const { a_partir_de } = esquemaHorarios.parse(entrada ?? {});
        const aPartirDe = a_partir_de ? lerChaveDia(a_partir_de) ?? undefined : undefined;
        // Com dia pedido pelo cliente, devolve mais opções a partir dele (para achar o horário que ele quer).
        const vagas = await horariosLivresParaLead(leadId, aPartirDe ? 12 : 6, aPartirDe);
        if (!vagas.length) return { conteudo: "Nenhum horário livre nos próximos 14 dias. Diga ao cliente que o consultor vai combinar o horário." };
        return { conteudo: JSON.stringify(vagas.map((v) => ({ inicio: isoLocal(v.inicio), rotulo: formatarVisitaCurta(v.inicio) }))) };
      }

      case "agendar_visita": {
        const { inicio } = esquemaAgendar.parse(entrada);
        const data = new Date(inicio);
        if (Number.isNaN(data.getTime())) return { conteudo: "Data inválida. Use o campo inicio de ver_horarios_livres.", erro: true };
        // Quem recebe o lead segue a regra de distribuição (rodízio ou menos leads) e só entre os consultores online.
        const dono = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { consultorId: true } });
        if (!dono.consultorId) await db.lead.update({ where: { id: leadId }, data: { consultorId: await escolherProximoConsultor() } });
        const visita = await agendarVisita({ leadId, inicio: data, autor: "bot", validarJanelaDoBot: true });
        return { conteudo: `Visita agendada: ${formatarVisitaCurta(visita.inicio)}, com o consultor ${visita.consultor.nome}.` };
      }

      case "passar_para_consultor": {
        const { motivo } = esquemaPassar.parse(entrada ?? {});
        const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
        const consultorId = lead.consultorId ?? (await escolherProximoConsultor());
        await db.lead.update({ where: { id: leadId }, data: { modoAtendimento: "pausado", aguardandoHumano: true, consultorId, repassadoEm: lead.aguardandoHumano && lead.repassadoEm ? lead.repassadoEm : await agora() } });
        if (lead.etapa === "novo") await moverEtapa(leadId, "pronto", "bot");
        await registrarAlteracao(leadId, "bot", `Passou para o consultor${motivo ? ` (${motivo})` : ""}; bot pausado nesta conversa`);
        await atualizarResumo(leadId);
        await marcarMudanca();
        return { conteudo: "Lead passado ao consultor. Envie agora sua mensagem final ao cliente, se ainda não enviou." };
      }

      default:
        return { conteudo: `Ferramenta desconhecida: ${nome}`, erro: true };
    }
  } catch (erro) {
    if (erro instanceof ZodError) return { conteudo: `Dados inválidos: ${erro.issues.map((i) => i.message).join("; ")}`, erro: true };
    if (erro instanceof ErroAgenda) return { conteudo: erro.message, erro: true };
    console.error("[bot] erro na ferramenta", nome, erro instanceof Error ? erro.message : "");
    return { conteudo: "Erro ao gravar. Siga a conversa sem citar o erro ao cliente.", erro: true };
  }
}
