import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { TAMANHO_MAXIMO_IMAGEM } from "@/regras/limites";
import { extensaoBloqueada, extensaoDoTipo, formatarTamanho, limiteDoTipo, TIPO_GENERICO, tipoCanonico, tipoMidiaAceito } from "@/regras/midia";

// Mídias ficam fora da pasta pública (SEG-03) e só são servidas por rota com login.
// No Railway, MIDIAS_DIR aponta para o volume (disco que não some a cada deploy), ex.: /data/midias.
export const PASTA_MIDIAS = process.env.MIDIAS_DIR?.trim() ? path.resolve(process.env.MIDIAS_DIR.trim()) : path.join(process.cwd(), "midias");
export const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const TAMANHO_MAXIMO = TAMANHO_MAXIMO_IMAGEM;

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
  if (tipo === "application/pdf") return h.subarray(0, 5).toString("ascii") === "%PDF-";
  // Word e Excel novos (docx, xlsx) são ZIP; os antigos (doc, xls) são o formato "OLE" da Microsoft.
  if (tipo.includes("openxmlformats")) return h[0] === 0x50 && h[1] === 0x4b && h[2] === 0x03 && h[3] === 0x04;
  // ZIP: começa com "PK" e a marca de arquivo (03 04), ou de ZIP vazio (05 06).
  if (tipo === "application/zip") return h[0] === 0x50 && h[1] === 0x4b && ((h[2] === 0x03 && h[3] === 0x04) || (h[2] === 0x05 && h[3] === 0x06));
  if (tipo === "application/msword" || tipo === "application/vnd.ms-excel") return h[0] === 0xd0 && h[1] === 0xcf && h[2] === 0x11 && h[3] === 0xe0 && h[4] === 0xa1 && h[5] === 0xb1;
  // DWG começa com a versão do AutoCAD: "AC1015", "AC1032"... (as muito antigas, "AC1.50", "AC2.10", "MC0.0").
  if (tipo === "application/acad") return (h[0] === 0x41 && h[1] === 0x43 && h[2] >= 0x31 && h[2] <= 0x39) || h.subarray(0, 2).toString("ascii") === "MC";
  // MP4 e 3GP começam com uma "caixa" ftyp (tamanho nos 4 primeiros bytes, "ftyp" nos 4 seguintes).
  if (tipo === "video/mp4" || tipo === "video/3gpp") return h.subarray(4, 8).toString("ascii") === "ftyp";
  return false;
}

/** Confere tipo, tamanho e o começo do arquivo. Devolve o motivo da recusa, ou null se está tudo certo. */
export function motivoDeRecusaDaMidia(dados: Buffer, tipo: string, nome?: string | null): string | null {
  const tipoLimpo = tipoCanonico(tipo);
  // Arquivo genérico (qualquer coisa que o cliente mande): não dá para conferir o conteúdo, então o nome não pode ser de programa ou script.
  if (tipoLimpo === TIPO_GENERICO) {
    const bloqueada = extensaoBloqueada(nome);
    if (bloqueada) return `Arquivos .${bloqueada} são bloqueados por segurança.`;
    if (dados.length === 0) return "O arquivo está vazio.";
    if (dados.length > limiteDoTipo(tipoLimpo)) return `Arquivo maior que ${formatarTamanho(limiteDoTipo(tipoLimpo))}.`;
    return null;
  }
  if (!tipoMidiaAceito(tipoLimpo) || !extensaoDoTipo(tipoLimpo)) return "Tipo de arquivo não aceito. Use imagem, vídeo (MP4), PDF, Word, Excel, DWG ou ZIP.";
  if (dados.length === 0) return "O arquivo está vazio.";
  if (dados.length > limiteDoTipo(tipoLimpo)) return `Arquivo maior que ${formatarTamanho(limiteDoTipo(tipoLimpo))}.`;
  if (!conferirAssinatura(dados, tipoLimpo)) return "O arquivo não parece ser do tipo informado.";
  return null;
}

/** Guarda imagem, vídeo ou documento (confere tipo, tamanho e o começo do arquivo). Devolve o nome com que foi guardado. */
export async function salvarMidia(dados: Buffer, tipo: string, nomeOriginal?: string | null): Promise<string> {
  const motivo = motivoDeRecusaDaMidia(dados, tipo, nomeOriginal);
  if (motivo) throw new Error(motivo);
  const extensao = extensaoDoTipo(tipoCanonico(tipo))!;
  await mkdir(PASTA_MIDIAS, { recursive: true });
  const nome = `${randomUUID()}.${extensao}`;
  await writeFile(path.join(PASTA_MIDIAS, nome), dados);
  return nome;
}

function caminhoSeguro(nome: string): string {
  if (!/^[a-f0-9-]+\.(jpg|png|webp|gif|mp4|3gp|pdf|doc|docx|xls|xlsx|dwg|zip|bin)$/.test(nome)) throw new Error("Nome de arquivo inválido.");
  return path.join(PASTA_MIDIAS, nome);
}

export async function lerMidia(nome: string): Promise<Buffer> {
  return readFile(caminhoSeguro(nome));
}

export async function apagarMidia(nome: string): Promise<void> {
  await rm(caminhoSeguro(nome), { force: true });
}

/** Tamanho em bytes do arquivo guardado, ou null se não existir. */
export async function tamanhoDaMidia(nome: string): Promise<number | null> {
  try {
    return (await stat(caminhoSeguro(nome))).size;
  } catch {
    return null;
  }
}

/** Nomes dos arquivos da pasta que foram gravados antes de `antesDe` (para achar arquivos soltos, sem mensagem). */
export async function listarMidiasAntigasDaPasta(antesDe: Date): Promise<string[]> {
  let nomes: string[] = [];
  try {
    nomes = await readdir(PASTA_MIDIAS);
  } catch {
    return [];
  }
  const saida: string[] = [];
  for (const nome of nomes) {
    if (!/^[a-f0-9-]+\.(jpg|png|webp|gif|mp4|3gp|pdf|doc|docx|xls|xlsx|dwg|zip|bin)$/.test(nome)) continue; // só o que o sistema mesmo grava
    try {
      if ((await stat(path.join(PASTA_MIDIAS, nome))).mtime < antesDe) saida.push(nome);
    } catch {
      // sumiu no meio da conta
    }
  }
  return saida;
}

/** Quantos arquivos e quantos bytes a pasta de mídias ocupa agora (para o indicador de armazenamento). */
export async function tamanhoDaPasta(): Promise<{ arquivos: number; bytes: number }> {
  let nomes: string[] = [];
  try {
    nomes = await readdir(PASTA_MIDIAS);
  } catch {
    return { arquivos: 0, bytes: 0 };
  }
  let bytes = 0;
  let arquivos = 0;
  for (const nome of nomes) {
    try {
      const e = await stat(path.join(PASTA_MIDIAS, nome));
      if (e.isFile()) {
        arquivos++;
        bytes += e.size;
      }
    } catch {
      // arquivo sumiu no meio da conta: ignora
    }
  }
  return { arquivos, bytes };
}
