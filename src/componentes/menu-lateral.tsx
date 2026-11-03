"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Archive, BarChart3, CalendarDays, Images, KanbanSquare, PanelLeftClose, PanelLeftOpen, Settings, Smartphone } from "lucide-react";
import { juntar } from "./estilos";
import { usePode } from "./usuario";

export const LINKS = [
  { href: "/", rotulo: "Kanban", icone: KanbanSquare },
  { href: "/agenda", rotulo: "Agenda", icone: CalendarDays },
  { href: "/painel", rotulo: "Painel", icone: BarChart3 },
  { href: "/galeria", rotulo: "Galeria", icone: Images },
  { href: "/simulador", rotulo: "Simulador", icone: Smartphone },
  { href: "/arquivados", rotulo: "Arquivados", icone: Archive },
];
export const LINK_CONFIG = { href: "/configuracoes", rotulo: "Configurações", icone: Settings };

const CHAVE_MINI = "menu-mini";
const ALTURA_ITEM = 42; // px; o indicador desliza de 44 em 44 (item + espaço de 2)

/** Menu lateral (computador) com indicador que desliza e opção de encolher; no celular vira a barra de baixo. */
export function MenuLateral({ simulador = true }: { simulador?: boolean }) {
  const caminho = usePathname();
  const podeConfigurar = usePode("configurar");
  const links = simulador ? LINKS : LINKS.filter((l) => l.href !== "/simulador");
  const [mini, setMini] = useState(false);

  // Começa encolhido em telas estreitas; depois vale a escolha da pessoa.
  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(CHAVE_MINI);
    } catch {
      // Sem armazenamento: usa só a largura da tela.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende da largura da tela, só existe no navegador
    setMini(guardado !== null ? guardado === "1" : window.innerWidth < 1100);
  }, []);

  function alternar() {
    const novo = !mini;
    setMini(novo);
    try {
      localStorage.setItem(CHAVE_MINI, novo ? "1" : "0");
    } catch {
      // Vale só nesta visita.
    }
  }

  const ativo = (href: string) => (href === "/" ? caminho === "/" || caminho.startsWith("/lead") : caminho.startsWith(href));
  const todos = podeConfigurar ? [...links, LINK_CONFIG] : links;
  const indice = links.findIndex((l) => ativo(l.href));
  const rotuloClasse = juntar("whitespace-nowrap transition-opacity duration-150 ease-out", mini && "pointer-events-none opacity-0");

  return (
    <>
      <aside
        aria-label="Módulos"
        className={juntar(
          "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col gap-1.5 overflow-hidden border-r border-borda bg-lateral px-2.5 py-3 transition-[width] duration-300 ease-mola md:flex",
          mini ? "w-16" : "w-54",
        )}
      >
        <Link href="/" className="flex items-center gap-2.5 px-1 pb-3" aria-label="Eccellenza – início">
          <span className="tecla-pri inline-flex size-9 shrink-0 items-center justify-center rounded-controle text-sm font-bold text-sobre-marca" style={{ boxShadow: "0 3px 0 var(--color-marca-lado), inset 0 1px 0 rgb(255 255 255 / 0.35)" }}>
            E
          </span>
          <span className={juntar("font-semibold text-marca-texto", rotuloClasse)}>Eccellenza</span>
        </Link>

        <nav className="relative grid gap-0.5" aria-label="Principal">
          {indice >= 0 && (
            <div
              aria-hidden
              className="afundado pointer-events-none absolute inset-x-0 top-0 z-0 rounded-controle transition-transform duration-300 ease-mola"
              style={{ height: ALTURA_ITEM, transform: `translateY(${indice * (ALTURA_ITEM + 2)}px)` }}
            />
          )}
          {links.map(({ href, rotulo, icone: Icone }) => (
            <Link
              key={href}
              href={href}
              title={rotulo}
              aria-current={ativo(href) ? "page" : undefined}
              style={{ height: ALTURA_ITEM }}
              className={juntar(
                "relative z-10 flex items-center gap-3 rounded-controle px-[11px] text-sm font-medium transition-colors duration-150",
                ativo(href) ? "text-sobre-marca" : "text-texto-suave hover:text-texto",
              )}
            >
              <Icone className="size-5 shrink-0" aria-hidden />
              <span className={rotuloClasse}>{rotulo}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto grid gap-0.5">
          <button
            type="button"
            onClick={alternar}
            title={mini ? "Abrir o menu" : "Encolher o menu"}
            aria-label={mini ? "Abrir o menu" : "Encolher o menu"}
            aria-expanded={!mini}
            className="flex h-10 items-center gap-3 rounded-controle px-[11px] text-sm text-texto-suave transition hover:bg-superficie hover:text-texto"
          >
            {mini ? <PanelLeftOpen className="size-5 shrink-0" aria-hidden /> : <PanelLeftClose className="size-5 shrink-0" aria-hidden />}
            <span className={rotuloClasse}>Encolher menu</span>
          </button>
          {podeConfigurar && (
            <Link
              href={LINK_CONFIG.href}
              title={LINK_CONFIG.rotulo}
              aria-current={ativo(LINK_CONFIG.href) ? "page" : undefined}
              className={juntar(
                "flex h-10 items-center gap-3 rounded-controle px-[11px] text-sm transition",
                ativo(LINK_CONFIG.href) ? "afundado" : "text-texto-suave hover:bg-superficie hover:text-texto",
              )}
            >
              <Settings className="size-5 shrink-0" aria-hidden />
              <span className={rotuloClasse}>{LINK_CONFIG.rotulo}</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Navegação inferior no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-borda bg-lateral md:hidden" style={{ gridTemplateColumns: `repeat(${todos.length}, minmax(0, 1fr))` }} aria-label="Principal (celular)">
        {todos.map(({ href, rotulo, icone: Icone }) => (
          <Link
            key={href}
            href={href}
            aria-current={ativo(href) ? "page" : undefined}
            className={juntar("flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium", ativo(href) ? "text-marca-texto" : "text-texto-suave")}
          >
            <Icone className="size-5" aria-hidden />
            {rotulo}
          </Link>
        ))}
      </nav>
    </>
  );
}
