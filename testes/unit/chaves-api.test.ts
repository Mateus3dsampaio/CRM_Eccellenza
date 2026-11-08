import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { cifrarChave, decifrarChave } from "@/lib/cifra";
import { finalDaChave, problemaNaChave } from "@/regras/chaves-api";
import { obterChave, removerChave, salvarChave, situacaoDasChaves } from "@/servicos/chaves-api";
import { transcricaoConfigurada } from "@/servicos/transcricao";
import { limparBanco } from "./ajuda";

const CHAVE = "sk-teste-0123456789abcdefWXYZ";

describe("criptografia e formato", () => {
  it("cifra e decifra; segredo errado ou texto adulterado não abre", () => {
    const guardado = cifrarChave(CHAVE, "segredo-longo-1234");
    expect(guardado).not.toContain(CHAVE);
    expect(decifrarChave(guardado, "segredo-longo-1234")).toBe(CHAVE);
    expect(decifrarChave(guardado, "outro-segredo-9999")).toBeNull();
    expect(decifrarChave(guardado.slice(0, -2) + "xx", "segredo-longo-1234")).toBeNull();
  });
  it("confere o formato e mostra só o final", () => {
    expect(problemaNaChave(CHAVE)).toBeNull();
    expect(problemaNaChave("curta")).not.toBeNull();
    expect(problemaNaChave("sk-com espaco no meio 0123456789")).not.toBeNull();
    expect(finalDaChave(CHAVE)).toBe("WXYZ");
  });
});

describe("chaves de API na tela", () => {
  beforeEach(async () => {
    await limparBanco();
    vi.stubEnv("CHAVE_MESTRA", "mestra-de-teste-bem-longa");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  it("salva criptografada, a tela vale e a situação mostra só o final", async () => {
    await salvarChave("anthropic", `  ${CHAVE}  `);
    const linha = await db.configuracao.findUnique({ where: { chave: "api_chave_texto" } });
    expect(linha!.valor).not.toContain(CHAVE);
    expect(await obterChave("anthropic")).toBe(CHAVE);
    const s = await situacaoDasChaves();
    expect(s.chaves.anthropic).toMatchObject({ configurada: true, origem: "tela", final: "WXYZ" });
    expect(JSON.stringify(s)).not.toContain(CHAVE);
    expect(s.chaves.openai.configurada).toBe(false);
  });

  it("sem chave na tela vale a variável de ambiente; a tela vence a variável", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-ambiente-0123456789abcd");
    expect(await obterChave("openai")).toBe("sk-ambiente-0123456789abcd");
    expect((await situacaoDasChaves()).chaves.openai.origem).toBe("ambiente");
    await salvarChave("openai", CHAVE);
    expect(await obterChave("openai")).toBe(CHAVE);
    await removerChave("openai");
    expect(await obterChave("openai")).toBe("sk-ambiente-0123456789abcd");
  });

  it("chaves salvas antes da troca de nomes continuam valendo (texto = Anthropic, áudio = OpenAI)", async () => {
    await salvarChave("anthropic", CHAVE);
    await salvarChave("openai", "sk-openai-0123456789abcdefGHIJ");
    expect(await db.configuracao.findUnique({ where: { chave: "api_chave_texto" } })).not.toBeNull();
    expect(await db.configuracao.findUnique({ where: { chave: "api_chave_audio" } })).not.toBeNull();
    expect(await obterChave("anthropic")).toBe(CHAVE);
    expect(await obterChave("openai")).toBe("sk-openai-0123456789abcdefGHIJ");
    expect(await transcricaoConfigurada()).toBe(true);
  });

  it("chave inválida é recusada sem gravar", async () => {
    await expect(salvarChave("anthropic", "curta")).rejects.toThrow();
    expect(await db.configuracao.findUnique({ where: { chave: "api_chave_texto" } })).toBeNull();
  });

  it("CHAVE_MESTRA trocada: a chave salva fica ilegível e cai na variável de ambiente", async () => {
    await salvarChave("anthropic", CHAVE);
    vi.stubEnv("CHAVE_MESTRA", "outra-mestra-bem-longa-123");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ambiente-0123456789abcd");
    expect(await obterChave("anthropic")).toBe("sk-ambiente-0123456789abcd");
    expect((await situacaoDasChaves()).chaves.anthropic.ilegivel).toBe(true);
  });

  it("em produção sem CHAVE_MESTRA não salva", async () => {
    vi.stubEnv("CHAVE_MESTRA", "");
    vi.stubEnv("NODE_ENV", "production");
    expect((await situacaoDasChaves()).podeSalvar).toBe(false);
    await expect(salvarChave("anthropic", CHAVE)).rejects.toThrow(/CHAVE_MESTRA/);
  });
});
