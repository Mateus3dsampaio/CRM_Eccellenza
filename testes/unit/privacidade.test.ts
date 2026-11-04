import { describe, expect, it } from "vitest";
import { CAMINHO_EXCLUSAO, CONTATO_PADRAO, PRAZO_EXCLUSAO_DIAS, secoesExclusao, secoesPrivacidade } from "@/regras/privacidade";

describe("páginas públicas de privacidade", () => {
  it("a política aponta para a página de exclusão", () => {
    const texto = secoesPrivacidade(undefined).flatMap((s) => s.paragrafos).join(" ");
    expect(texto).toContain(CAMINHO_EXCLUSAO);
  });

  it("a página de exclusão diz como pedir, o prazo e o que fica de fora", () => {
    const secoes = secoesExclusao(undefined);
    const titulos = secoes.map((s) => s.titulo);
    expect(titulos).toEqual(expect.arrayContaining(["Como pedir", "Prazo", "O que apagamos", "O que não conseguimos apagar sozinhos"]));
    const texto = secoes.flatMap((s) => s.paragrafos).join(" ");
    expect(texto).toContain(CONTATO_PADRAO);
    expect(texto).toContain(`${PRAZO_EXCLUSAO_DIAS} dias`);
  });

  it("o contato da variável vale mais que o padrão", () => {
    const texto = secoesExclusao("contato@exemplo.com").flatMap((s) => s.paragrafos).join(" ");
    expect(texto).toContain("contato@exemplo.com");
    expect(texto).not.toContain(CONTATO_PADRAO);
  });
});
