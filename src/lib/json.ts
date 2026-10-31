export function lerLista(valor: string | null | undefined): string[] {
  if (!valor) return [];
  try {
    const lista = JSON.parse(valor);
    return Array.isArray(lista) ? lista.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function gravarLista(lista: string[]): string {
  return JSON.stringify(Array.from(new Set(lista.map((item) => item.trim()).filter(Boolean))));
}
