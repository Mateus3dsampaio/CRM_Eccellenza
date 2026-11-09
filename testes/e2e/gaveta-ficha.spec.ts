// Gaveta e ficha completa (arranjo de 09/11/2026): abrem no topo, resumo recolhido, prévia de modelo inteira
// com o Enviar à vista e o campo de envio sem rolar a página. Só no computador, em 1440×900 e 1280×720.
import { expect, test, type Page } from "@playwright/test";

const PASTA = "docs/rodadas/evidencias/telas";

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("mateus");
  await page.getByLabel("Senha").fill("mateus123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

for (const tela of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  const nome = `${tela.width}x${tela.height}`;

  test.describe(`gaveta e ficha em ${nome}`, () => {
    test.skip(({ isMobile }) => isMobile, "Arranjo pensado para o PC");
    test.use({ viewport: tela });

    test("gaveta abre no topo, resumo recolhido e modelo longo com Enviar à vista", async ({ page }) => {
      await entrar(page);
      await page.getByRole("link", { name: /Abrir ficha de Patrícia/ }).first().click();
      const gaveta = page.getByRole("complementary", { name: "Gaveta do lead" });
      const resumo = gaveta.getByRole("button", { name: /Resumo para o consultor/ });
      await expect(resumo).toBeVisible();
      await expect(resumo).toHaveAttribute("aria-expanded", "false");
      await expect(resumo).toBeInViewport({ ratio: 1 });
      await expect(gaveta.getByRole("button", { name: /Etapa e responsável/ })).toHaveAttribute("aria-expanded", "false");
      const enviar = gaveta.getByRole("button", { name: "Enviar" });
      await expect(enviar).toBeInViewport({ ratio: 1 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${PASTA}/gaveta-${nome}.png` });

      await resumo.click();
      await expect(resumo).toHaveAttribute("aria-expanded", "true");
      await expect(gaveta.getByRole("button", { name: "Copiar" })).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${PASTA}/gaveta-resumo-aberto-${nome}.png` });
      await resumo.click();

      await gaveta.getByLabel("Modelo aprovado").selectOption({ label: "Modelo: Primeiro contato" });
      const previa = gaveta.getByLabel("Prévia do modelo");
      await expect(previa).toContainText("Gostaria de");
      await expect(previa).toBeInViewport({ ratio: 1 });
      await expect(enviar).toBeInViewport({ ratio: 1 });
      await expect(enviar).toBeEnabled();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${PASTA}/gaveta-modelo-${nome}.png` });
    });

    test("ficha completa: ações no cabeçalho, caixa de texto que cresce e envio sem rolar a página", async ({ page }) => {
      await entrar(page);
      // Bruno (seed) escreveu há poucas horas: janela de 24h aberta, dá para digitar.
      await page.getByRole("link", { name: /Abrir ficha de Bruno/ }).first().click();
      await page.getByRole("complementary", { name: "Gaveta do lead" }).getByRole("link", { name: "Abrir ficha completa" }).click();
      await page.waitForURL(/\/lead\//);
      await expect(page.getByRole("complementary", { name: "Gaveta do lead" })).toHaveCount(0);
      const ficha = page.getByRole("main");
      const topo = page.getByRole("banner");
      await expect(topo.getByRole("button", { name: "Arquivar" })).toBeVisible();
      await expect(topo.getByRole("button", { name: "Mais ações" })).toBeVisible();

      const campo = ficha.getByRole("textbox", { name: "Mensagem" });
      const enviar = ficha.getByRole("button", { name: "Enviar" });
      await expect(campo).toBeInViewport({ ratio: 1 });
      await expect(enviar).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      const alturaAntes = (await campo.boundingBox())!.height;
      await campo.click();
      await campo.pressSequentially("Primeira linha");
      await campo.press("Shift+Enter");
      await campo.pressSequentially("Segunda linha");
      await campo.press("Shift+Enter");
      await campo.pressSequentially("Terceira linha");
      await expect(campo).toHaveValue("Primeira linha\nSegunda linha\nTerceira linha");
      expect((await campo.boundingBox())!.height).toBeGreaterThan(alturaAntes);
      await expect(enviar).toBeInViewport({ ratio: 1 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${PASTA}/ficha-${nome}.png` });

      await campo.fill("");
      await ficha.getByLabel("Modelo aprovado").selectOption({ label: "Modelo: Primeiro contato" });
      await expect(ficha.getByLabel("Prévia do modelo")).toBeInViewport({ ratio: 1 });
      await expect(enviar).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${PASTA}/ficha-modelo-${nome}.png` });
    });
  });
}
