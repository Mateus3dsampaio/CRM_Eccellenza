import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CODIGOS_CLASSIFICACAO } from "@/regras/etapas";

// BOT-03: ferramentas do bot. Esquemas para a API + validação (zod) antes de gravar no banco.
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
    description: "Grava os primeiros dados do lead desta conversa. Use quando o cliente começar a passar informações. Grave só o que o cliente disse.",
    input_schema: { type: "object", properties: camposLead, additionalProperties: false },
  },
  {
    name: "atualizar_lead",
    description: "Atualiza ou completa os dados do lead desta conversa sempre que o cliente disser algo novo. Grave só o que o cliente disse.",
    input_schema: { type: "object", properties: camposLead, additionalProperties: false },
  },
  {
    name: "classificar_lead",
    description:
      "Classifica o lead: qualificado (concluiu o roteiro, região atendida), curioso (só quer preço, não passa informações), outra_cidade, parceiro (arquiteto, designer ou construtora), pos_venda (já comprou e fala de entrega, montagem ou assistência), ja_atendido (já foi atendido por consultor ou já tem orçamento).",
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
    description: "Grava medidas informadas pelo cliente (texto, foto, planta ou áudio). Para foto ou planta, só chame depois que o cliente confirmar o que você leu.",
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
    name: "ver_horarios_livres",
    description: "Lista horários livres para a visita à loja, já respeitando as regras da agenda e os bloqueios. Ofereça ao cliente no máximo 3.",
    input_schema: {
      type: "object",
      properties: {
        a_partir_de: { type: "string", description: "Opcional. Data AAAA-MM-DD a partir da qual buscar, se o cliente pediu outro dia." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "agendar_visita",
    description: "Agenda a visita do cliente na loja em um horário retornado por ver_horarios_livres e escolhido pelo cliente.",
    input_schema: {
      type: "object",
      properties: { inicio: { type: "string", description: "Início exato do horário, como veio em ver_horarios_livres (campo inicio)." } },
      required: ["inicio"],
      additionalProperties: false,
    },
  },
  {
    name: "passar_para_consultor",
    description: "Encerra a parte do bot: gera o resumo, move o card para \"Pronto para o consultor\" e pausa o bot nesta conversa.",
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

export const esquemaHorarios = z.object({ a_partir_de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict();
export const esquemaAgendar = z.object({ inicio: z.string().min(10).max(40) }).strict();
export const esquemaPassar = z.object({ motivo: z.string().max(300).optional() }).strict();
