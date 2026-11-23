// Gaveta e ficha completa (arranjo de 09/11/2026): a gaveta mostra o que pede ação agora, uma linha do cliente e a
// conversa (resumo recolhido, atalhos de agendar/lembrete/nota); a ficha tem a conversa e uma coluna em ordem de
// prioridade que recolhe. Prévia de modelo inteira com o Enviar à vista, sem rolar a página. Só no computador.
import { expect, test, type Page } from "@playwright/test";

const PASTA = "docs/rodadas/evidencias/telas";

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("mateus");
  await page.getByLabel("Senha", { exact: true }).fill("mateus123");
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

    test("gaveta: pílulas do que pede ação, resumo recolhido, atalhos e modelo longo com Enviar à vista", async ({ page }) => {
      await entrar(page);
      // Bruno (seed) tem visita à loja e lembrete marcados: viram pílulas no topo da gaveta.
      await page.getByRole("link", { name: /Abrir ficha de Bruno/ }).first().click();
      const gaveta = page.getByRole("complementary", { name: "Gaveta do lead" });
      const resumo = gaveta.getByRole("button", { name: "Ver resumo" });
      await expect(resumo).toBeVisible();
      await expect(resumo).toHaveAttribute("aria-expanded", "false");
      await expect(gaveta.getByRole("button", { name: /Etapa: .*Trocar etapa/ })).toBeVisible();
      const pilulaVisita = gaveta.getByRole("button", { name: /Visita à loja/ });
      await expect(pilulaVisita).toBeVisible();
      for (const atalho of ["Agendar", "Lembrete", "Nota"]) await expect(gaveta.getByRole("button", { name: atalho, exact: true })).toBeVisible();
      const enviar = gaveta.getByRole("button", { name: "Enviar" });
      await expect(enviar).toBeInViewport({ ratio: 1 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${PASTA}/gaveta-${nome}.png` });

      // A pílula abre a linha com as ações daquele compromisso.
      await pilulaVisita.click();
      await expect(gaveta.getByRole("button", { name: "Remarcar" })).toBeVisible();
      await pilulaVisita.click();

      await resumo.click();
      await expect(gaveta.getByRole("button", { name: "Copiar resumo" })).toBeVisible();
      await expect(enviar).toBeInViewport({ ratio: 1 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${PASTA}/gaveta-resumo-aberto-${nome}.png` });
      await gaveta.getByRole("button", { name: "Fechar resumo" }).click();

      await gaveta.getByLabel("Modelo aprovado").selectOption({ label: "Modelo: Primeiro contato" });
      const previa = gaveta.getByLabel("Prévia do modelo");
      await expect(previa).toContainText("Gostaria de");
      await expect(previa).toBeInViewport({ ratio: 1 });
      await expect(enviar).toBeInViewport({ ratio: 1 });
      await expect(enviar).toBeEnabled();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${PASTA}/gaveta-modelo-${nome}.png` });
    });

    test("ficha completa: próximo passo em destaque, coluna que recolhe, caixa de texto que cresce e envio sem rolar a página", async ({ page }) => {
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
      // A etapa é um botão: na barra de cima a partir de 1440px; abaixo disso, na linha das abas da conversa.
      await expect((tela.width >= 1440 ? topo : ficha).getByRole("button", { name: /Etapa: .*Trocar etapa/ })).toBeVisible();
      // Coluna da direita em ordem de prioridade; recolhida, a conversa ocupa a tela e as urgências viram ícones.
      const coluna = page.getByRole("complementary", { name: "Ficha do cliente" });
      await expect(coluna.getByRole("heading", { name: "Próximo passo" })).toBeVisible();
      await expect(coluna.getByRole("heading", { name: "Cliente" })).toBeVisible();
      await coluna.getByRole("button", { name: "Recolher a ficha" }).click();
      await expect(coluna).toHaveCount(0);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${PASTA}/ficha-recolhida-${nome}.png` });
      await page.getByRole("button", { name: "Mostrar a ficha" }).click();
      await expect(coluna.getByRole("heading", { name: "Próximo passo" })).toBeVisible();

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
