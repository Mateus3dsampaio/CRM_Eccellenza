import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { marcarMudanca } from "@/lib/versao";
import { ErroHttp } from "@/lib/sessao";

const PASTA_INICIAL = path.join(process.cwd(), "agente", "instrucoes");

/** "01. PAPEL E TOM" → "Papel e tom". Usado só para dar título às instruções da carga inicial. */
export function tituloDaPrimeiraLinha(texto: string, padrao: string): string {
  const linha = texto.split(/\r?\n/, 1)[0]?.replace(/^\s*\d+\s*[.)-]\s*/, "").trim();
  if (!linha) return padrao;
  const minusculo = linha.toLocaleLowerCase("pt-BR");
  return minusculo.charAt(0).toLocaleUpperCase("pt-BR") + minusculo.slice(1);
}

let carga: Promise<void> | null = null;

/** Na primeira vez (tabela vazia) carrega as 13 instruções de agente/instrucoes/. Depois o banco é a fonte. */
export function garantirInstrucoes(): Promise<void> {
  // Chamadas simultâneas esperam a mesma carga (evita "banco ocupado" no SQLite).
  carga ??= carregarInicial().finally(() => {
    carga = null;
  });
  return carga;
}

async function carregarInicial(): Promise<void> {
  if ((await db.instrucao.count()) > 0) return;
  const arquivos = (await readdir(PASTA_INICIAL)).filter((a) => a.endsWith(".txt")).sort();
  const agora = new Date();
  const dados = await Promise.all(
    arquivos.map(async (arquivo, i) => {
      const texto = (await readFile(path.join(PASTA_INICIAL, arquivo), "utf8")).trim();
      return { titulo: tituloDaPrimeiraLinha(texto, arquivo.replace(/\.txt$/, "")), texto, ordem: i + 1, criadoEm: agora, atualizadoEm: agora };
    }),
  );
  await db.instrucao.createMany({ data: dados });
}

export async function listarInstrucoes() {
  await garantirInstrucoes();
  return db.instrucao.findMany({ orderBy: { ordem: "asc" } });
}

/** Instruções ativas, em ordem: é o que entra no prompt do bot. */
export async function instrucoesAtivas(): Promise<string[]> {
  await garantirInstrucoes();
  const lista = await db.instrucao.findMany({ where: { ativa: true }, orderBy: { ordem: "asc" }, select: { texto: true } });
  return lista.map((i) => i.texto.trim()).filter(Boolean);
}

export interface DadosInstrucao {
  titulo: string;
  texto: string;
  ativa?: boolean;
}

export async function criarInstrucao(dados: DadosInstrucao) {
  await garantirInstrucoes();
  const ultima = await db.instrucao.findFirst({ orderBy: { ordem: "desc" }, select: { ordem: true } });
  const criada = await db.instrucao.create({
    data: { titulo: dados.titulo.trim(), texto: dados.texto.trim(), ativa: dados.ativa ?? true, ordem: (ultima?.ordem ?? 0) + 1 },
  });
  await marcarMudanca();
  return criada;
}

/**
 * Edita a instrução. Quando o texto muda, a versão atual (título e texto) vira a "anterior" e a anterior mais velha é descartada.
 * Mudar só o título, ligar/desligar não mexem na versão anterior. Não deixa desativar a última ativa (o bot ficaria sem instruções).
 */
export async function editarInstrucao(id: string, dados: Partial<DadosInstrucao>) {
  const atualizada = await db.$transaction(async (tx) => {
    const atual = await tx.instrucao.findUnique({ where: { id } });
    if (!atual) throw new ErroHttp(404, "Instrução não encontrada.");
    if (dados.ativa === false && atual.ativa && (await tx.instrucao.count({ where: { ativa: true } })) <= 1) {
      throw new ErroHttp(409, "Mantenha ao menos uma instrução ativa: sem elas o bot atende sem roteiro.");
    }
    const titulo = dados.titulo?.trim() ?? atual.titulo;
    const texto = dados.texto?.trim() ?? atual.texto;
    const mudouTexto = texto !== atual.texto;
    const mudouConteudo = mudouTexto || titulo !== atual.titulo;
    return tx.instrucao.update({
      where: { id },
      data: {
        titulo,
        texto,
        ativa: dados.ativa ?? atual.ativa,
        ...(mudouConteudo ? { atualizadoEm: new Date() } : {}),
        ...(mudouTexto ? { anteriorTitulo: atual.titulo, anteriorTexto: atual.texto, anteriorEm: new Date() } : {}),
      },
    });
  });
  await marcarMudanca();
  return atualizada;
}

/** Troca a versão atual pela anterior; a atual passa a ser a "anterior" (dá para desfazer o desfazer). */
export async function voltarParaAnterior(id: string) {
  const voltou = await db.$transaction(async (tx) => {
    const atual = await tx.instrucao.findUnique({ where: { id } });
    if (!atual) throw new ErroHttp(404, "Instrução não encontrada.");
    if (atual.anteriorTexto === null || atual.anteriorTitulo === null) throw new ErroHttp(409, "Esta instrução não tem versão anterior.");
    return tx.instrucao.update({
      where: { id },
      data: {
        titulo: atual.anteriorTitulo,
        texto: atual.anteriorTexto,
        anteriorTitulo: atual.titulo,
        anteriorTexto: atual.texto,
        anteriorEm: new Date(),
        atualizadoEm: new Date(),
      },
    });
  });
  await marcarMudanca();
  return voltou;
}

export async function reordenarInstrucoes(ids: string[]) {
  const existentes = await db.instrucao.findMany({ select: { id: true } });
  const conhecidos = new Set(existentes.map((e) => e.id));
  if (ids.length !== conhecidos.size || new Set(ids).size !== ids.length || ids.some((i) => !conhecidos.has(i))) {
    throw new ErroHttp(400, "A lista de instruções mudou. Recarregue a tela e tente de novo.");
  }
  await db.$transaction(ids.map((id, i) => db.instrucao.update({ where: { id }, data: { ordem: i + 1 } })));
  await marcarMudanca();
}

/** Exclui de vez (sem versão anterior para recuperar). Não deixa apagar a última ativa e reorganiza a ordem. */
export async function excluirInstrucao(id: string) {
  await db.$transaction(async (tx) => {
    const alvo = await tx.instrucao.findUnique({ where: { id } });
    if (!alvo) throw new ErroHttp(404, "Instrução não encontrada.");
    if (alvo.ativa && (await tx.instrucao.count({ where: { ativa: true } })) <= 1) {
      throw new ErroHttp(409, "Mantenha ao menos uma instrução ativa: sem elas o bot atende sem roteiro.");
    }
    await tx.instrucao.delete({ where: { id } });
    const restantes = await tx.instrucao.findMany({ orderBy: { ordem: "asc" }, select: { id: true } });
    for (const [i, r] of restantes.entries()) await tx.instrucao.update({ where: { id: r.id }, data: { ordem: i + 1 } });
  });
  await marcarMudanca();
}

function nomeArquivo(ordem: number, titulo: string): string {
  const slug = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${String(ordem).padStart(2, "0")}-${slug || "instrucao"}.txt`;
}

/** Exporta as instruções escolhidas (ou todas) como um texto único ou como arquivos separados (para o zip). */
export async function paraExportar(ids: string[] | null) {
  const lista = await listarInstrucoes();
  const escolhidas = ids ? lista.filter((i) => ids.includes(i.id)) : lista;
  if (escolhidas.length === 0) throw new ErroHttp(400, "Selecione ao menos uma instrução para exportar.");
  return {
    texto: escolhidas.map((i) => i.texto.trim()).join("\n\n"),
    arquivos: escolhidas.map((i, n) => ({ nome: nomeArquivo(n + 1, i.titulo), conteudo: i.texto.trim() + "\n" })),
  };
}
