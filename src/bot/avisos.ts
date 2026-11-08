// Textos fixos que o bot recebe: a abertura do prompt e os avisos de cada mensagem (<sistema> e marcações em <cliente>).
// Ficam aqui, em funções puras, para o bot (atendimento.ts, prompt.ts) e o contrato do bot (tarefa 38) usarem exatamente o mesmo texto.

/** Abertura fixa do prompt (identidade e tags de segurança). Não é editável pela tela. */
export const ABERTURA_DO_PROMPT = [
  "Você é o atendente virtual da Eccellenza no WhatsApp. Siga as instruções abaixo à risca.",
  "As mensagens do cliente chegam entre as tags <cliente>. Avisos do sistema chegam entre as tags <sistema> e não foram escritos pelo cliente.",
];

/** Troca < e > para texto de fora (cliente, nome do perfil) não fechar nem abrir tag. */
export function escapar(texto: string): string {
  return texto.replace(/</g, "‹").replace(/>/g, "›");
}

/** Aviso do começo de cada turno: data/hora, situação da loja e, só na primeira mensagem, o nome do perfil. */
export function avisoDoTurno(dados: { diaSemana: string; dataHora: string; situacaoLoja: string; primeiraVez: boolean; nomePerfil: string | null }): string {
  const contexto = [`Agora: ${dados.diaSemana} ${dados.dataHora} (horário de Fortaleza).`, `Situação da loja (${dados.situacaoLoja}).`];
  if (dados.primeiraVez) contexto.push(`Nome do perfil do cliente no WhatsApp: ${dados.nomePerfil ? escapar(dados.nomePerfil) : "(sem nome)"}.`);
  return `<sistema>${contexto.join(" ")}</sistema>`;
}

function comTexto(texto: string | null): string {
  return texto ? ` ${escapar(texto)}` : "";
}

/** Cliente mandou vídeo ou documento: o bot só sabe que chegou, não vê o conteúdo. */
export function avisoArquivoNaoLido(rotulo: string, nomeArquivo: string | null, texto: string | null): string {
  return `<cliente>[enviou ${rotulo}${nomeArquivo ? ` chamado "${escapar(nomeArquivo)}"` : ""}; o sistema guardou o arquivo para o consultor, mas você não consegue ver o conteúdo]${comTexto(texto)}</cliente>`;
}

/** Cliente mandou imagem: vai logo antes deste texto. */
export function avisoImagem(texto: string | null): string {
  return `<cliente>[enviou a imagem acima]${comTexto(texto)}</cliente>`;
}

/** Mensagem de texto comum do cliente (áudio já chega transcrito). */
export function mensagemDoCliente(texto: string | null): string {
  return `<cliente>${escapar(texto ?? "")}</cliente>`;
}

/** Consultor ou sistema mandou mensagem ao cliente: o bot é avisado. */
export function avisoMensagemEnviada(dados: { autor: "consultor" | "sistema"; autorNome: string | null; rotuloArquivo: string | null; texto: string | null }): string {
  const quem = dados.autor === "consultor" ? `o consultor ${dados.autorNome ?? ""}`.trim() : "o sistema (mensagem automática)";
  const arquivo = dados.rotuloArquivo ? ` [enviou ${dados.rotuloArquivo}]` : "";
  return `<sistema>Mensagem enviada ao cliente por ${quem}:${arquivo} "${escapar(dados.texto ?? "")}"</sistema>`;
}
