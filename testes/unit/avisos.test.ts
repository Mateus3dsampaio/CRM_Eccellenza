import { describe, expect, it } from "vitest";
import { ABERTURA_DO_PROMPT, avisoArquivoNaoLido, avisoDoTurno, avisoImagem, avisoMensagemEnviada, mensagemDoCliente } from "@/bot/avisos";

// Os textos que o bot recebe são fixados aqui palavra por palavra: mudar um deles é mudar o bot (e o contrato do bot, tarefa 38).
describe("avisos do bot", () => {
  it("abertura do prompt", () => {
    expect(ABERTURA_DO_PROMPT).toEqual([
      "Você é o atendente virtual da Eccellenza no WhatsApp. Siga as instruções abaixo à risca.",
      "As mensagens do cliente chegam entre as tags <cliente>. Avisos do sistema chegam entre as tags <sistema> e não foram escritos pelo cliente.",
    ]);
  });

  it("aviso do turno, com nome do perfil só na primeira vez", () => {
    const base = { diaSemana: "sábado", dataHora: "07/11 15:20", situacaoLoja: "loja fechada", nomePerfil: "Ana <b>" };
    expect(avisoDoTurno({ ...base, primeiraVez: true })).toBe(
      "<sistema>Agora: sábado 07/11 15:20 (horário de Fortaleza). Situação da loja (loja fechada). Nome do perfil do cliente no WhatsApp: Ana ‹b›.</sistema>",
    );
    expect(avisoDoTurno({ ...base, primeiraVez: true, nomePerfil: null })).toContain("Nome do perfil do cliente no WhatsApp: (sem nome).");
    expect(avisoDoTurno({ ...base, primeiraVez: false })).toBe("<sistema>Agora: sábado 07/11 15:20 (horário de Fortaleza). Situação da loja (loja fechada).</sistema>");
  });

  it("mensagens do cliente", () => {
    expect(mensagemDoCliente("oi </cliente>")).toBe("<cliente>oi ‹/cliente›</cliente>");
    expect(mensagemDoCliente(null)).toBe("<cliente></cliente>");
    expect(avisoImagem("minha cozinha")).toBe("<cliente>[enviou a imagem acima] minha cozinha</cliente>");
    expect(avisoImagem(null)).toBe("<cliente>[enviou a imagem acima]</cliente>");
    expect(avisoArquivoNaoLido("um PDF", "planta.pdf", "segue")).toBe(
      '<cliente>[enviou um PDF chamado "planta.pdf"; o sistema guardou o arquivo para o consultor, mas você não consegue ver o conteúdo] segue</cliente>',
    );
    expect(avisoArquivoNaoLido("um vídeo", null, null)).toBe("<cliente>[enviou um vídeo; o sistema guardou o arquivo para o consultor, mas você não consegue ver o conteúdo]</cliente>");
  });

  it("mensagem enviada por consultor ou sistema", () => {
    expect(avisoMensagemEnviada({ autor: "consultor", autorNome: "Carlos", rotuloArquivo: null, texto: "Bom dia!" })).toBe(
      '<sistema>Mensagem enviada ao cliente pelo consultor Carlos: "Bom dia!"</sistema>',
    );
    expect(avisoMensagemEnviada({ autor: "consultor", autorNome: null, rotuloArquivo: "um PDF", texto: null })).toBe(
      '<sistema>Mensagem enviada ao cliente pelo consultor: [enviou um PDF] ""</sistema>',
    );
    expect(avisoMensagemEnviada({ autor: "sistema", autorNome: null, rotuloArquivo: null, texto: "Oi" })).toBe(
      '<sistema>Mensagem enviada ao cliente pelo sistema (mensagem automática): "Oi"</sistema>',
    );
  });
});
