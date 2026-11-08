import { db } from "@/lib/db";
import { cifrarChave, decifrarChave } from "@/lib/cifra";
import { finalDaChave, problemaNaChave, TIPOS_CHAVE, VARIAVEL_DA_CHAVE, type TipoChave } from "@/regras/chaves-api";
import { gravarConfig, lerConfig } from "./configuracoes";

// Chaves de API editadas na tela (guardadas criptografadas em `Configuracao`).
// Quem vale: a da tela; sem ela, a variável de ambiente (ANTHROPIC_API_KEY / OPENAI_API_KEY).
// NUNCA registrar, devolver inteira ou colocar a chave em mensagem de erro.

// Os nomes no banco ficaram os de antes ("texto" guardava a da Anthropic, "audio" a da OpenAI): as chaves já salvas continuam valendo sem colar de novo.
const CHAVE_BANCO: Record<TipoChave, string> = { anthropic: "api_chave_texto", openai: "api_chave_audio" };
const CHAVE_SEGREDO_LOCAL = "segredo_sessao"; // só no computador, quando não há CHAVE_MESTRA

export class ErroChave extends Error {}

/** Em produção a chave mestra (variável CHAVE_MESTRA) é obrigatória: sem ela o banco sozinho abriria as chaves. No computador, usa o segredo local. */
export async function segredoDeCifra(): Promise<string | null> {
  const mestra = process.env.CHAVE_MESTRA?.trim();
  if (mestra) {
    if (mestra.length < 16) throw new ErroChave("A variável CHAVE_MESTRA está curta demais (mínimo 16 caracteres).");
    return mestra;
  }
  if (process.env.NODE_ENV === "production") return null;
  return (await lerConfig(CHAVE_SEGREDO_LOCAL)) ?? "segredo-local-de-desenvolvimento";
}

/** A chave que vale agora (tela ou variável), ou null. */
export async function obterChave(tipo: TipoChave): Promise<string | null> {
  const guardada = await lerConfig(CHAVE_BANCO[tipo]);
  if (guardada) {
    const segredo = await segredoDeCifra().catch(() => null);
    const chave = segredo ? decifrarChave(guardada, segredo) : null;
    if (chave) return chave;
    console.error(`[chaves-api] não consegui abrir a chave "${tipo}" guardada (CHAVE_MESTRA mudou?). Usando a variável de ambiente.`);
  }
  return process.env[VARIAVEL_DA_CHAVE[tipo]]?.trim() || null;
}

export async function salvarChave(tipo: TipoChave, chave: string): Promise<void> {
  const limpa = chave.trim();
  const problema = problemaNaChave(limpa);
  if (problema) throw new ErroChave(problema);
  const segredo = await segredoDeCifra();
  if (!segredo) throw new ErroChave("Para salvar chaves pela tela, defina a variável CHAVE_MESTRA no Railway (um texto longo e secreto, mínimo 16 caracteres) e reinicie. Veja docs/colocar-no-ar.md.");
  await gravarConfig(CHAVE_BANCO[tipo], cifrarChave(limpa, segredo));
}

export async function removerChave(tipo: TipoChave): Promise<void> {
  await db.configuracao.deleteMany({ where: { chave: CHAVE_BANCO[tipo] } });
}

export interface SituacaoChave {
  configurada: boolean;
  /** De onde vem a chave que vale: a tela, a variável de ambiente ou nenhuma. */
  origem: "tela" | "ambiente" | null;
  final: string | null;
  /** Há uma chave da tela guardada, mas não deu para abrir (CHAVE_MESTRA mudou). */
  ilegivel: boolean;
}

export interface SituacaoChaves {
  chaves: Record<TipoChave, SituacaoChave>;
  /** Dá para salvar pela tela agora (produção exige CHAVE_MESTRA). */
  podeSalvar: boolean;
}

export async function situacaoDasChaves(): Promise<SituacaoChaves> {
  const podeSalvar = (await segredoDeCifra().catch(() => null)) !== null;
  const chaves = {} as Record<TipoChave, SituacaoChave>;
  for (const tipo of TIPOS_CHAVE) {
    const guardada = await lerConfig(CHAVE_BANCO[tipo]);
    const segredo = guardada ? await segredoDeCifra().catch(() => null) : null;
    const daTela = guardada && segredo ? decifrarChave(guardada, segredo) : null;
    const doAmbiente = process.env[VARIAVEL_DA_CHAVE[tipo]]?.trim() || null;
    const vale = daTela ?? doAmbiente;
    chaves[tipo] = {
      configurada: !!vale,
      origem: daTela ? "tela" : doAmbiente ? "ambiente" : null,
      final: vale ? finalDaChave(vale) : null,
      ilegivel: !!guardada && !daTela,
    };
  }
  return { chaves, podeSalvar };
}
