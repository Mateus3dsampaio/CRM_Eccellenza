import { db } from "@/lib/db";
import { marcarMudanca } from "@/lib/versao";
import type { ModoDistribuicao } from "@/regras/distribuicao";
import { REGRAS_AGENDA_PADRAO, completarRegrasAgenda, validarRegrasAgenda, type RegrasAgenda } from "@/regras/agenda";
import { REGRAS_RETORNO_PADRAO, completarRegrasRetorno, validarRegrasRetorno, type RegrasRetorno } from "@/regras/retorno-fechada";
import { REGRAS_RECUPERACAO_PADRAO, completarRegrasRecuperacao, validarRegrasRecuperacao, type RegrasRecuperacao } from "@/regras/recuperacao";
import { REGRAS_PRESENCA_PADRAO, completarRegrasPresenca, validarRegrasPresenca, type RegrasPresenca } from "@/regras/presenca";
import { PRAZOS_ESPERA_PADRAO, validarPrazos, type PrazosEspera } from "@/regras/espera";

const CHAVE_MODO = "distribuicao_modo";
export const CHAVE_ULTIMO_RODIZIO = "distribuicao_ultimo";

export async function lerConfig(chave: string): Promise<string | null> {
  return (await db.configuracao.findUnique({ where: { chave } }))?.valor ?? null;
}

export async function gravarConfig(chave: string, valor: string): Promise<void> {
  await db.configuracao.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
}

const CHAVE_ESPERA_AMARELO = "espera_amarelo_min";
const CHAVE_ESPERA_VERMELHO = "espera_vermelho_min";

/** Prazos de espera do cliente (cor amarela e vermelha do card). Sem valor gravado, vale o padrão PROVISÓRIO. */
export async function prazosDeEspera(): Promise<PrazosEspera> {
  const amarelo = Number(await lerConfig(CHAVE_ESPERA_AMARELO));
  const vermelho = Number(await lerConfig(CHAVE_ESPERA_VERMELHO));
  return validarPrazos(amarelo, vermelho) === null ? { amarelo, vermelho } : { ...PRAZOS_ESPERA_PADRAO };
}

export async function definirPrazosDeEspera(prazos: PrazosEspera): Promise<void> {
  const erro = validarPrazos(prazos.amarelo, prazos.vermelho);
  if (erro) throw new Error(erro);
  await gravarConfig(CHAVE_ESPERA_AMARELO, String(prazos.amarelo));
  await gravarConfig(CHAVE_ESPERA_VERMELHO, String(prazos.vermelho));
  await marcarMudanca();
}

const CHAVE_AGENDA = "agenda";

/** Regras da agenda editadas em Configurações. Sem valor (ou valor inválido) vale o padrão PROVISÓRIO. */
export async function regrasDaAgenda(): Promise<RegrasAgenda> {
  const bruto = await lerConfig(CHAVE_AGENDA);
  if (!bruto) return REGRAS_AGENDA_PADRAO;
  try {
    // Regras gravadas antes de um campo novo (ex.: duração da medição) recebem o padrão nesse campo.
    const r = completarRegrasAgenda(JSON.parse(bruto) as Partial<RegrasAgenda>);
    return validarRegrasAgenda(r) === null ? r : REGRAS_AGENDA_PADRAO;
  } catch {
    return REGRAS_AGENDA_PADRAO;
  }
}

export async function definirRegrasDaAgenda(regras: RegrasAgenda): Promise<void> {
  const erro = validarRegrasAgenda(regras);
  if (erro) throw new Error(erro);
  await gravarConfig(CHAVE_AGENDA, JSON.stringify(regras));
  await marcarMudanca();
}

// Padrão: quem tem menos leads (como era antes). O admin liga o rodízio em Configurações.
export async function modoDistribuicao(): Promise<ModoDistribuicao> {
  return (await lerConfig(CHAVE_MODO)) === "rodizio" ? "rodizio" : "menos_leads";
}

export async function definirModoDistribuicao(modo: ModoDistribuicao): Promise<void> {
  await gravarConfig(CHAVE_MODO, modo);
  await marcarMudanca();
}

const CHAVE_PRESENCA = "presenca";

/** Regras de presença e fila da loja fechada (tarefa 35). Sem valor (ou inválido) vale o padrão decidido com o Mateus. */
export async function regrasDePresenca(): Promise<RegrasPresenca> {
  const bruto = await lerConfig(CHAVE_PRESENCA);
  if (!bruto) return REGRAS_PRESENCA_PADRAO;
  try {
    const r = completarRegrasPresenca(JSON.parse(bruto) as Partial<RegrasPresenca>);
    return validarRegrasPresenca(r) === null ? r : REGRAS_PRESENCA_PADRAO;
  } catch {
    return REGRAS_PRESENCA_PADRAO;
  }
}

export async function definirRegrasDePresenca(regras: RegrasPresenca): Promise<void> {
  const erro = validarRegrasPresenca(regras);
  if (erro) throw new Error(erro);
  await gravarConfig(CHAVE_PRESENCA, JSON.stringify(regras));
  await marcarMudanca();
}

const CHAVE_RETORNO = "retorno_fechada";

/** Regras do retorno com a loja fechada (tarefa 36). Sem valor (ou inválido) vale o padrão decidido com o Mateus. */
export async function regrasDeRetorno(): Promise<RegrasRetorno> {
  const bruto = await lerConfig(CHAVE_RETORNO);
  if (!bruto) return REGRAS_RETORNO_PADRAO;
  try {
    const r = completarRegrasRetorno(JSON.parse(bruto) as Partial<RegrasRetorno>);
    return validarRegrasRetorno(r) === null ? r : REGRAS_RETORNO_PADRAO;
  } catch {
    return REGRAS_RETORNO_PADRAO;
  }
}

export async function definirRegrasDeRetorno(regras: RegrasRetorno): Promise<void> {
  const erro = validarRegrasRetorno(regras);
  if (erro) throw new Error(erro);
  await gravarConfig(CHAVE_RETORNO, JSON.stringify(regras));
  await marcarMudanca();
}

const CHAVE_RECUPERACAO = "recuperacao_de_leads";

/** Regras da recuperação de leads. Sem valor (ou inválido) vale o padrão (desligado, valores PROVISÓRIOS). */
export async function regrasDeRecuperacao(): Promise<RegrasRecuperacao> {
  const bruto = await lerConfig(CHAVE_RECUPERACAO);
  if (!bruto) return REGRAS_RECUPERACAO_PADRAO;
  try {
    const r = completarRegrasRecuperacao(JSON.parse(bruto) as Partial<RegrasRecuperacao>);
    return validarRegrasRecuperacao(r) === null ? r : REGRAS_RECUPERACAO_PADRAO;
  } catch {
    return REGRAS_RECUPERACAO_PADRAO;
  }
}

export async function definirRegrasDeRecuperacao(regras: RegrasRecuperacao): Promise<void> {
  const erro = validarRegrasRecuperacao(regras);
  if (erro) throw new Error(erro);
  await gravarConfig(CHAVE_RECUPERACAO, JSON.stringify(regras));
  await marcarMudanca();
}
