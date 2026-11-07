import { describe, expect, it } from "vitest";
import { juntarTextos } from "@/bot/saida";

describe("juntarTextos", () => {
  it("não repete a mesma fala dita antes e depois de uma ferramenta", () => {
    const fala = "Oi, Mateus, tudo bem? 😊 Qual ambiente você tem interesse em fazer?";
    expect(juntarTextos([fala, fala])).toBe(fala);
  });
  it("ignora diferença de espaço e maiúscula", () => {
    expect(juntarTextos(["Oi!  Tudo bem?", "oi! tudo bem?"])).toBe("Oi!  Tudo bem?");
  });
  it("mantém textos diferentes, separados por linha em branco", () => {
    expect(juntarTextos(["Anotado!", "Qual cidade?"])).toBe("Anotado!\n\nQual cidade?");
  });
});
