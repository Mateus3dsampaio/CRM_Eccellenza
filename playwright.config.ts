import { defineConfig, devices } from "@playwright/test";

// Navegador instalado dentro do projeto (node_modules), sem instalar nada no computador.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";

export default defineConfig({
  testDir: "testes/e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", locale: "pt-BR", timezoneId: "America/Fortaleza" },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: { command: "npm run dev", url: "http://127.0.0.1:3000/login", reuseExistingServer: true, timeout: 120_000 },
});
