// Importar instruções de arquivos .txt (decisão do Mateus 06/11/2026): o título vem da primeira linha do arquivo
// ("02. ROTEIRO DE QUALIFICAÇÃO" → "Roteiro de qualificação") e o número do começo do texto (ou do nome do arquivo).
// Regra pura: roda na tela (prévia) e no servidor (gravação), sempre com o mesmo resultado.

export const TEXTO_MAX = 20000;
export const TITULO_MAX = 120;
export const ARQUIVOS_MAX = 50;

const NUMERO_NO_TEXTO = /^\s*(\d{1,3})\s*[.)\-–]\s*(\S.*)$/;

export interface ArquivoBruto {
  nome: string;
  texto: string;
}

export interface InstrucaoLida {
  nome: string;
  numero: number | null;
  titulo: string;
  texto: string;
  erro: string | null;
}

/** Tira o BOM, troca as quebras de linha do Windows e apara as pontas. */
export function limparTexto(bruto: string): string {
  return bruto.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
}

/** Número da instrução no começo do texto ("02. ROTEIRO..." → 2). */
export function numeroDoTexto(texto: string): number | null {
  const primeira = limparTexto(texto).split("\n")[0] ?? "";
  const m = NUMERO_NO_TEXTO.exec(primeira);
  return m ? Number(m[1]) : null;
}

function numeroDoNome(nome: string): number | null {
  const m = /^(\d{1,3})[\s._-]/.exec(nome);
  return m ? Number(m[1]) : null;
}

/** "ROTEIRO DE QUALIFICAÇÃO" (tudo maiúsculo) vira "Roteiro de qualificação"; título já escrito normalmente fica como está. */
function suavizarCaixa(titulo: string): string {
  const temLetra = /\p{L}/u.test(titulo);
  if (!temLetra || titulo !== titulo.toLocaleUpperCase("pt-BR")) return titulo;
  const minusculo = titulo.toLocaleLowerCase("pt-BR");
  return minusculo.charAt(0).toLocaleUpperCase("pt-BR") + minusculo.slice(1);
}

function tituloDoNome(nome: string): string {
  const base = nome.replace(/\.[^.]+$/, "").replace(/^\d{1,3}[\s._-]+/, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toLocaleUpperCase("pt-BR") + base.slice(1) : "";
}

export function lerInstrucao({ nome, texto: bruto }: ArquivoBruto): InstrucaoLida {
  const texto = limparTexto(bruto);
  const falha = (erro: string): InstrucaoLida => ({ nome, numero: numeroDoNome(nome), titulo: tituloDoNome(nome), texto, erro });
  if (bruto.includes("�")) return falha("O arquivo não está em UTF-8 (letras com acento ficaram quebradas). Salve como UTF-8 e tente de novo.");
  if (!texto) return falha("O arquivo está vazio.");
  if (texto.length > TEXTO_MAX) return falha(`O texto passa de ${TEXTO_MAX} letras.`);
  const primeira = texto.split("\n")[0].trim();
  const m = NUMERO_NO_TEXTO.exec(primeira);
  const numero = m ? Number(m[1]) : numeroDoNome(nome);
  const bruta = (m ? m[2] : primeira).trim();
  const titulo = suavizarCaixa(bruta.length <= TITULO_MAX ? bruta : tituloDoNome(nome) || bruta.slice(0, TITULO_MAX)).slice(0, TITULO_MAX);
  return { nome, numero, titulo, texto, erro: null };
}

export type AcaoImportacao = "atualizar" | "nova" | "igual" | "erro";

export interface ItemDoPlano {
  lida: InstrucaoLida;
  acao: AcaoImportacao;
  /** Instrução que será atualizada. */
  existenteId: string | null;
  /** Título atual da instrução que será atualizada (para a prévia). */
  tituloAtual: string | null;
}

/**
 * Decide o que fazer com cada arquivo: atualizar a instrução de mesmo número (ou, sem número, de mesmo título), criar uma nova,
 * ignorar se o texto é idêntico ou recusar (erro). Dois arquivos para a mesma instrução: o segundo vira erro.
 * O resultado sai em ordem de número (sem número, por último).
 */
export function planejarImportacao(arquivos: ArquivoBruto[], existentes: { id: string; titulo: string; texto: string }[]): ItemDoPlano[] {
  const usados = new Set<string>();
  const vistos = new Set<string>();
  const itens = arquivos.map((a): ItemDoPlano => {
    const lida = lerInstrucao(a);
    if (lida.erro) return { lida, acao: "erro", existenteId: null, tituloAtual: null };
    const chave = lida.numero !== null ? `n${lida.numero}` : `t${lida.titulo.toLowerCase()}`;
    if (vistos.has(chave)) return { lida: { ...lida, erro: "Há dois arquivos para a mesma instrução." }, acao: "erro", existenteId: null, tituloAtual: null };
    vistos.add(chave);
    const existente = existentes.find((e) => !usados.has(e.id) && (lida.numero !== null ? numeroDoTexto(e.texto) === lida.numero : e.titulo.trim().toLowerCase() === lida.titulo.toLowerCase()));
    if (!existente) return { lida, acao: "nova", existenteId: null, tituloAtual: null };
    usados.add(existente.id);
    const igual = limparTexto(existente.texto) === lida.texto && existente.titulo.trim() === lida.titulo;
    return { lida, acao: igual ? "igual" : "atualizar", existenteId: existente.id, tituloAtual: existente.titulo };
  });
  return itens.sort((a, b) => (a.lida.numero ?? 9999) - (b.lida.numero ?? 9999));
}
