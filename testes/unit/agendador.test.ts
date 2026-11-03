import { afterEach, describe, expect, it, vi } from "vitest";
import { agendadorDeveLigar, iniciarAgendador, pararAgendador } from "@/servicos/agendador";

describe("agendador das rotinas", () => {
  afterEach(() => {
    pararAgendador();
    vi.useRealTimers();
  });

  it("roda as rotinas sozinho, sem nenhuma tela aberta, e só liga uma vez", async () => {
    vi.useFakeTimers();
    const executar = vi.fn().mockResolvedValue(undefined);
    expect(iniciarAgendador({ intervaloMs: 1000, executar })).toBe(true);
    expect(iniciarAgendador({ intervaloMs: 1000, executar })).toBe(false);
    await vi.advanceTimersByTimeAsync(3500);
    expect(executar).toHaveBeenCalledTimes(3);
  });

  it("erro numa rodada não derruba nem para o agendador", async () => {
    vi.useFakeTimers();
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const executar = vi.fn().mockRejectedValueOnce(new Error("banco fora")).mockResolvedValue(undefined);
    iniciarAgendador({ intervaloMs: 1000, executar });
    await vi.advanceTimersByTimeAsync(2500);
    expect(executar).toHaveBeenCalledTimes(2);
    expect(erro).toHaveBeenCalledTimes(1);
    erro.mockRestore();
  });

  it("liga em produção, desliga em desenvolvimento, e ROTINAS_AUTO manda", () => {
    expect(agendadorDeveLigar({ NODE_ENV: "production" })).toBe(true);
    expect(agendadorDeveLigar({ NODE_ENV: "development" })).toBe(false);
    expect(agendadorDeveLigar({ NODE_ENV: "development", ROTINAS_AUTO: "1" })).toBe(true);
    expect(agendadorDeveLigar({ NODE_ENV: "production", ROTINAS_AUTO: "0" })).toBe(false);
  });
});
