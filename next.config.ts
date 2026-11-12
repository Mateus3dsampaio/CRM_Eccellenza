import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Versão do sistema (package.json), mostrada no pé da tela de login.
const versao: string = JSON.parse(readFileSync("package.json", "utf8")).version;

const nextConfig: NextConfig = {
  // O SDK da Anthropic e o Prisma rodam só no servidor.
  serverExternalPackages: ["@prisma/client", "@anthropic-ai/sdk"],
  // Esconde o botão de desenvolvedor do Next, que cobre a navegação do celular.
  devIndicators: false,
  env: { NEXT_PUBLIC_VERSAO: versao },
  // Cabeçalhos de segurança básicos. (CSP completa fica de fora: o Next usa scripts internos e exigiria ajuste fino.)
  async headers() {
    return [
      {
        // O service worker nunca fica em cache: uma versão nova vale na próxima abertura.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=15552000" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
