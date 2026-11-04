import { ErroHttp } from "@/lib/sessao";
import { marcarMudanca } from "@/lib/versao";
import { CODIGOS_ETAPA, etapaValida, mesclarNomesDasEtapas, nomesPadraoDasEtapas, validarNomeDaEtapa, type CodigoEtapa, type NomesEtapas } from "@/regras/etapas";
import { gravarConfig, lerConfig } from "./configuracoes";

const CHAVE = "nomes_etapas";

/** Nome de cada coluna do Kanban: o que o admin escolheu, ou o de fábrica. */
export async function nomesDasEtapas(): Promise<NomesEtapas> {
  return mesclarNomesDasEtapas(await lerConfig(CHAVE));
}

/** Renomeia uma coluna. Nome vazio ou igual ao de fábrica volta ao padrão. Duas colunas não podem ter o mesmo nome. */
export async function definirNomeDaEtapa(codigo: string, texto: unknown): Promise<NomesEtapas> {
  if (!etapaValida(codigo)) throw new ErroHttp(400, "Coluna desconhecida.");
  const atuais = await nomesDasEtapas();
  const padrao = nomesPadraoDasEtapas();
  let novo: string = padrao[codigo];
  if (typeof texto === "string" && texto.trim() !== "") {
    const v = validarNomeDaEtapa(texto);
    if (!v.ok) throw new ErroHttp(400, v.erro);
    novo = v.nome;
  }
  const repetido = CODIGOS_ETAPA.find((c: CodigoEtapa) => c !== codigo && atuais[c].toLocaleLowerCase("pt-BR") === novo.toLocaleLowerCase("pt-BR"));
  if (repetido) throw new ErroHttp(400, `Já existe uma coluna chamada "${atuais[repetido]}".`);
  const proximos = { ...atuais, [codigo]: novo };
  // Só guarda o que difere do padrão.
  const diferentes = Object.fromEntries(CODIGOS_ETAPA.filter((c: CodigoEtapa) => proximos[c] !== padrao[c]).map((c: CodigoEtapa) => [c, proximos[c]]));
  await gravarConfig(CHAVE, JSON.stringify(diferentes));
  await marcarMudanca();
  return proximos;
}
