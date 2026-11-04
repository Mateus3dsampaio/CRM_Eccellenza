import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--fonte-inter", display: "swap" });

export const metadata: Metadata = {
  title: "CRM Eccellenza – simulador",
  description: "CRM com atendimento por IA para a Eccellenza (simulador, dados fictícios).",
  // iPhone: ao adicionar à tela inicial abre em tela cheia, com o nome e o ícone da Eccellenza.
  appleWebApp: { capable: true, title: "Eccellenza", statusBarStyle: "black" },
  icons: { icon: [{ url: "/icone-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
};

// viewportFit "cover": usa a tela toda; a barra de baixo respeita a área segura do iPhone (ver menu-lateral.tsx).
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0e131a" };

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
