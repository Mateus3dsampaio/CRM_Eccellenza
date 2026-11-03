import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { modoSimulador } from "@/lib/modo";
import { exigirModoSimulador } from "@/lib/modo-rota";
import { agora, avancarRelogio } from "@/lib/relogio";
import { ErroHttp } from "@/lib/sessao";

describe("modo simulador (tarefa 13)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("liga em desenvolvimento/teste, desliga em produção, e MODO_SIMULADOR manda", () => {
    expect(modoSimulador({ NODE_ENV: "development" })).toBe(true);
    expect(modoSimulador({ NODE_ENV: "production" })).toBe(false);
    expect(modoSimulador({ NODE_ENV: "production", MODO_SIMULADOR: "1" })).toBe(true);
    expect(modoSimulador({ NODE_ENV: "development", MODO_SIMULADOR: "0" })).toBe(false);
  });

  it("em produção as rotas de simulação respondem 404", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => exigirModoSimulador()).toThrowError(ErroHttp);
    try {
      exigirModoSimulador();
    } catch (e) {
      expect((e as ErroHttp).status).toBe(404);
    }
  });

  it("em produção o relógio é o real, mesmo com deslocamento guardado, e não anda", async () => {
    await avancarRelogio(3 * 3600_000);
    vi.stubEnv("NODE_ENV", "production");
    const antes = Date.now();
    const a = (await agora()).getTime();
    expect(a - antes).toBeLessThan(2000);
    await expect(avancarRelogio(3600_000)).rejects.toThrow();
    vi.unstubAllEnvs();
    await db.configuracao.deleteMany({ where: { chave: "relogio_deslocamento_ms" } });
  });
});
