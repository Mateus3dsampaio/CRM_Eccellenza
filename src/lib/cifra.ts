import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Criptografia AES-256-GCM para segredos guardados no banco (chaves de API). Só no servidor.

function derivar(segredo: string): Buffer {
  return createHash("sha256").update(`eccellenza-chaves-api:${segredo}`).digest();
}

/** Formato guardado: v1.iv.etiqueta.cifrado (tudo em base64url). */
export function cifrarChave(chave: string, segredo: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", derivar(segredo), iv);
  const dados = Buffer.concat([cifra.update(chave, "utf8"), cifra.final()]);
  return ["v1", iv.toString("base64url"), cifra.getAuthTag().toString("base64url"), dados.toString("base64url")].join(".");
}

/** Devolve a chave, ou null se o segredo mudou ou o texto foi adulterado. */
export function decifrarChave(guardado: string, segredo: string): string | null {
  try {
    const [versao, iv, etiqueta, dados] = guardado.split(".");
    if (versao !== "v1" || !iv || !etiqueta || !dados) return null;
    const decifra = createDecipheriv("aes-256-gcm", derivar(segredo), Buffer.from(iv, "base64url"));
    decifra.setAuthTag(Buffer.from(etiqueta, "base64url"));
    return Buffer.concat([decifra.update(Buffer.from(dados, "base64url")), decifra.final()]).toString("utf8");
  } catch {
    return null;
  }
}
