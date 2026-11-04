import { db } from "@/lib/db";
import { marcarMudanca } from "@/lib/versao";
import { ErroHttp } from "@/lib/sessao";
import { MANUAL_INICIAL } from "@/bot/manual-inicial";

// Instruções do bot (decisão do Mateus 04/11/2026): o projeto não traz roteiro nenhum. As instruções numeradas ("roteiro")
// são coladas pelo admin na tela, a partir do repositório de instruções dele. O Manual do CRM ("manual") é uma instrução
// fixa, fora da numeração, que ensina o bot a usar as ferramentas; é o único texto que o CRM grava sozinho, uma vez.
const ROTEIRO = "roteiro";
const MANUAL = "manual";
export const TITULO_MANUAL = "Manual do CRM";

// Bancos que vieram da carga antiga (instruções 01 a 15 copiadas dos arquivos): a 15 vira o manual e a 14 sai.
const ANTIGA_15 = /^\s*15\s*\.\s*REGRAS DO CRM/i;
const ANTIGA_14 = /^\s*14\s*\.\s*DADOS DA LOJA/i;

let preparo: Promise<void> | null = null;

/** Garante que o Manual do CRM existe (cria ou converte a antiga instrução 15, uma vez só). */
export function garantirManual(): Promise<void> {
  // Chamadas simultâneas esperam o mesmo preparo (evita "banco ocupado" no SQLite e manual duplicado).
  preparo ??= prepararManual().finally(() => {
    preparo = null;
  });
  return preparo;
}

async function prepararManual(): Promise<void> {
  if (await db.instrucao.count({ where: { tipo: MANUAL } })) return;
  const agora = new Date();
  await db.$transaction(async (tx) => {
    const roteiro = await tx.instrucao.findMany({ where: { tipo: ROTEIRO }, orderBy: { ordem: "asc" } });
    const antiga15 = roteiro.find((i) => ANTIGA_15.test(i.texto));
    const antiga14 = roteiro.find((i) => ANTIGA_14.test(i.texto));
    if (antiga15) {
      // O texto antigo fica como "anterior", para dar para conferir ou voltar.
      await tx.instrucao.update({
        where: { id: antiga15.id },
        data: { tipo: MANUAL, ordem: 0, ativa: true, titulo: TITULO_MANUAL, texto: MANUAL_INICIAL, anteriorTitulo: antiga15.titulo, anteriorTexto: antiga15.texto, anteriorEm: agora, atualizadoEm: agora },
      });
    } else {
      await tx.instrucao.create({ data: { tipo: MANUAL, ordem: 0, titulo: TITULO_MANUAL, texto: MANUAL_INICIAL, criadoEm: agora, atualizadoEm: agora } });
    }
    if (antiga14) await tx.instrucao.delete({ where: { id: antiga14.id } });
    if (antiga15 || antiga14) {
      const restantes = roteiro.filter((i) => i.id !== antiga15?.id && i.id !== antiga14?.id);
      for (const [n, r] of restantes.entries()) await tx.instrucao.update({ where: { id: r.id }, data: { ordem: n + 1 } });
    }
  });
}

/** Instruções numeradas (roteiro), em ordem. O manual não entra. */
export async function listarInstrucoes() {
  await garantirManual();
  return db.instrucao.findMany({ where: { tipo: ROTEIRO }, orderBy: { ordem: "asc" } });
}

export async function obterManual() {
  await garantirManual();
  return db.instrucao.findFirstOrThrow({ where: { tipo: MANUAL } });
}

/** Instruções numeradas ativas, em ordem: o roteiro que entra no prompt do bot. Vazio = o bot não atende. */
export async function instrucoesAtivas(): Promise<string[]> {
  await garantirManual();
  const lista = await db.instrucao.findMany({ where: { tipo: ROTEIRO, ativa: true }, orderBy: { ordem: "asc" }, select: { texto: true } });
  return lista.map((i) => i.texto.trim()).filter(Boolean);
}

/** Texto do Manual do CRM (vai no prompt depois do roteiro). */
export async function textoDoManual(): Promise<string> {
  return (await obterManual()).texto.trim();
}

export interface DadosInstrucao {
  titulo: string;
  texto: string;
  ativa?: boolean;
}

export async function criarInstrucao(dados: DadosInstrucao) {
  await garantirManual();
  const ultima = await db.instrucao.findFirst({ where: { tipo: ROTEIRO }, orderBy: { ordem: "desc" }, select: { ordem: true } });
  const criada = await db.instrucao.create({
    data: { tipo: ROTEIRO, titulo: dados.titulo.trim(), texto: dados.texto.trim(), ativa: dados.ativa ?? true, ordem: (ultima?.ordem ?? 0) + 1 },
  });
  await marcarMudanca();
  return criada;
}

/**
 * Edita a instrução. Quando o texto muda, a versão atual (título e texto) vira a "anterior" e a anterior mais velha é descartada.
 * Mudar só o título, ligar/desligar não mexem na versão anterior. Não deixa desativar a última ativa (o bot ficaria sem instruções).
 * O manual só tem o texto editável: título fixo e sempre ativo (sem ele o bot não preenche a ficha).
 */
export async function editarInstrucao(id: string, dados: Partial<DadosInstrucao>) {
  const atualizada = await db.$transaction(async (tx) => {
    const atual = await tx.instrucao.findUnique({ where: { id } });
    if (!atual) throw new ErroHttp(404, "Instrução não encontrada.");
    const manual = atual.tipo === MANUAL;
    if (manual && dados.ativa === false) throw new ErroHttp(409, "O Manual do CRM não pode ser desativado: sem ele o bot não preenche a ficha do cliente.");
    if (!manual && dados.ativa === false && atual.ativa && (await tx.instrucao.count({ where: { tipo: ROTEIRO, ativa: true } })) <= 1) {
      throw new ErroHttp(409, "Mantenha ao menos uma instrução ativa: sem elas o bot não atende e passa todo cliente direto ao consultor.");
    }
    const titulo = manual ? atual.titulo : (dados.titulo?.trim() ?? atual.titulo);
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
        // O manual mantém o título fixo (a versão anterior pode ser a antiga instrução 15).
        titulo: atual.tipo === MANUAL ? atual.titulo : atual.anteriorTitulo,
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
  const existentes = await db.instrucao.findMany({ where: { tipo: ROTEIRO }, select: { id: true } });
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
    if (alvo.tipo === MANUAL) throw new ErroHttp(409, "O Manual do CRM não pode ser excluído: sem ele o bot não preenche a ficha do cliente.");
    if (alvo.ativa && (await tx.instrucao.count({ where: { tipo: ROTEIRO, ativa: true } })) <= 1) {
      throw new ErroHttp(409, "Mantenha ao menos uma instrução ativa: sem elas o bot não atende e passa todo cliente direto ao consultor.");
    }
    await tx.instrucao.delete({ where: { id } });
    const restantes = await tx.instrucao.findMany({ where: { tipo: ROTEIRO }, orderBy: { ordem: "asc" }, select: { id: true } });
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

/** Exporta as instruções escolhidas (ou todas, com o manual) como um texto único ou como arquivos separados (para o zip). O manual vai por último. */
export async function paraExportar(ids: string[] | null) {
  const lista = await listarInstrucoes();
  const manual = await obterManual();
  const escolhidas = ids ? lista.filter((i) => ids.includes(i.id)) : lista;
  const comManual = ids === null || ids.includes(manual.id);
  if (escolhidas.length === 0 && !comManual) throw new ErroHttp(400, "Selecione ao menos uma instrução para exportar.");
  const arquivos = escolhidas.map((i, n) => ({ nome: nomeArquivo(n + 1, i.titulo), conteudo: i.texto.trim() + "\n" }));
  const textos = escolhidas.map((i) => i.texto.trim());
  if (comManual) {
    arquivos.push({ nome: "manual-do-crm.txt", conteudo: manual.texto.trim() + "\n" });
    textos.push(manual.texto.trim());
  }
  return { texto: textos.join("\n\n"), arquivos };
}
