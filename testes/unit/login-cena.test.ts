import { describe, expect, it } from "vitest";
import { CLIENTES, QUADRO, dadosDoCard, faixaDaColuna } from "@/componentes/login/cena/dados";
import { bezier, homografia, molaFisica } from "@/componentes/login/cena/geometria";
import { palavrasDoTexto, textoLimpo } from "@/componentes/login/cena/texto";
import { ETAPAS } from "@/regras/etapas";
import { dataLocal } from "@/regras/tempo";

// Tarefa 46: as partes de cálculo da cena do login (sem tela).

describe("texto das mensagens fictícias", () => {
  it("tira as marcas e guarda o que o assistente extrai, sem quebrar trecho com espaço", () => {
    const t = "Sou o [Bruno|nome], de [Barbalha|cidade]. Quero o [quarto de casal|amb:0].";
    expect(textoLimpo(t)).toBe("Sou o Bruno, de Barbalha. Quero o quarto de casal.");
    const palavras = palavrasDoTexto(t);
    expect(palavras.map((w) => w.map((s) => s.txt).join(""))).toEqual(["Sou", "o", "Bruno,", "de", "Barbalha.", "Quero", "o", "quarto de casal."]);
    expect(palavras[2][0]).toEqual({ txt: "Bruno", campo: "nome" });
    expect(palavras[7][0]).toEqual({ txt: "quarto de casal", campo: "amb:0" });
  });
  it("todo cliente tem nome, cidade e cada ambiente marcados", () => {
    for (const c of CLIENTES) {
      const campos = palavrasDoTexto(c.texto).flat().filter((s) => s.campo).map((s) => s.campo);
      expect(campos).toContain("nome");
      expect(campos).toContain("cidade");
      c.ambientes.forEach((_, i) => expect(campos).toContain(`amb:${i}`));
    }
  });
});

describe("geometria", () => {
  it("homografia: ida e volta no plano em perspectiva", () => {
    const tela = [{ x: 100, y: 120 }, { x: 900, y: 60 }, { x: 1300, y: 800 }, { x: -50, y: 700 }] as const;
    const h = homografia(tela, { x0: -600, y0: -200, x1: 3000, y1: 1500 });
    expect(h.paraTela(-600, -200)).toEqual({ x: 100, y: 120 });
    const t = h.paraTela(3000, 1500);
    expect(t.x).toBeCloseTo(1300, 6);
    expect(t.y).toBeCloseTo(800, 6);
    const m = h.paraMundo(...(Object.values(h.paraTela(812, 333)) as [number, number]));
    expect(m.x).toBeCloseTo(812, 6);
    expect(m.y).toBeCloseTo(333, 6);
  });
  it("Bézier começa e termina nos pontos; a mola termina em 1", () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 4 }, c = { x: 5, y: -20 };
    expect(bezier(a, c, b, 0)).toEqual(a);
    expect(bezier(a, c, b, 1)).toEqual(b);
    const mola = molaFisica(0.38, 16);
    expect(mola(0)).toBeCloseTo(0, 6);
    expect(mola(1)).toBe(1);
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => mola(i / 50)))).toBeGreaterThan(1); // quica
  });
});

describe("cards da vitrine saem das regras do kanban", () => {
  const agora = dataLocal(2026, 11, 23, 14, 30); // segunda-feira

  it("a faixa do cliente da história em cada coluna", () => {
    expect(faixaDaColuna(0, agora)).toMatchObject({ codigo: "ia_atendendo", cor: "cinza", texto: "IA atendendo" });
    expect(faixaDaColuna(1, agora)).toMatchObject({ codigo: "responder", cor: "cinza", texto: "Responder · há 1 min" });
    expect(faixaDaColuna(2, agora)).toMatchObject({ codigo: "compromisso", cor: "verde", texto: "Medição sáb 28/11 9h" });
    expect(faixaDaColuna(3, agora)).toMatchObject({ codigo: "compromisso", cor: "verde", texto: "Apresentação qui 03/12 10h" });
    expect(faixaDaColuna(4, agora)).toMatchObject({ codigo: "definir_retorno", cor: "ambar" });
    expect(faixaDaColuna(5, agora)).toBeNull(); // Fechado: sem faixa
  });

  it("o quadro tem uma lista por coluna e nada parecido com dado real da loja", () => {
    expect(QUADRO).toHaveLength(ETAPAS.length);
    const textos = QUADRO.flat().map((c) => {
      const d = dadosDoCard(c, agora);
      return [d.nome, d.previa, d.cidade, ...d.ambientes, d.faixa?.texto ?? ""].join(" ");
    });
    for (const t of textos) expect(t).not.toMatch(/R\$|\d{4,}/);
  });

  it("anel de 24 h e faixa como no kanban: nada em Fechado e Perdido", () => {
    for (const [i, lista] of QUADRO.entries()) {
      for (const c of lista) {
        const d = dadosDoCard(c, agora);
        const encerrada = ETAPAS[i].codigo === "fechado" || ETAPAS[i].codigo === "perdido";
        expect(d.anel === null).toBe(encerrada);
        if (encerrada) expect(d.faixa).toBeNull();
        else expect(d.faixa).not.toBeNull();
      }
    }
  });
});
