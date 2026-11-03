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
    await salvarChave("texto", `  ${CHAVE}  `);
    const linha = await db.configuracao.findUnique({ where: { chave: "api_chave_texto" } });
    expect(linha!.valor).not.toContain(CHAVE);
    expect(await obterChave("texto")).toBe(CHAVE);
    const s = await situacaoDasChaves();
    expect(s.chaves.texto).toMatchObject({ configurada: true, origem: "tela", final: "WXYZ" });
    expect(JSON.stringify(s)).not.toContain(CHAVE);
    expect(s.chaves.audio.configurada).toBe(false);
  });

  it("sem chave na tela vale a variável de ambiente; a tela vence a variável", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-ambiente-0123456789abcd");
    expect(await obterChave("audio")).toBe("sk-ambiente-0123456789abcd");
    expect((await situacaoDasChaves()).chaves.audio.origem).toBe("ambiente");
    await salvarChave("audio", CHAVE);
    expect(await obterChave("audio")).toBe(CHAVE);
    await removerChave("audio");
    expect(await obterChave("audio")).toBe("sk-ambiente-0123456789abcd");
  });

  it("a mesma chave pode ir nos dois campos", async () => {
    await salvarChave("texto", CHAVE);
    await salvarChave("audio", CHAVE);
    expect(await obterChave("texto")).toBe(await obterChave("audio"));
    expect(await transcricaoConfigurada()).toBe(true);
  });

  it("chave inválida é recusada sem gravar", async () => {
    await expect(salvarChave("texto", "curta")).rejects.toThrow();
    expect(await db.configuracao.findUnique({ where: { chave: "api_chave_texto" } })).toBeNull();
  });

  it("CHAVE_MESTRA trocada: a chave salva fica ilegível e cai na variável de ambiente", async () => {
    await salvarChave("texto", CHAVE);
    vi.stubEnv("CHAVE_MESTRA", "outra-mestra-bem-longa-123");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ambiente-0123456789abcd");
    expect(await obterChave("texto")).toBe("sk-ambiente-0123456789abcd");
    expect((await situacaoDasChaves()).chaves.texto.ilegivel).toBe(true);
  });

  it("em produção sem CHAVE_MESTRA não salva", async () => {
    vi.stubEnv("CHAVE_MESTRA", "");
    vi.stubEnv("NODE_ENV", "production");
    expect((await situacaoDasChaves()).podeSalvar).toBe(false);
    await expect(salvarChave("texto", CHAVE)).rejects.toThrow(/CHAVE_MESTRA/);
  });
});
