// Roda ANTES do seed: o seed apaga todos os dados e cria senhas de teste, então nunca pode rodar em produção.
if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
  console.error("Bloqueado: o seed apaga todos os dados e usa senhas de teste. Não roda em produção.");
  process.exit(1);
}
