import { beforeEach, describe, expect, it, vi } from "vitest";
import { descricaoGpt, familiaClaude, filtrarModelosClaude, filtrarModelosGpt, garantirNaLista, RESERVA_CLAUDE } from "@/regras/modelos-ia";
import { listarModelos } from "@/servicos/modelos-ia";
import { salvarChave } from "@/servicos/chaves-api";
import { definirConfigDoBot } from "@/servicos/provedor-bot";
import { limparBanco } from "./ajuda";

describe("filtro dos modelos", () => {
  it("Claude: o mais novo de cada família, na ordem Sonnet, Haiku, Opus, Fable; antigos ficam de fora", () => {
    const r = filtrarModelosClaude([
      { id: "claude-opus-5-5", nome: "Claude Opus 5.5" },
      { id: "claude-sonnet-5-5", nome: "Claude Sonnet 5.5" },
      { id: "claude-sonnet-5", nome: "Claude Sonnet 5" },
      { id: "claude-haiku-5-5", nome: "Claude Haiku 5.5" },
      { id: "claude-haiku-4-5", nome: "Claude Haiku 4.5" },
      { id: "claude-3-haiku-20240307", nome: "Claude Haiku 3" },
      { id: "claude-fable-5-1", nome: "Claude Fable 5.1" },
    ]);
    expect(r.map((m) => m.id)).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5", "claude-fable-5-1"]);
    expect(r.every((m) => m.descricao.length > 0)).toBe(true);
    expect(filtrarModelosClaude(RESERVA_CLAUDE)).toHaveLength(4);
    expect(familiaClaude("claude-haiku-5-5")).toBe("haiku");
    expect(familiaClaude("claude-haiku-4-5")).toBeNull();
  });

  it("GPT: só conversa, sem datadas nem áudio/imagem, mais novos primeiro", () => {
    const r = filtrarModelosGpt([
      { id: "gpt-5.5", criado: 300 },
      { id: "gpt-5.5-mini", criado: 290 },
      { id: "gpt-4o-mini-transcribe", criado: 280 },
      { id: "gpt-4o-2024-08-06", criado: 100 },
      { id: "gpt-image-1", criado: 200 },
      { id: "gpt-realtime", criado: 310 },
      { id: "text-embedding-3-small", criado: 50 },
      { id: "whisper-1", criado: 10 },
      { id: "gpt-4.1", criado: 150 },
    ]);
    expect(r.map((m) => m.id)).toEqual(["gpt-5.5", "gpt-5.5-mini", "gpt-4.1"]);
    expect(descricaoGpt("gpt-5.5-nano")).toMatch(/barato/);
  });

  it("o modelo salvo sempre aparece", () => {
    const lista = filtrarModelosClaude(RESERVA_CLAUDE);
    expect(garantirNaLista(lista, "claude-sonnet-5-5", "x")).toBe(lista);
    expect(garantirNaLista(lista, "outro-modelo", "Salvo")[0]).toMatchObject({ id: "outro-modelo", descricao: "Salvo" });
  });
});

describe("lista de modelos da conta", () => {
  beforeEach(async () => {
    await limparBanco();
    vi.restoreAllMocks();
    vi.stubEnv("CHAVE_MESTRA", "mestra-de-teste-bem-longa");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  it("sem chave: lista de reserva com aviso, sem chamar a rede", async () => {
    const rede = vi.spyOn(globalThis, "fetch");
    const r = await listarModelos("claude");
    expect(r.origem).toBe("reserva");
    expect(r.aviso).toMatch(/Sem chave/);
    expect(r.modelos.map((m) => m.id)).toContain("claude-sonnet-5-5");
    expect(rede).not.toHaveBeenCalled();
  });

  it("OpenAI: busca na conta com a chave da OpenAI e inclui o modelo salvo", async () => {
    await salvarChave("openai", "sk-openai-teste-0123456789abcd");
    await definirConfigDoBot({ modeloOpenai: "gpt-antigo" });
    const pedidos: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      pedidos.push(`${String(url)} ${new Headers((init as RequestInit).headers).get("authorization")}`);
      return new Response(JSON.stringify({ object: "list", data: [{ id: "gpt-5.5", created: 2, object: "model", owned_by: "openai" }, { id: "dall-e-3", created: 1, object: "model", owned_by: "openai" }] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const r = await listarModelos("openai");
    expect(r.origem).toBe("conta");
    expect(r.modelos.map((m) => m.id)).toEqual(["gpt-antigo", "gpt-5.5"]);
    expect(pedidos[0]).toContain("/models");
    expect(pedidos[0]).toContain("sk-openai-teste");
    expect(JSON.stringify(r)).not.toContain("sk-openai");
  });

  it("chave recusada: reserva com o motivo, sem vazar a chave", async () => {
    await salvarChave("anthropic", "sk-ant-teste-0123456789abcdef");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), { status: 401, headers: { "content-type": "application/json" } }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await listarModelos("claude");
    expect(r.origem).toBe("reserva");
    expect(r.aviso).toMatch(/recusada/);
    expect(JSON.stringify(r)).not.toContain("sk-ant");
  });
});
