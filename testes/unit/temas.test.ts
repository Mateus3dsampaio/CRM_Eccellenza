import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEMAS, temaValido } from "@/regras/temas";

describe("temas de cor", () => {
  it("começa no padrão e tem códigos únicos só com letras minúsculas (o script do layout só aceita isso)", () => {
    expect(TEMAS[0].codigo).toBe("padrao");
    const codigos = TEMAS.map((t) => t.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const c of codigos) expect(c).toMatch(/^[a-z]+$/);
  });

  it("todo tema (menos o padrão) tem suas cores em tokens.css", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "tokens.css"), "utf8");
    for (const t of TEMAS.filter((x) => x.codigo !== "padrao")) {
      expect(css, `faltou :root[data-tema="${t.codigo}"] em tokens.css`).toContain(`:root[data-tema="${t.codigo}"]`);
    }
  });

  it("cada bolinha tem 6 cores válidas", () => {
    for (const t of TEMAS) {
      expect(t.cores).toHaveLength(6);
      for (const c of t.cores) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("código estranho vira o padrão", () => {
    expect(temaValido("ametista")).toBe("ametista");
    expect(temaValido("nao-existe")).toBe("padrao");
    expect(temaValido(null)).toBe("padrao");
  });
});
