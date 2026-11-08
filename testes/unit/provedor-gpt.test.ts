import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { deRespostaOpenAI, paraFerramentasOpenAI, paraMensagensOpenAI } from "@/bot/openai-conversao";
import { FERRAMENTAS } from "@/bot/ferramentas";
import { responderCliente } from "@/bot/atendimento";
import { configDoBot, definirConfigDoBot, MODELO_CLAUDE_PADRAO, MODELO_OPENAI_PADRAO } from "@/servicos/provedor-bot";
import { salvarChave } from "@/servicos/chaves-api";
import { obterOuCriarLead } from "@/servicos/leads";
import { registrarMensagemCliente } from "@/servicos/mensagens";
import { limparBanco, criarRoteiroDeTeste } from "./ajuda";

describe("conversão para a OpenAI", () => {
  it("histórico com ferramenta vira system, user, assistant com tool_calls e tool", () => {
    const m = paraMensagensOpenAI("SIS", [
      { role: "user", content: [{ type: "text", text: "<cliente>oi</cliente>" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" } }] },
      { role: "assistant", content: [{ type: "text", text: "Olá" }, { type: "tool_use", id: "t1", name: "registrar_lead", input: { nome: "Ana" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok", is_error: false }] },
    ]);
    expect(m.map((x) => x.role)).toEqual(["system", "user", "assistant", "tool"]);
    expect(m[1]).toMatchObject({ content: [{ type: "text" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } }] });
    expect(m[2]).toMatchObject({ content: "Olá", tool_calls: [{ id: "t1", function: { name: "registrar_lead", arguments: '{"nome":"Ana"}' } }] });
    expect(m[3]).toMatchObject({ tool_call_id: "t1", content: "ok" });
  });
  it("erro de ferramenta é marcado e as ferramentas viram funções", () => {
    const m = paraMensagensOpenAI("S", [{ role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "falhou", is_error: true }] }]);
    expect(m[1]).toMatchObject({ role: "tool", content: "ERRO: falhou" });
    const f = paraFerramentasOpenAI(FERRAMENTAS as never);
    expect(f).toHaveLength(FERRAMENTAS.length);
    expect(f[0]).toMatchObject({ type: "function", function: { name: "registrar_lead" } });
  });
  it("resposta: texto, ferramenta, argumentos quebrados, limite e recusa", () => {
    const base = { message: { content: "Oi" as string | null } };
    expect(deRespostaOpenAI({ choices: [{ finish_reason: "stop", ...base }] }).parada).toBe("end_turn");
    const r = deRespostaOpenAI({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "x", arguments: "{quebrado" } }] } }] });
    expect(r.parada).toBe("tool_use");
    expect(r.content).toEqual([{ type: "tool_use", id: "c1", name: "x", input: {} }]);
    expect(deRespostaOpenAI({ choices: [{ finish_reason: "length", ...base }] }).parada).toBe("max_tokens");
    expect(deRespostaOpenAI({ choices: [{ finish_reason: "stop", message: { content: null, refusal: "não" } }] }).parada).toBe("refusal");
  });
});

describe("bot com GPT", () => {
  beforeEach(async () => {
    await limparBanco();
    await criarRoteiroDeTeste();
    vi.restoreAllMocks();
    vi.stubEnv("CHAVE_MESTRA", "mestra-de-teste-bem-longa");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  it("padrão é Claude; o provedor e o modelo são gravados", async () => {
    expect(await configDoBot()).toEqual({ provedor: "claude", modeloClaude: MODELO_CLAUDE_PADRAO, modeloOpenai: MODELO_OPENAI_PADRAO });
    await definirConfigDoBot({ provedor: "openai", modeloOpenai: " gpt-x.1 " });
    expect(await configDoBot()).toEqual({ provedor: "openai", modeloClaude: MODELO_CLAUDE_PADRAO, modeloOpenai: "gpt-x.1" });
    await definirConfigDoBot({ modeloClaude: "claude-haiku-5-5" });
    expect((await configDoBot()).modeloClaude).toBe("claude-haiku-5-5");
    await expect(definirConfigDoBot({ provedor: "claude", modeloOpenai: "nome inválido!" })).rejects.toThrow();
    expect((await configDoBot()).provedor).toBe("openai");
  });

  it("responde pela OpenAI, usa a ferramenta e guarda o histórico no formato da Anthropic", async () => {
    await salvarChave("openai", "sk-openai-teste-0123456789abcd");
    await definirConfigDoBot({ provedor: "openai", modeloOpenai: "gpt-teste" });
    const respostas = [
      { choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "atualizar_lead", arguments: '{"cidade":"Juazeiro do Norte"}' } }] } }], usage: { prompt_tokens: 100, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 40 } } },
      { choices: [{ finish_reason: "stop", message: { content: "Anotei, obrigado!" } }], usage: { prompt_tokens: 120, completion_tokens: 5 } },
    ];
    const corpos: { model: string }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) => {
      corpos.push(JSON.parse(String((init as RequestInit).body)));
      return new Response(JSON.stringify(respostas.shift()), { status: 200, headers: { "content-type": "application/json" } });
    });
    const lead = await obterOuCriarLead("+5588999990001", "Ana");
    await registrarMensagemCliente(lead.id, "Moro em Juazeiro do Norte");
    const r = await responderCliente(lead.id);
    expect(r.erro).toBeUndefined();
    expect(r.respostas).toEqual(["Anotei, obrigado!"]);
    expect(corpos[0].model).toBe("gpt-teste");
    const guardado = JSON.parse((await db.conversaApi.findUniqueOrThrow({ where: { leadId: lead.id } })).mensagens);
    expect(guardado.some((m: { content: unknown }) => JSON.stringify(m.content).includes('"tool_use"'))).toBe(true);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).cidade).toBe("Juazeiro do Norte");
    expect(await db.usoApi.count()).toBe(2);
  });

  it("chave recusada pela OpenAI vira aviso em português, sem a chave", async () => {
    // chave diferente da do teste anterior: o cliente da OpenAI é guardado por chave e prenderia o fetch falso antigo
    await salvarChave("openai", "sk-openai-outra-0123456789abcd");
    await definirConfigDoBot({ provedor: "openai", modeloOpenai: "gpt-teste" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401, headers: { "content-type": "application/json" } }));
    const lead = await obterOuCriarLead("+5588999990002", "Bia");
    await registrarMensagemCliente(lead.id, "oi");
    const r = await responderCliente(lead.id);
    expect(r.erro).toMatch(/chave da OpenAI é inválida/);
    expect(r.erro).not.toContain("sk-openai");
  });
});
