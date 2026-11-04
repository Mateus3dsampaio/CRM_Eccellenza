import { describe, expect, it } from "vitest";
import { ALTURA_BOJO, MEIA_BASE_BOJO, aberturaDoEntalhe, alturaDoBojoEm, alturaDoSalto, caminhoDoEntalhe, contornoDaBarra, esticarBojo, formaDoBojo, ponto, profundidadeDoEntalhe, progresso } from "@/componentes/entalhe/geometria";

describe("entalhe flutuante (contas)", () => {
  it("o salto é zero parado e máximo no meio do caminho", () => {
    expect(alturaDoSalto(0, 10)).toBe(0);
    expect(alturaDoSalto(1, 10)).toBeCloseTo(0, 5);
    expect(alturaDoSalto(0.5, 10)).toBeCloseTo(10, 5);
  });

  it("o entalhe fecha no ar e abre parado", () => {
    expect(aberturaDoEntalhe(0, 10)).toBe(1);
    expect(aberturaDoEntalhe(10, 10)).toBe(0);
  });

  it("progresso: sem deslocamento conta como chegou", () => {
    expect(progresso(50, 50, 50)).toBe(1);
    expect(progresso(75, 50, 100)).toBe(0.5);
    expect(progresso(500, 50, 100)).toBe(1);
  });

  it("a profundidade é cheia no meio e zero fora da largura", () => {
    expect(profundidadeDoEntalhe(0, 50, 26, 14)).toBe(26);
    expect(profundidadeDoEntalhe(51, 50, 26, 14)).toBe(0);
    expect(profundidadeDoEntalhe(50, 50, 26, 14)).toBe(12); // parede reta até o canto arredondado
    expect(profundidadeDoEntalhe(-30, 50, 26, 14)).toBe(profundidadeDoEntalhe(30, 50, 26, 14));
  });

  it("o ponto muda de eixo entre horizontal (borda de cima) e vertical (borda da direita)", () => {
    expect(ponto("horizontal", 18, 100, 5)).toEqual([100, 23]);
    expect(ponto("vertical", 215, 100, 5)).toEqual([210, 100]);
  });

  it("o caminho existe aberto e some fechado (inclusive com valores grandes, sem travar)", () => {
    expect(caminhoDoEntalhe("horizontal", 18, 100, 60, 26, 14).linha.startsWith("M")).toBe(true);
    expect(caminhoDoEntalhe("vertical", 215, 130, 27, 210, 12).preencher.endsWith("Z")).toBe(true);
    expect(caminhoDoEntalhe("horizontal", 18, 100, 60, 0, 14)).toEqual({ preencher: "", linha: "" });
  });

  it("bojo líquido: cúpula no centro, nada além da base, mais baixo e comprido quando estica", () => {
    expect(formaDoBojo(0)).toBeCloseTo(ALTURA_BOJO, 5);
    expect(formaDoBojo(MEIA_BASE_BOJO)).toBe(0);
    const parado = esticarBojo(0);
    const rapido = esticarBojo(2000);
    expect(parado).toEqual({ sy: 1, sxl: 1, sxr: 1 });
    expect(rapido.sy).toBeLessThan(1);
    expect(rapido.sxl).toBeGreaterThan(rapido.sxr); // indo para a direita, o lado de trás (esquerdo) se arrasta
    // aba larga: o topo é reto na largura do plato
    expect(alturaDoBojoEm(130, 100, 40, parado)).toBeCloseTo(ALTURA_BOJO, 5);
  });

  it("contorno da barra fecha, com e sem bojo", () => {
    expect(contornoDaBarra(300, 20, 64, 12, () => 0).endsWith("Z")).toBe(true);
    expect(contornoDaBarra(300, 20, 64, 12, (x) => (x > 100 && x < 140 ? 10 : 0), [95, 145]).includes("L120.0,10.00")).toBe(true);
  });
});
