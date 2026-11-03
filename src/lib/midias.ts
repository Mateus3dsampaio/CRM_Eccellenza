import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { TAMANHO_MAXIMO_IMAGEM } from "@/regras/limites";

// Mídias ficam fora da pasta pública (SEG-03) e só são servidas por rota com login.
// No Railway, MIDIAS_DIR aponta para o volume (disco que não some a cada deploy), ex.: /data/midias.
export const PASTA_MIDIAS = process.env.MIDIAS_DIR?.trim() ? path.resolve(process.env.MIDIAS_DIR.trim()) : path.join(process.cwd(), "midias");
export const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const TAMANHO_MAXIMO = TAMANHO_MAXIMO_IMAGEM;

const EXTENSAO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export function tipoImagemValido(tipo: string): tipo is (typeof TIPOS_IMAGEM)[number] {
  return (TIPOS_IMAGEM as readonly string[]).includes(tipo);
}

/** Confere a assinatura do arquivo, para não confiar só no tipo declarado. */
export function conferirAssinatura(dados: Buffer, tipo: string): boolean {
  const h = dados.subarray(0, 12);
  if (tipo === "image/png") return h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47;
  if (tipo === "image/jpeg") return h[0] === 0xff && h[1] === 0xd8;
  if (tipo === "image/gif") return h.subarray(0, 3).toString("ascii") === "GIF";
  if (tipo === "image/webp") return h.subarray(0, 4).toString("ascii") === "RIFF" && h.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function salvarMidia(dados: Buffer, tipo: string): Promise<string> {
  if (!tipoImagemValido(tipo)) throw new Error("Tipo de arquivo não aceito.");
  if (dados.length > TAMANHO_MAXIMO) throw new Error("Arquivo maior que 5 MB.");
  if (!conferirAssinatura(dados, tipo)) throw new Error("O arquivo não é uma imagem válida.");
  await mkdir(PASTA_MIDIAS, { recursive: true });
  const nome = `${randomUUID()}.${EXTENSAO[tipo]}`;
  await writeFile(path.join(PASTA_MIDIAS, nome), dados);
  return nome;
}

function caminhoSeguro(nome: string): string {
  if (!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(nome)) throw new Error("Nome de arquivo inválido.");
  return path.join(PASTA_MIDIAS, nome);
}

export async function lerMidia(nome: string): Promise<Buffer> {
  return readFile(caminhoSeguro(nome));
}

export async function apagarMidia(nome: string): Promise<void> {
  await rm(caminhoSeguro(nome), { force: true });
}
