// Arquivos que o CRM guarda e troca com o cliente: imagem, vídeo e PDF (regras puras, sem banco nem disco).

export type FamiliaMidia = "imagem" | "video" | "documento";

export const TIPOS_MIDIA: Record<string, { extensao: string; familia: FamiliaMidia }> = {
  "image/jpeg": { extensao: "jpg", familia: "imagem" },
  "image/png": { extensao: "png", familia: "imagem" },
  "image/webp": { extensao: "webp", familia: "imagem" },
  "image/gif": { extensao: "gif", familia: "imagem" },
  "video/mp4": { extensao: "mp4", familia: "video" },
  "video/3gpp": { extensao: "3gp", familia: "video" },
  "application/pdf": { extensao: "pdf", familia: "documento" },
  "application/msword": { extensao: "doc", familia: "documento" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extensao: "docx", familia: "documento" },
  "application/vnd.ms-excel": { extensao: "xls", familia: "documento" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { extensao: "xlsx", familia: "documento" },
  // DWG não tem um tipo único: o navegador e a Meta mandam vazio, "octet-stream" ou nomes diferentes. Este é o nome interno do sistema.
  "application/acad": { extensao: "dwg", familia: "documento" },
  "application/zip": { extensao: "zip", familia: "documento" },
};

// Nomes diferentes para o mesmo tipo (o Windows informa "x-zip-compressed" para ZIP).
const APELIDOS: Record<string, string> = { "application/x-zip-compressed": "application/zip", "application/x-zip": "application/zip" };

/** Nome curto de cada tipo, para mostrar na tela (galeria, conversa). */
export const ROTULO_TIPO: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/acad": "DWG",
  "application/zip": "ZIP",
};

// Extensões de documento que valem mesmo quando o navegador ou a Meta não informam (ou informam um tipo genérico) o tipo certo.
const EXTENSOES_DE_DOCUMENTO = ["pdf", "doc", "docx", "xls", "xlsx", "dwg", "zip"];

// Tamanho máximo por arquivo. PROVISÓRIO: o de imagem é o que já existia (5 MB); para vídeo e documento coloquei um teto
// seguro para o disco. Os limites da própria Meta para vídeo e documento NÃO foram conferidos.
export const LIMITES_BYTES: Record<FamiliaMidia, number> = { imagem: 5 * 1024 * 1024, video: 16 * 1024 * 1024, documento: 25 * 1024 * 1024 };

/** Teto de bytes de arquivos dentro de uma exportação (.zip montado na memória do servidor). */
export const LIMITE_EXPORTACAO_BYTES = 200 * 1024 * 1024;

/** Apagar mídia automaticamente depois de tantos dias (decisão do Mateus, 04/11/2026). */
export const DIAS_MIDIA_ATE_APAGAR = 180;

/**
 * O que o vendedor pode ENVIAR (menos que o que dá para receber): a Meta aceita só JPEG e PNG como imagem e MP4 como vídeo,
 * e PDF, Word e Excel como documento (conforme conheço; não conferi na página oficial). DWG e ZIP: NÃO tenho certeza de que a Meta aceite;
 * se recusar, a mensagem fica "falhou". WEBP, GIF e 3GP o cliente pode mandar, mas a loja não envia.
 */
export const TIPOS_ENVIO = [
  "image/jpeg",
  "image/png",
  "video/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/acad",
  "application/zip",
] as const;
// Para o seletor de arquivo do navegador: os tipos e as extensões (o navegador não conhece o tipo do DWG).
export const ACEITO_NO_ANEXO = [...TIPOS_ENVIO.filter((t) => t !== "application/acad"), ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".dwg", ".zip"].join(",");
export function tipoPodeEnviar(tipo: string): boolean {
  return (TIPOS_ENVIO as readonly string[]).includes(limpo(tipo));
}
/** Tamanho do corpo do envio acima do qual nem se lê o pedido (maior arquivo permitido mais uma folga). */
export const LIMITE_CORPO_ANEXO = Math.max(...Object.values(LIMITES_BYTES)) + 1024 * 1024;

const limpo = (tipo: string) => {
  const t = tipo.split(";")[0].trim().toLowerCase();
  return APELIDOS[t] ?? t;
};

/** Tipo sem parâmetros e com apelidos trocados pelo nome do sistema (ex.: "x-zip-compressed" vira "zip"). */
export function tipoCanonico(tipo: string): string {
  return limpo(tipo);
}

export function tipoMidiaAceito(tipo: string): boolean {
  return limpo(tipo) in TIPOS_MIDIA;
}

export function familiaDoTipo(tipo: string): FamiliaMidia | null {
  return TIPOS_MIDIA[limpo(tipo)]?.familia ?? null;
}

export function extensaoDoTipo(tipo: string): string | null {
  return TIPOS_MIDIA[limpo(tipo)]?.extensao ?? null;
}

export function tipoDaExtensao(extensao: string): string | null {
  return Object.entries(TIPOS_MIDIA).find(([, v]) => v.extensao === extensao.toLowerCase())?.[0] ?? null;
}

export function limiteDoTipo(tipo: string): number {
  const familia = familiaDoTipo(tipo);
  return familia ? LIMITES_BYTES[familia] : 0;
}

export const ROTULO_FAMILIA: Record<FamiliaMidia, string> = { imagem: "Imagem", video: "Vídeo", documento: "Documento" };

/** Nome do tipo para a tela: "PDF", "Word", "Excel", "DWG", "Imagem" ou "Vídeo". */
export function rotuloDoTipo(tipo: string): string {
  const t = limpo(tipo);
  return ROTULO_TIPO[t] ?? (familiaDoTipo(t) ? ROTULO_FAMILIA[familiaDoTipo(t)!] : "Arquivo");
}

/** "um PDF", "uma planilha Excel"... para frases (avisos ao bot, exportações). */
export function descricaoDoTipo(tipo: string): string {
  const t = limpo(tipo);
  const f = familiaDoTipo(t);
  if (f === "imagem") return "uma imagem";
  if (f === "video") return "um vídeo";
  const r = ROTULO_TIPO[t];
  return r === "Excel" ? "uma planilha Excel" : r === "Word" ? "um documento Word" : r === "DWG" ? "um arquivo DWG" : r === "ZIP" ? "um arquivo ZIP" : r === "PDF" ? "um PDF" : "um arquivo";
}

/**
 * Descobre o tipo de um arquivo. Usa o tipo informado se o sistema o conhece; senão (vazio, "octet-stream", nome estranho)
 * usa a extensão do nome, mas só para documentos (PDF, Word, Excel, DWG). Depois o conteúdo ainda é conferido ao guardar.
 */
export function tipoDoArquivo(nome: string | null | undefined, tipoInformado: string | null | undefined): string | null {
  const t = limpo(tipoInformado ?? "");
  const extensao = (nome ?? "").split(".").pop()?.toLowerCase() ?? "";
  const pelaExtensao = EXTENSOES_DE_DOCUMENTO.includes(extensao) ? tipoDaExtensao(extensao) : null;
  // Word e Excel novos são ZIP por dentro: se vier "zip" mas o nome diz .docx/.xlsx, vale o nome.
  if (t === "application/zip" && pelaExtensao && pelaExtensao !== t) return pelaExtensao;
  if (t in TIPOS_MIDIA) return t;
  return pelaExtensao;
}

/** Texto curto para a prévia do card e dos avisos quando a mensagem é só um arquivo. */
export function previaDaMidia(tipo: string | null | undefined): string {
  const f = tipo ? familiaDoTipo(tipo) : null;
  return f === "video" ? "🎥 Vídeo" : f === "documento" && tipo ? `📄 ${rotuloDoTipo(tipo)}` : "📷 Imagem";
}

/** Nome de arquivo para mostrar e para baixar: sem pastas, sem caracteres de controle, tamanho limitado. */
export function nomeSeguroDeArquivo(nome: string | null | undefined, padrao = "arquivo"): string {
  const base = (nome ?? "").split(/[\\/]/).pop() ?? "";
  const limpoNome = base.replace(/[\u0000-\u001f\u007f"<>:*?|]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
  return limpoNome && limpoNome !== "." && limpoNome !== ".." ? limpoNome : padrao;
}

/**
 * Cabeçalho Range (vídeo precisa dele para avançar e voltar). Devolve o trecho [inicio, fim] ou null se não for válido.
 * Só aceita um intervalo simples ("bytes=0-99", "bytes=100-", "bytes=-50").
 */
export function intervaloDeBytes(cabecalho: string | null, tamanho: number): { inicio: number; fim: number } | null {
  if (!cabecalho || tamanho <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecalho.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let inicio: number;
  let fim: number;
  if (m[1] === "") {
    const ultimos = Number(m[2]);
    if (ultimos <= 0) return null;
    inicio = Math.max(0, tamanho - ultimos);
    fim = tamanho - 1;
  } else {
    inicio = Number(m[1]);
    fim = m[2] === "" ? tamanho - 1 : Math.min(Number(m[2]), tamanho - 1);
  }
  return inicio <= fim && inicio < tamanho ? { inicio, fim } : null;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`.replace(".", ",");
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`.replace(".", ",");
}
