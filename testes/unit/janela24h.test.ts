import { describe, expect, it } from "vitest";
import { situacaoDaJanela, textoDeRestante } from "@/regras/janela24h";
import { HORA } from "@/regras/tempo";

const agora = new Date("2026-11-07T15:00:00Z");
const hAtras = (h: number, extraMin = 0) => new Date(agora.getTime() - h * HORA - extraMin * 60_000);

describe("situacaoDaJanela", () => {
  it("verde com mais de 6 h sobrando", () => {
    const s = situacaoDaJanela(hAtras(1), agora);
    expect(s.faixa).toBe("verde");
    expect(s.texto).toBe("23 h");
    expect(s.fracao).toBeCloseTo(23 / 24);
  });
  it("amarelo de 2 h a 6 h (6 h exatas já é amarelo)", () => {
    expect(situacaoDaJanela(hAtras(18), agora).faixa).toBe("amarelo");
    expect(situacaoDaJanela(hAtras(20), agora).faixa).toBe("amarelo");
  });
  it("vermelho com 2 h ou menos (2 h exatas já é vermelho)", () => {
    expect(situacaoDaJanela(hAtras(22), agora).faixa).toBe("vermelho");
    expect(situacaoDaJanela(hAtras(22, 20), agora)).toMatchObject({ faixa: "vermelho", texto: "1 h 40 min" });
  });
  it("fechada com 24 h ou mais, sem mensagem ou com data inválida", () => {
    expect(situacaoDaJanela(hAtras(24), agora)).toMatchObject({ faixa: "fechada", restanteMs: 0, fracao: 0, texto: "" });
    expect(situacaoDaJanela(null, agora).faixa).toBe("fechada");
    expect(situacaoDaJanela("lixo", agora).faixa).toBe("fechada");
  });
  it("aceita data em texto ISO (como chega ao navegador)", () => {
    expect(situacaoDaJanela(hAtras(1).toISOString(), agora).faixa).toBe("verde");
  });
  it("mensagem do futuro (relógio desencontrado) conta como fechada, como em janelaAberta", () => {
    expect(situacaoDaJanela(new Date(agora.getTime() + HORA), agora).faixa).toBe("fechada");
  });
});

describe("textoDeRestante", () => {
  it("formata horas e minutos", () => {
    expect(textoDeRestante(5 * HORA)).toBe("5 h");
    expect(textoDeRestante(35 * 60_000)).toBe("35 min");
    expect(textoDeRestante(30_000)).toBe("menos de 1 min");
  });
});
