import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CODIGOS_CLASSIFICACAO } from "@/regras/etapas";

// BOT-03: ferramentas do bot. O bot não agenda (decisão do Mateus 04/11/2026): quem marca visita, medição e apresentação é o consultor. Esquemas para a API + validação (zod) antes de gravar no banco.
const textoOpcional = { type: "string" } as const;
const lista = { type: "array", items: { type: "string" } } as const;

const camposLead = {
  nome: { ...textoOpcional, description: "Nome como o cliente prefere ser chamado (só se ele disser ou se o nome do perfil for nome de pessoa)." },
  cidade: { ...textoOpcional, description: "Cidade do projeto." },
  endereco: { ...textoOpcional, description: "Endereço do imóvel, só se o cliente informar." },
  ambientes: { ...lista, description: "Ambientes que o cliente quer (ex.: cozinha, quarto de casal, closet). Acrescenta aos já gravados." },
  exigencias: { ...lista, description: "Exigências e preferências pessoais ditas pelo cliente (ex.: cores claras, cooktop na ilha)." },
  situacao_imovel: { ...textoOpcional, description: "Situação do imóvel: pronto, em obra, na planta, reformando etc." },
  prazo: { ...textoOpcional, description: "Para quando o cliente precisa dos móveis ou data-limite que ele citou (mudança, fim da obra)." },
  investimento: { ...textoOpcional, description: "Valor que o cliente disse ter em mente, como ele disse (ex.: \"uns 5 mil\")." },
  pedidos_tecnicos: { ...lista, description: "Pedidos técnicos ou fora do padrão, com o texto EXATO do cliente (instrução 11)." },
  observacoes: { ...textoOpcional, description: "Outras informações úteis ditas pelo cliente que não cabem nos campos acima." },
};

export const FERRAMENTAS: Anthropic.Tool[] = [
  {
    name: "registrar_lead",
    description: "Grava os primeiros dados do lead desta conversa.",
    input_schema: { type: "object", properties: camposLead, additionalProperties: false },
  },
  {
    name: "atualizar_lead",
    description: "Atualiza ou completa os dados do lead desta conversa.",
    input_schema: { type: "object", properties: camposLead, additionalProperties: false },
  },
  {
    name: "classificar_lead",
    description:
      "Classifica o lead. Os critérios de cada classificação estão nas instruções de atendimento.",
    input_schema: {
      type: "object",
      properties: {
        classificacao: { type: "string", enum: CODIGOS_CLASSIFICACAO },
        motivo: { type: "string", description: "Motivo curto, para o consultor." },
      },
      required: ["classificacao"],
      additionalProperties: false,
    },
  },
  {
    name: "registrar_medidas",
    description: "Grava as medidas do lead (texto, foto, planta ou áudio).",
    input_schema: {
      type: "object",
      properties: {
        medidas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ambiente: { type: "string", description: "Ex.: cozinha, quarto de casal." },
              descricao: { type: "string", description: "Medida como entendida, ex.: \"3,20 × 2,10 m\" ou \"parede da pia 3,20 m\"." },
              fonte: { type: "string", enum: ["texto", "foto", "planta", "audio"] },
              confirmada: { type: "boolean", description: "true se o cliente confirmou a medida." },
            },
            required: ["ambiente", "descricao", "fonte", "confirmada"],
            additionalProperties: false,
          },
        },
      },
      required: ["medidas"],
      additionalProperties: false,
    },
  },
  {
    name: "registrar_retorno",
    description:
      "Agenda o retorno do consultor com o cliente e guarda uma nota. Use quando o cliente chegou com a loja fechada e disse quando prefere ser chamado. O sistema confere o horário: se a loja estiver fechada nessa hora ou o horário já passou, usa a reabertura. Não substitui um retorno que já esteja marcado.",
    input_schema: {
      type: "object",
      properties: {
        quando: { type: "string", description: "Melhor horário para o consultor chamar, no horário de Fortaleza, no formato AAAA-MM-DD HH:MM. Omita se o cliente não escolheu." },
        nota: { type: "string", description: "O que o cliente disse, para o consultor (ex.: \"Cliente pediu contato segunda de manhã – chegou com a loja fechada\")." },
      },
      required: ["nota"],
      additionalProperties: false,
    },
  },
  {
    name: "passar_para_consultor",
    description: "Encerra a parte do bot: gera o resumo, move o card para \"Em qualificação\" e pausa o bot nesta conversa.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string", description: "Motivo curto (ex.: roteiro concluído, outra cidade, arquiteto)." } },
      additionalProperties: false,
    },
  },
];

const texto = z.string().trim().max(500).optional();
const listaTextos = z.array(z.string().trim().min(1).max(500)).max(30).optional();

export const esquemaCampos = z
  .object({
    nome: texto,
    cidade: texto,
    endereco: texto,
    ambientes: listaTextos,
    exigencias: listaTextos,
    situacao_imovel: texto,
    prazo: texto,
    investimento: texto,
    pedidos_tecnicos: listaTextos,
    observacoes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const esquemaClassificar = z.object({ classificacao: z.enum(CODIGOS_CLASSIFICACAO as [string, ...string[]]), motivo: z.string().max(300).optional() }).strict();

export const esquemaMedidas = z
  .object({
    medidas: z
      .array(
        z.object({
          ambiente: z.string().trim().min(1).max(100),
          descricao: z.string().trim().min(1).max(300),
          fonte: z.enum(["texto", "foto", "planta", "audio"]),
          confirmada: z.boolean(),
        }),
      )
      .min(1)
      .max(20),
  })
  .strict();

export const esquemaPassar = z.object({ motivo: z.string().max(300).optional() }).strict();

export const esquemaRetorno = z
  .object({
    quando: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/, "Use o formato AAAA-MM-DD HH:MM.")
      .optional(),
    nota: z.string().trim().min(1).max(500),
  })
  .strict();
