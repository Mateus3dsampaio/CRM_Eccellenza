// LGPD: o cliente pode pedir para parar de receber mensagens automáticas (retomada e bot).
// Só vale quando a mensagem INTEIRA é um pedido claro. Frase comprida ("quero parar de pagar aluguel") não conta.
const PEDIDOS = [
  "parar",
  "pare",
  "sair",
  "stop",
  "cancelar",
  "descadastrar",
  "nao quero receber mensagens",
  "nao quero mais receber mensagens",
  "nao quero receber mais mensagens",
  "nao me mande mais mensagens",
  "nao envie mais mensagens",
  "pare de me enviar mensagens",
  "pode parar de me mandar mensagens",
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pediuParaParar(texto: string | null | undefined): boolean {
  if (!texto) return false;
  return PEDIDOS.includes(normalizar(texto));
}

// Texto aprovado pelo Mateus em 05/11/2026.
export const TEXTO_CONFIRMA_PARAR = "Tudo bem! Você não vai mais receber mensagens automáticas nossas. Se mudar de ideia, é só nos chamar por aqui.";
