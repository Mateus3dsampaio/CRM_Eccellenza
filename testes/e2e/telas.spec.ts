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
  await expect(page.getByRole("heading", { name: "IA atendendo" })).toBeVisible();
  await expect(page.getByText(/\d+ conversas?/).first()).toBeVisible();
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  await semRolagemLateral(page);
  await page.screenshot({ path: `${PASTA}/${info.project.name}-kanban.png`, fullPage: true });
});

test("menu Mover para... move o card", async ({ page }, info) => {
  await entrar(page);
  if (info.project.name === "celular") await page.getByRole("tab", { name: /IA atendendo/ }).click();
  const coluna = page.getByRole("region", { name: "IA atendendo" });
  const nome = (await coluna.locator("[data-card] p.font-semibold").first().textContent())!;
  await coluna.getByRole("button", { name: `Ações para ${nome}`, exact: true }).click();
  await page.screenshot({ path: `${PASTA}/${info.project.name}-mover-para.png` });
  await page.getByRole("menuitem", { name: "Negociação" }).click();
  // Negociação exige o próximo contato: a janela abre e o card só muda ao confirmar (Bloco 2).
  const janela = page.getByRole("dialog", { name: /Negociação/ });
  await expect(janela).toBeVisible();
  await page.screenshot({ path: `${PASTA}/${info.project.name}-janela-negociacao.png` });
  await janela.getByLabel("Próximo contato em").fill("2030-01-10");
  await janela.getByLabel("Hora").fill("14:30");
  await janela.getByRole("textbox", { name: /Valor do orçamento/ }).fill("1621");
  await janela.getByRole("button", { name: "Mover" }).click();
  if (info.project.name === "celular") await page.getByRole("tab", { name: /Negociação/ }).click();
  await expect(page.getByRole("region", { name: "Negociação" }).getByText(nome)).toBeVisible();
  // Devolve para não alterar os dados dos outros testes.
  await page.getByRole("region", { name: "Negociação" }).getByRole("button", { name: `Ações para ${nome}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "IA atendendo" }).click();
});

test("Retornos de hoje: lista no topo e card atrasado destacado", async ({ page }, info) => {
  await entrar(page);
  if (info.project.name === "celular") await page.getByRole("tab", { name: /Negociação/ }).click();
  // Retorno vencido na Negociação: a faixa do card vira a decisão (tarefa 39), em âmbar, e não repete "retorno atrasado".
  const faixa = page.getByRole("group", { name: "Diego Nascimento" }).locator("[data-acao]");
  await expect(faixa).toHaveAttribute("data-acao", /responder_atrasado|decidir/);
  await expect(page.getByRole("group", { name: "Diego Nascimento" }).getByText(/Decidir: fechou\?|\+1/).first()).toBeVisible();
  await page.getByRole("button", { name: /retornos? de hoje/ }).click();
  const lista = page.getByRole("dialog", { name: "Retornos de hoje" });
  await expect(lista.getByText("Diego Nascimento")).toBeVisible();
  await page.screenshot({ path: `${PASTA}/${info.project.name}-retornos.png` });
});

test("Configurações > Vendas: cria motivo, aparece na janela de Perdido e o interruptor da Negociação muda a janela", async ({ page }, info) => {
  await entrar(page);
  await page.goto("/configuracoes");
  await page.getByRole("tab", { name: "Vendas" }).click();
  await page.getByRole("button", { name: "Novo motivo" }).click();
  await page.getByLabel("Nome do motivo").fill("Sem crédito (teste)");
  await page.getByLabel("Pergunta extra (opcional)").fill("Qual banco?");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Sem crédito (teste)")).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: `${PASTA}/${info.project.name}-config-vendas.png`, fullPage: true });
  // Desliga a exigência em Negociação: a janela passa a dizer "(opcional)".
  const caixa = page.getByRole("checkbox", { name: /Exigir "Próximo contato em"/ });
  await caixa.uncheck();
  await expect(page.getByText(/Desligado:/)).toBeVisible();
  await page.goto("/");
  if (info.project.name === "celular") await page.getByRole("tab", { name: /IA atendendo/ }).click();
  const coluna = page.getByRole("region", { name: "IA atendendo" });
  const nome = (await coluna.locator("[data-card] p.font-semibold").first().textContent())!;
  await coluna.getByRole("button", { name: `Ações para ${nome}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Negociação" }).click();
  await expect(page.getByRole("dialog", { name: /Negociação/ }).getByText("Próximo contato em (opcional)")).toBeVisible();
  await page.getByRole("dialog", { name: /Negociação/ }).getByRole("button", { name: "Cancelar" }).click();
  await coluna.getByRole("button", { name: `Ações para ${nome}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Perdido" }).click();
  await page.getByRole("dialog", { name: /Perdido/ }).getByRole("combobox").selectOption({ label: "Sem crédito (teste)" });
  await expect(page.getByRole("dialog", { name: /Perdido/ }).getByLabel("Qual banco?")).toBeVisible();
  await page.getByRole("dialog", { name: /Perdido/ }).getByRole("button", { name: "Cancelar" }).click();
  // Devolve as configurações ao que eram.
  await page.goto("/configuracoes");
  await page.getByRole("tab", { name: "Vendas" }).click();
  await page.getByRole("checkbox", { name: /Exigir "Próximo contato em"/ }).check();
  await page.getByRole("button", { name: "Excluir Sem crédito (teste)" }).click();
  await page.getByRole("dialog", { name: "Excluir motivo" }).getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("Sem crédito (teste)")).toHaveCount(0);
});

test("Perdido pede o motivo e cancelar não move o card", async ({ page }, info) => {
  await entrar(page);
  if (info.project.name === "celular") await page.getByRole("tab", { name: /IA atendendo/ }).click();
  const coluna = page.getByRole("region", { name: "IA atendendo" });
  const nome = (await coluna.locator("[data-card] p.font-semibold").first().textContent())!;
  await coluna.getByRole("button", { name: `Ações para ${nome}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Perdido" }).click();
  const janela = page.getByRole("dialog", { name: /Perdido/ });
  await janela.getByRole("combobox").selectOption("concorrente");
  await expect(janela.getByLabel("Qual concorrente?")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${PASTA}/${info.project.name}-janela-perdido.png` });
  await janela.getByRole("button", { name: "Cancelar" }).click();
  await expect(coluna.getByText(nome).first()).toBeVisible();
});

test("ficha do lead, agenda, painel, simulador e arquivados abrem sem quebrar", async ({ page }, info) => {
  await entrar(page);
  if (info.project.name === "celular") await page.getByRole("tab", { name: /Apresentação agendada/ }).click();
  await page.getByRole("link", { name: /Abrir ficha de Patrícia/ }).first().click();
  // Tarefa 23: o card abre a gaveta por cima do kanban, com ?lead= na URL (F5 reabre).
  const gaveta = page.getByRole("complementary", { name: "Gaveta do lead" });
  await expect(gaveta.getByText("Resumo para o consultor")).toBeVisible();
  await expect(page).toHaveURL(/\?lead=/);
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Gaveta do lead" }).getByText("Resumo para o consultor")).toBeVisible();
  await page.screenshot({ path: `${PASTA}/${info.project.name}-gaveta.png` });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Gaveta do lead" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/\?lead=/);
  // No celular o reload volta o kanban para a primeira aba: escolhe a etapa de novo.
  if (info.project.name === "celular") await page.getByRole("tab", { name: /Apresentação agendada/ }).click();
  await page.getByRole("link", { name: /Abrir ficha de Patrícia/ }).first().click();
  await page.getByRole("complementary", { name: "Gaveta do lead" }).getByRole("link", { name: "Abrir ficha completa" }).click();
  await page.waitForURL(/\/lead\//);
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

test("tarefas 33 e 39: coluna com vários atrasos só destaca um card crítico", async ({ page }, info) => {
  // Seed: em "Em qualificação", Fernanda espera ~23 h, Roberto ~46 h e Juliana ~48 h (todos no vermelho).
  // Regra (regras/espera.ts, tarefa 39): crítico = só o mais antigo da coluna. Os outros ficam parados, com a faixa vermelha.
  await entrar(page);
  if (info.project.name === "celular") await page.getByRole("tab", { name: /Em qualificação/ }).click();
  const coluna = page.getByRole("region", { name: "Em qualificação" });
  await expect(coluna.locator("[data-card]").first()).toBeVisible();
  await expect(coluna.locator('[data-espera="vermelho"]')).not.toHaveCount(0);
  await expect(coluna.getByRole("group", { name: "Fernanda Lima" })).toHaveAttribute("data-espera", "vermelho");
  await expect(coluna.getByRole("group", { name: "Fernanda Lima" })).not.toHaveAttribute("data-critico", /.*/);
  await expect(coluna.getByRole("group", { name: "Arq. Juliana Moreira" })).toHaveAttribute("data-critico", "true");
  await expect(coluna.locator("[data-critico]")).toHaveCount(1);
  await expect(coluna.getByRole("group", { name: "Roberto Alves" }).locator("[data-acao]")).toHaveAttribute("data-cor", "vermelho");
  // Nada no card pisca: só o crítico pulsa.
  await expect(coluna.locator(".animate-piscar")).toHaveCount(0);
  await page.waitForTimeout(400);
  await coluna.screenshot({ path: `${PASTA}/${info.project.name}-cards-espera.png` });
});
