import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function gerarHashSenha(senha: string): string {
  const sal = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, sal, 64).toString("hex");
  return `${sal}:${hash}`;
}

export function conferirSenha(senha: string, guardado: string): boolean {
  const [sal, hash] = guardado.split(":");
  if (!sal || !hash) return false;
  const calculado = scryptSync(senha, sal, 64);
  const esperado = Buffer.from(hash, "hex");
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}
