import type { MetadataRoute } from "next";

/** Manifesto do app instalável (PWA). Sem service worker e sem avisos: só ícone na tela inicial e tela cheia. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eccellenza CRM",
    short_name: "Eccellenza",
    description: "CRM de atendimento da Eccellenza.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e131a",
    theme_color: "#0e131a",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
