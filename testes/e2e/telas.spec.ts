// Testes de tela (TEC-04) e prints para os revisores. Rode com o seed carregado: npm run seed && npm run test:tela
import { expect, test, type Page } from "@playwright/test";

const PASTA = "docs/rodadas/evidencias/telas";

// Usuários de teste do seed (fictícios).
async function entrar(page: Page, login = "mateus", senha = "mateus123") {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(login);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

async function semRolagemLateral(page: Page) {
  const larguras = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(larguras[0]).toBeLessThanOrEqual(larguras[1]);
}

test("login e kanban com colunas e contadores", async ({ page }, info) => {
  await page.goto("/login");
  await page.screenshot({ path: `${PASTA}/${info.project.name}-login.png` });
  await entrar(page);
  await expect(page.getByRole("heading", { name: "Novo / bot atendendo" })).toBeVisible();
  await expect(page.getByText(/\d+ conversas?/).first()).toBeVisible();
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  await semRolagemLateral(page);
  await page.screenshot({ path: `${PASTA}/${info.project.name}-kanban.png`, fullPage: true });
});

test("menu Mover para... move o card", async ({ page }, info) => {
  await entrar(page);
  if (info.project.name === "celular") await page.getByRole("tab", { name: /Novo/ }).click();
  const coluna = page.getByRole("region", { name: "Novo / bot atendendo" });
  const nome = (await coluna.locator("[data-card] p.font-semibold").first().textContent())!;
  await coluna.getByRole("button", { name: `Ações para ${nome}`, exact: true }).click();
  await page.screenshot({ path: `${PASTA}/${info.project.name}-mover-para.png` });
  await page.getByRole("menuitem", { name: "Negociação" }).click();
  if (info.project.name === "celular") await page.getByRole("tab", { name: /Negociação/ }).click();
  await expect(page.getByRole("region", { name: "Negociação" }).getByText(nome)).toBeVisible();
  // Devolve para não alterar os dados dos outros testes.
  await page.getByRole("region", { name: "Negociação" }).getByRole("button", { name: `Ações para ${nome}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Novo / bot atendendo" }).click();
});

test("ficha do lead, agenda, painel, simulador e arquivados abrem sem quebrar", async ({ page }, info) => {
  await entrar(page);
  if (info.project.name === "celular") await page.getByRole("tab", { name: /Visita agendada/ }).click();
  await page.getByRole("link", { name: /Abrir ficha de Patrícia/ }).first().click();
  if (info.project.name === "celular") await page.getByRole("tab", { name: "Ficha" }).click();
  await expect(page.getByText("Resumo para o consultor")).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: `${PASTA}/${info.project.name}-ficha.png`, fullPage: true });

  for (const [rota, texto, nome] of [
    ["/agenda", "Agenda", "agenda"],
    ["/painel", "Painel", "painel"],
    ["/simulador", "Clientes simulados", "simulador"],
    ["/arquivados", "Arquivados", "arquivados"],
  ] as const) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { name: texto, level: 1 })).toBeVisible();
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
    await semRolagemLateral(page);
    await page.screenshot({ path: `${PASTA}/${info.project.name}-${nome}.png`, fullPage: true });
  }
});

test("nova mensagem: número novo só aceita modelo aprovado (MSG-02)", async ({ page }, info) => {
  await entrar(page);
  await page.getByRole("button", { name: "Nova mensagem" }).click();
  await page.getByRole("textbox", { name: /^Para/ }).fill("+55 88 90000-7777");
  await expect(page.getByText("Texto livre bloqueado.")).toBeVisible();
  await page.screenshot({ path: `${PASTA}/${info.project.name}-nova-mensagem.png` });
});

test("consultor não vê nem consegue excluir (LIMP-05)", async ({ page }) => {
  await entrar(page, "rafael", "rafael123");
  await expect(page.getByRole("menuitem", { name: "Excluir" })).toHaveCount(0);
  const resposta = await page.request.post("/api/leads/acoes", { data: { acao: "excluir", ids: ["qualquer"] } });
  expect(resposta.status()).toBe(403);
  const limpar = await page.request.post("/api/leads/acoes", { data: { acao: "limpar_coluna", etapa: "perdido", modo: "excluir" } });
  expect(limpar.status()).toBe(403);
});

test("sem login a API recusa (USR-02)", async ({ request }) => {
  expect((await request.get("/api/kanban")).status()).toBe(401);
  expect((await request.get("/api/midias/x.png")).status()).toBe(401);
});
