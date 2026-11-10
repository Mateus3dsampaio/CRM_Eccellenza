"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Archive, BarChart3, CalendarDays, Images, KanbanSquare, PanelLeftClose, PanelLeftOpen, Settings, Smartphone } from "lucide-react";
import { juntar } from "./estilos";
import { Entalhe } from "./entalhe/entalhe";
import { MenuEsfera } from "./menu-esfera";
import { usePode } from "./usuario";

// Grupos (tarefa 32): 1 = trabalho do dia, 2 = arquivo, 3 = ferramenta de teste. Um traço separa os grupos no menu.
export const LINKS = [
  { href: "/", rotulo: "Kanban", icone: KanbanSquare, grupo: 1 },
  { href: "/agenda", rotulo: "Agenda", icone: CalendarDays, grupo: 1 },
  { href: "/painel", rotulo: "Painel", icone: BarChart3, grupo: 1 },
  { href: "/galeria", rotulo: "Galeria", icone: Images, grupo: 1 },
  { href: "/arquivados", rotulo: "Arquivados", icone: Archive, grupo: 2 },
  { href: "/simulador", rotulo: "Simulador", icone: Smartphone, grupo: 3 },
];
export const LINK_CONFIG = {
  href: "/configuracoes",
  rotulo: "Configurações",
  icone: Settings,
};

const CHAVE_MINI = "menu-mini";
const ALTURA_ITEM = 42; // px

/** Menu lateral (computador) com indicador que desliza e opção de encolher; no celular vira a barra de baixo. */
export function MenuLateral({ simulador = true }: { simulador?: boolean }) {
  const caminho = usePathname();
  const podeConfigurar = usePode("configurar");
  const podeVerPainel = usePode("ver_metricas");
  // O Painel é só do administrador; o simulador só aparece no modo simulador.
  const links = LINKS.filter((l) => (simulador || l.href !== "/simulador") && (podeVerPainel || l.href !== "/painel"));
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
  // Itens do computador na ordem em que aparecem (a engrenagem fica embaixo); o entalhe flutuante anda entre eles.
  const itensDesktop = podeConfigurar ? [...links, LINK_CONFIG] : links;
  const indice = itensDesktop.findIndex((l) => ativo(l.href));
  const asideRef = useRef<HTMLElement>(null);
  const itensRef = useRef<(HTMLElement | null)[]>([]);
  const movelRef = useRef<HTMLDivElement>(null);
  const itensMovelRef = useRef<(HTMLElement | null)[]>([]);
  const rotuloClasse = juntar("whitespace-nowrap transition-opacity duration-150 ease-out", mini && "pointer-events-none opacity-0");
  // O indicador anda por cima da barra toda (inclui Configurações, no rodapé): a posição vem do próprio item ativo,
  // medida em relação à barra. Mede de novo quando a barra muda de tamanho (encolher, altura da janela).
  const [topoAtivo, setTopoAtivo] = useState<number | null>(null);
  const medirAtivo = () => {
    const el = itensRef.current[indice];
    const raiz = asideRef.current;
    if (!el || !raiz) return;
    setTopoAtivo(el.getBoundingClientRect().top - raiz.getBoundingClientRect().top);
  };
  const medirAtivoRef = useRef(medirAtivo);
  useLayoutEffect(() => {
    medirAtivoRef.current = medirAtivo;
    medirAtivo();
  });
  useEffect(() => {
    const raiz = asideRef.current;
    if (!raiz) return;
    const obs = new ResizeObserver(() => medirAtivoRef.current());
    obs.observe(raiz);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <aside
        ref={asideRef}
        aria-label="Módulos"
        className={juntar(
          "menu-fundo sticky top-0 z-40 hidden h-dvh shrink-0 flex-col gap-1.5 overflow-hidden border-r border-borda bg-lateral px-2.5 py-3 transition-[width] duration-300 ease-mola md:flex",
          mini ? "w-16" : "w-54",
        )}
      >
        <Link href="/" className="flex items-center gap-2.5 px-1 pb-3" aria-label="Eccellenza – início">
          <span className="relative inline-flex size-9 shrink-0 items-center justify-center">
            {/* Brilho suave atrás da esfera, como o halo do login. */}
            <span aria-hidden className="absolute inset-0 rounded-full bg-marca/30 blur-md" />
            <MenuEsfera tamanho={36} className="relative" />
          </span>
          <span className={juntar("text-[13px] font-extrabold tracking-[0.16em] text-texto", rotuloClasse)}>ECCELLENZA</span>
        </Link>

        {/* Menu aberto: o indicador afundado (com luz e filete da marca) desliza entre os links e Configurações. */}
        {!mini && indice >= 0 && topoAtivo !== null && (
          <div
            aria-hidden
            className="afundado menu-ativo pointer-events-none absolute inset-x-2.5 top-0 z-0 rounded-controle transition-transform duration-300 ease-mola"
            style={{ height: ALTURA_ITEM, transform: `translateY(${topoAtivo}px)` }}
          >
            <span className="menu-ativo-filete" />
          </div>
        )}

        <nav className="relative grid grid-cols-[minmax(0,1fr)] gap-0.5" aria-label="Principal">
          {/* Menu encolhido: entra o entalhe flutuante (mais abaixo). */}
          {links.map(({ href, rotulo, icone: Icone, grupo }, i) => (
            <Link
              key={href}
              data-grupo={grupo}
              // Traço antes do primeiro item de cada grupo novo (menu aberto: borda; encolhido: espaço maior).
              style={{ height: ALTURA_ITEM, ...(i > 0 && links[i - 1].grupo !== grupo ? { marginTop: mini ? 10 : 14 } : {}) }}
              ref={(el) => {
                itensRef.current[i] = el;
              }}
              href={href}
              title={rotulo}
              aria-current={ativo(href) ? "page" : undefined}
              className={juntar(
                "relative z-10 flex items-center gap-3 rounded-controle px-[11px] text-sm font-medium transition-colors duration-150",
                i > 0 && links[i - 1].grupo !== grupo && !mini && "antes-traco",
                ativo(href) ? "text-sobre-marca" : "text-texto-suave hover:text-texto",
              )}
            >
              <Icone className="size-5 shrink-0" aria-hidden />
              <span className={rotuloClasse}>{rotulo}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto grid grid-cols-[minmax(0,1fr)] gap-0.5">
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
              ref={(el) => {
                itensRef.current[links.length] = el;
              }}
              title={LINK_CONFIG.rotulo}
              aria-current={ativo(LINK_CONFIG.href) ? "page" : undefined}
              className={juntar(
                "relative z-10 flex items-center gap-3 rounded-controle px-[11px] text-sm transition",
                ativo(LINK_CONFIG.href) ? "text-sobre-marca" : "text-texto-suave hover:bg-superficie hover:text-texto",
              )}
              style={{ height: ALTURA_ITEM }}
            >
              <Settings className="size-5 shrink-0" aria-hidden />
              <span className={rotuloClasse}>{LINK_CONFIG.rotulo}</span>
            </Link>
          )}
        </div>

        {mini && (
          <Entalhe
            raiz={asideRef}
            itens={itensRef}
            indice={indice}
            orientacao="vertical"
            fundo="var(--color-fundo)"
            classePilula="flex items-center gap-3 px-[11px] text-sm font-medium"
            conteudo={(i) => {
              const item = itensDesktop[i];
              if (!item) return null;
              const Icone = item.icone;
              return (
                <>
                  <Icone className="size-5 shrink-0" aria-hidden />
                  <span className={rotuloClasse}>{item.rotulo}</span>
                </>
              );
            }}
          />
        )}
      </aside>

      {/* Navegação inferior no celular: a bolinha sai do entalhe e pousa no item ativo. O espaço de cima é transparente e não pega clique. */}
      <div ref={movelRef} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pt-8 md:hidden">
        <nav
          className="pointer-events-auto grid border-t border-borda bg-lateral pb-[env(safe-area-inset-bottom)]"
          style={{
            gridTemplateColumns: `repeat(${todos.length}, minmax(0, 1fr))`,
          }}
          aria-label="Principal (celular)"
        >
          {todos.map(({ href, rotulo, icone: Icone }, i) => (
            <Link
              key={href}
              ref={(el) => {
                itensMovelRef.current[i] = el;
              }}
              href={href}
              aria-current={ativo(href) ? "page" : undefined}
              className={juntar("flex min-h-[60px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors", ativo(href) ? "text-marca-texto" : "text-texto-suave")}
            >
              <Icone data-icone className="size-5" aria-hidden />
              {href === LINK_CONFIG.href ? "Config." : rotulo}
            </Link>
          ))}
        </nav>
        <Entalhe
          raiz={movelRef}
          itens={itensMovelRef}
          indice={todos.findIndex((l) => ativo(l.href))}
          orientacao="horizontal"
          variante="bola"
          soIcone
          borda={32}
          fundo="var(--color-fundo)"
          classePilula="flex items-center justify-center"
          conteudo={(i) => {
            const Icone = todos[i]?.icone;
            return Icone ? <Icone className="size-5" aria-hidden /> : null;
          }}
        />
      </div>
    </>
  );
}
