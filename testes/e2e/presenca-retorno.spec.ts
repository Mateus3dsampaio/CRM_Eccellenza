// Testes de tela das tarefas 35 (presença e fila da loja fechada) e 36 (retorno com a loja fechada).
// Rode com o seed carregado: npm run seed && npx playwright test testes/e2e/presenca-retorno.spec.ts --project=computador
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASTA = "docs/rodadas/evidencias/telas";

async function entrar(page: Page, login = "mateus", senha = "mateus123") {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(login);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

async function definirStatus(request: APIRequestContext, usuarioId: string | undefined, status: "online" | "almoco" | "offline") {
  const r = await request.post("/api/equipe/status", { data: { usuarioId, status } });
  expect(r.ok()).toBe(true);
}

async function idDoConsultor(request: APIRequestContext, nome: string): Promise<string> {
  const r = await request.get("/api/configuracoes");
  const { equipe } = (await r.json()) as { equipe: { id: string; nome: string }[] };
  const achado = equipe.find((u) => u.nome.startsWith(nome));
  if (!achado) throw new Error(`Consultor ${nome} não existe no seed.`);
  return achado.id;
}

// Só no computador: o aparelho principal é o PC (CLAUDE.md) e o cabeçalho do celular esconde os rótulos.
test.beforeEach(({}, info) => test.skip(info.project.name !== "computador", "Tarefas 35 e 36: só no computador."));

test("consultor fica offline e volta online pelo cabeçalho (tarefa 35)", async ({ page }, info) => {
  await entrar(page, "rafael", "rafael123");
  // O consultor muda o próprio status (sem informar o id).
  await definirStatus(page.request, undefined, "online");
  await page.reload();
  await expect(page.getByRole("button", { name: "Almoço" })).toBeVisible();
  await page.getByRole("button", { name: "Offline", exact: true }).click();
  const online = page.getByRole("button", { name: "Ficar online" });
  await expect(online).toBeVisible();
  // Offline não mostra o almoço (só faz sentido quem está trabalhando).
  await expect(page.getByRole("button", { name: "Almoço" })).toHaveCount(0);
  await page.screenshot({ path: `${PASTA}/${info.project.name}-presenca-offline.png` });
  await online.click();
  await expect(page.getByRole("button", { name: "Almoço" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ficar online" })).toHaveCount(0);
});

test("admin vê os cartões Presença e fila e Retorno com a loja fechada; opção dependente esmaece (tarefas 35 e 36)", async ({ page }, info) => {
  await entrar(page);
  await page.goto("/configuracoes");
  const presenca = page.getByRole("heading", { name: "Presença e fila" });
  await expect(presenca).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retorno com a loja fechada" })).toBeVisible();

  const quandoRepartir = page.getByLabel("Quando repartir");
  await expect(quandoRepartir).toBeEnabled();
  await page.getByLabel("Repartir a fila acumulada com a loja fechada").uncheck();
  await expect(quandoRepartir).toBeDisabled();
  await page.getByLabel("Repartir a fila acumulada com a loja fechada").check();
  await expect(quandoRepartir).toBeEnabled();

  const modelo = page.getByLabel("Qual modelo usar");
  await expect(modelo).toBeEnabled();
  await page.getByLabel("Enviar o modelo de retorno automaticamente").uncheck();
  await expect(modelo).toBeDisabled();
  await expect(page.getByText("o vendedor recebe o aviso do retorno e envia o modelo pela conversa")).toBeVisible();
  await page.getByLabel("Enviar o modelo de retorno automaticamente").check();
  await expect(modelo).toBeEnabled();
  await page.screenshot({ path: `${PASTA}/${info.project.name}-config-presenca-retorno.png`, fullPage: true });
});

test("vendedor offline aparece na Equipe com 'Passar os de hoje' (tarefa 35)", async ({ page }, info) => {
  await entrar(page);
  const rafael = await idDoConsultor(page.request, "Rafael");
  await definirStatus(page.request, rafael, "offline");
  try {
    await page.goto("/configuracoes?secao=equipe");
    const linha = page.getByRole("listitem").filter({ hasText: "Rafael" });
    await expect(linha.getByText("Offline", { exact: true })).toBeVisible();
    await linha.getByRole("button", { name: "Passar os de hoje" }).click();
    const janela = page.getByRole("dialog", { name: "Passar os de hoje" });
    await expect(janela.getByText(/tem hoje:/)).toBeVisible();
    await expect(janela.getByRole("combobox")).toBeVisible();
    // Sem escolher o vendedor (ou sem nada para passar) o botão não deixa confirmar.
    await expect(janela.getByRole("button", { name: /^Passar \d+ leads?$/ })).toBeDisabled();
    await page.screenshot({ path: `${PASTA}/${info.project.name}-passar-os-de-hoje.png` });
    await janela.getByRole("button", { name: "Cancelar" }).click();
    await expect(janela).toHaveCount(0);
    await linha.getByRole("button", { name: "Colocar online" }).click();
    await expect(linha.getByText("Online", { exact: true })).toBeVisible();
  } finally {
    await definirStatus(page.request, rafael, "online");
  }
});

test("modelo de retorno mostra os botões no simulador e 'Não tenho interesse' vale como parar (tarefa 36)", async ({ page }, info) => {
  await entrar(page);
  const telefone = `+558890009${String(Math.floor(Math.random() * 9000) + 1000)}`;
  // Cliente simulado escreve; o consultor (admin) manda o modelo de retorno pela conversa, como se a janela de 24h tivesse fechado.
  const form = { multipart: { telefone, texto: "Oi, quero uma cozinha planejada" } };
  await page.request.post("/api/simulador", form);
  const dados = (await (await page.request.get(`/api/simulador?telefone=${encodeURIComponent(telefone)}`)).json()) as { conversa?: { leadId: string } };
  const leadId = dados.conversa!.leadId;
  const envio = await page.request.post(`/api/leads/${leadId}/conversa`, { data: { acao: "responder", modelo: "retorno_atendimento" } });
  expect(envio.ok()).toBe(true);

  await page.goto("/simulador");
  await page.getByText(/Olá! Aqui é da Eccellenza Móveis Planejados\. Recebemos seu contato/).first().click();
  const continuar = page.getByRole("button", { name: "Quero continuar" });
  const semInteresse = page.getByRole("button", { name: "Não tenho interesse" });
  await expect(continuar).toBeVisible();
  await expect(semInteresse).toBeVisible();
  await page.screenshot({ path: `${PASTA}/${info.project.name}-modelo-retorno-botoes.png` });
  await semInteresse.click();
  await expect(page.locator("p", { hasText: "Você não vai mais receber mensagens automáticas nossas" })).toBeVisible();
  // Depois da resposta os botões somem.
  await expect(page.getByRole("button", { name: "Não tenho interesse" })).toHaveCount(0);
  await page.screenshot({ path: `${PASTA}/${info.project.name}-modelo-retorno-parar.png` });
});
