import { CHAVE_TEMA, temaValido } from "@/regras/temas";

/** Tema guardado neste aparelho (nunca lança: sem armazenamento vale o padrão). */
export function lerTema(): string {
  try {
    return temaValido(localStorage.getItem(CHAVE_TEMA));
  } catch {
    return "padrao";
  }
}

/** Aplica o tema na página e guarda a escolha. O script do `layout.tsx` faz o mesmo antes de pintar, para não piscar. */
export function aplicarTema(codigo: string): void {
  const tema = temaValido(codigo);
  const raiz = document.documentElement;
  if (tema === "padrao") delete raiz.dataset.tema;
  else raiz.dataset.tema = tema;
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // Vale só nesta visita.
  }
  // A barra de cima do celular acompanha a cor do fundo.
  const cor = getComputedStyle(raiz).getPropertyValue("--color-fundo").trim();
  if (cor) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", cor);
}
