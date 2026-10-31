import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O SDK da Anthropic e o Prisma rodam só no servidor.
  serverExternalPackages: ["@prisma/client", "@anthropic-ai/sdk"],
  // Esconde o botão de desenvolvedor do Next, que cobre a navegação do celular.
  devIndicators: false,
};

export default nextConfig;
