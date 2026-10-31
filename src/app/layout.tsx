import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--fonte-inter", display: "swap" });

export const metadata: Metadata = {
  title: "CRM Eccellenza – simulador",
  description: "CRM com atendimento por IA para a Eccellenza (simulador, dados fictícios).",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
