import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: {
    include: ["testes/unit/**/*.test.ts"],
    environment: "node",
    globalSetup: ["testes/unit/preparar.ts"],
    env: { CRM_BANCO_TESTE: process.env.CRM_TESTE_POSTGRES ?? "file:./teste.db" },
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
