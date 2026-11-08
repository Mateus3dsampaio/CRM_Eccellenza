import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { filtrarModelosClaude, filtrarModelosGpt, garantirNaLista, RESERVA_CLAUDE, type ModeloIa } from "@/regras/modelos-ia";
import { obterChave } from "./chaves-api";
import { configDoBot, type ProvedorBot } from "./provedor-bot";

// Lista de modelos para a escolha em Configurações > Chaves de API, buscada na conta de cada empresa.
// Sem chave ou com erro: lista de reserva (Claude) ou só o modelo salvo (GPT), com o motivo para a tela.
// A chave nunca vai para a resposta nem para o log.

export interface ListaDeModelos {
  provedor: ProvedorBot;
  modelos: ModeloIa[];
  /** "conta": veio da conta da empresa. "reserva": a busca não deu certo (ver `aviso`). */
  origem: "conta" | "reserva";
  aviso: string | null;
}

const TEMPO_LIMITE = 15_000;

function motivoDoErro(erro: unknown): string {
  if (erro instanceof Anthropic.AuthenticationError || erro instanceof OpenAI.AuthenticationError) return "a chave foi recusada. Confira se colou a chave certa.";
  if (erro instanceof Anthropic.PermissionDeniedError || erro instanceof OpenAI.PermissionDeniedError) return "a chave não tem permissão para listar modelos.";
  if (erro instanceof Anthropic.APIConnectionError || erro instanceof OpenAI.APIConnectionError) return "não consegui falar com a empresa agora (rede).";
  return "a empresa respondeu com erro.";
}

async function daAnthropic(chave: string): Promise<ModeloIa[]> {
  const api = new Anthropic({ apiKey: chave, timeout: TEMPO_LIMITE, maxRetries: 1 });
  const lista: { id: string; nome: string }[] = [];
  for await (const m of api.models.list({ limit: 100 })) lista.push({ id: m.id, nome: m.display_name });
  return filtrarModelosClaude(lista);
}

async function daOpenai(chave: string): Promise<ModeloIa[]> {
  const api = new OpenAI({ apiKey: chave, timeout: TEMPO_LIMITE, maxRetries: 1 });
  const lista: { id: string; criado: number }[] = [];
  for await (const m of api.models.list()) lista.push({ id: m.id, criado: m.created });
  return filtrarModelosGpt(lista);
}

export async function listarModelos(provedor: ProvedorBot): Promise<ListaDeModelos> {
  const config = await configDoBot();
  const salvo = provedor === "claude" ? config.modeloClaude : config.modeloOpenai;
  const reserva = provedor === "claude" ? filtrarModelosClaude(RESERVA_CLAUDE) : [];
  const comSalvo = (lista: ModeloIa[]) => garantirNaLista(lista, salvo, "Modelo escolhido antes. Não veio na lista da sua conta.");

  const chave = await obterChave(provedor === "claude" ? "anthropic" : "openai");
  if (!chave) return { provedor, modelos: comSalvo(reserva), origem: "reserva", aviso: "Sem chave configurada: lista de reserva." };
  try {
    const modelos = provedor === "claude" ? await daAnthropic(chave) : await daOpenai(chave);
    if (modelos.length === 0) return { provedor, modelos: comSalvo(reserva), origem: "reserva", aviso: "A conta não devolveu nenhum modelo de conversa." };
    return { provedor, modelos: comSalvo(modelos), origem: "conta", aviso: null };
  } catch (erro) {
    console.error(`[modelos-ia] não consegui listar os modelos (${provedor}): ${motivoDoErro(erro)}`);
    return { provedor, modelos: comSalvo(reserva), origem: "reserva", aviso: `Não consegui buscar a lista: ${motivoDoErro(erro)}` };
  }
}
