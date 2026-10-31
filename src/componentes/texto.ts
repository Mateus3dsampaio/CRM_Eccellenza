// "terça-feira, 03 de novembro" → "Terça-feira, 03 de novembro" (sem pôr maiúscula em toda palavra).
export function primeiraMaiuscula(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto;
}
