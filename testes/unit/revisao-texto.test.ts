import { beforeEach, describe, expect, it, vi } from "vitest";
import { destacarMudancas, limparRevisao, linksPreservados, numerosPreservados } from "@/regras/revisao-texto";
import { salvarChave } from "@/servicos/chaves-api";
import { revisarTexto } from "@/servicos/revisao-texto";
import { limparBanco } from "./ajuda";

describe("regras da revisão de texto", () => {
  it("tira as tags e a sobra em volta da resposta do modelo", () => {
    expect(limparRevisao("  <texto>Olá, tudo bem?</texto> ")).toBe("Olá, tudo bem?");
    expect(limparRevisao("Olá")).toBe("Olá");
  });

  it("não deixa mudar número nem link", () => {
    expect(numerosPreservados("Fica R$ 4500 em 10x, medida 2,80", "Fica R$ 4500 em 10x, medida 2,80!")).toBe(true);
    expect(numerosPreservados("Fica R$ 4500", "Fica R$ 5400")).toBe(false);
    expect(numerosPreservados("Fica R$ 4500", "Fica barato")).toBe(false);
    expect(linksPreservados("veja www.loja.com.br", "veja www.loja.com.br")).toBe(true);
    expect(linksPreservados("veja https://a.com/x", "veja https://a.com/y")).toBe(false);
  });

  it("destaca só o que mudou, mantendo espaços e quebras de linha", () => {
    const pedacos = destacarMudancas("Nós vai amanhã\nàs 10h", "Nós vamos amanhã\nàs 10h");
    expect(pedacos.map((p) => p.texto).join("")).toBe("Nós vamos amanhã\nàs 10h");
    expect(pedacos.filter((p) => p.mudou).map((p) => p.texto)).toEqual(["vamos"]);
    expect(destacarMudancas("igual", "igual").some((p) => p.mudou)).toBe(false);
  });
});

describe("revisarTexto (Claude simulado)", () => {
  beforeEach(async () => {
    await limparBanco();
    vi.restoreAllMocks();
    vi.stubEnv("CHAVE_MESTRA", "mestra-de-teste-bem-longa");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
  });

  function responder(texto: string, parada = "end_turn") {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "claude-haiku-5-5", content: [{ type: "text", text: texto }], stop_reason: parada, stop_sequence: null, usage: { input_tokens: 50, output_tokens: 20 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  }

  it("sem chave: indisponível, sem chamar a rede", async () => {
    const rede = vi.spyOn(globalThis, "fetch");
    const r = await revisarTexto("Nós vai amanhã");
    expect(r).toMatchObject({ estado: "indisponivel" });
    expect(rede).not.toHaveBeenCalled();
  });

  it("texto vazio ou grande demais não chama a rede", async () => {
    await salvarChave("anthropic", "sk-ant-teste-0123456789abcdef");
    const rede = vi.spyOn(globalThis, "fetch");
    expect(await revisarTexto("   ")).toMatchObject({ estado: "indisponivel" });
    expect(await revisarTexto("a".repeat(4001))).toMatchObject({ estado: "indisponivel" });
    expect(rede).not.toHaveBeenCalled();
  });

  it("devolve o texto corrigido e manda o texto entre tags, com o modelo barato", async () => {
    await salvarChave("anthropic", "sk-ant-teste-0123456789abcdef");
    const rede = responder("Nós vamos amanhã às 10h");
    const r = await revisarTexto("Nós vai amanhã às 10h");
    expect(r).toEqual({ estado: "corrigido", texto: "Nós vamos amanhã às 10h" });
    const corpo = JSON.parse(String((rede.mock.calls[0][1] as RequestInit).body));
    expect(corpo.model).toBe("claude-haiku-5-5");
    expect(corpo.messages[0].content).toBe("<texto>Nós vai amanhã às 10h</texto>");
  });

  it("texto já certo vira 'igual'", async () => {
    await salvarChave("anthropic", "sk-ant-teste-0123456789abcdef");
    responder("Tudo certo por aqui.");
    expect(await revisarTexto("Tudo certo por aqui.")).toEqual({ estado: "igual" });
  });

  it("descarta a revisão que mexeu em número", async () => {
    await salvarChave("anthropic", "sk-ant-teste-0123456789abcdef");
    responder("O valor fica R$ 5400");
    const r = await revisarTexto("O valor fica R$ 4500");
    expect(r).toMatchObject({ estado: "indisponivel" });
  });

  it("recusa, corte ou erro da API viram aviso, sem vazar a chave nem o texto", async () => {
    await salvarChave("anthropic", "sk-ant-teste-0123456789abcdef");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    responder("qualquer", "max_tokens");
    expect(await revisarTexto("Texto qualquer")).toMatchObject({ estado: "indisponivel" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), { status: 401, headers: { "content-type": "application/json" } }));
    const r = await revisarTexto("Texto secreto do cliente");
    expect(r).toMatchObject({ estado: "indisponivel" });
    expect(JSON.stringify(r)).not.toContain("sk-ant");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secreto");
  });
});
