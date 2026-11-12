import type { ReactNode } from "react";
import { MenuEsfera } from "./menu-esfera";

/**
 * Moldura das páginas públicas (Privacidade, Exclusão de dados): a cara do login, parada.
 * Fundo com a luz da marca preso na janela, o nome em caixa alta com a esfera de pontos e o texto num cartão de vidro.
 * Só a moldura: o texto vem de quem usa (regras/privacidade.ts).
 */
export function PaginaPublica({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="login-fundo pointer-events-none fixed inset-0" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-center gap-3">
          <MenuEsfera tamanho={36} parada />
          <span className="pl-[0.16em] text-xl font-extrabold tracking-[0.16em]">ECCELLENZA</span>
        </div>
        <main className="vidro rounded-painel p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
