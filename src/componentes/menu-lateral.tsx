"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
// Mesma altura dos controles das telas (--spacing-toque): o primeiro item fica na mesma faixa da primeira linha de filtros.
const ALTURA_ITEM = 44; // px

/** Menu lateral (computador) com indicador que desliza (aberto e encolhido) e opção de encolher; no celular vira a barra de baixo. */
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
    setDica(null);
    try {
      localStorage.setItem(CHAVE_MINI, novo ? "1" : "0");
    } catch {
      // Vale só nesta visita.
    }
  }

  const ativo = (href: string) => (href === "/" ? caminho === "/" || caminho.startsWith("/lead") : caminho.startsWith(href));
  const todos = podeConfigurar ? [...links, LINK_CONFIG] : links;
  // Itens do computador na ordem em que aparecem (a engrenagem fica embaixo); o indicador anda entre eles.
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

  // Anel de onda no ícone quando o indicador chega a outro item (não ao abrir a página).
  const [onda, setOnda] = useState(0);
  const indiceAnterior = useRef(indice);
  useEffect(() => {
    if (indiceAnterior.current === indice) return;
    const veioDeOutro = indiceAnterior.current >= 0;
    indiceAnterior.current = indice;
    if (veioDeOutro && indice >= 0) setOnda((n) => n + 1);
  }, [indice]);

  // Menu encolhido: dica em vidro ao lado do ícone (fora da barra, que corta o que passa da borda).
  const [dica, setDica] = useState<{ rotulo: string; topo: number } | null>(null);
  const mostrarDica = (rotulo: string) => (e: { currentTarget: HTMLElement }) => {
    if (!mini) return;
    const caixa = e.currentTarget.getBoundingClientRect();
    setDica({ rotulo, topo: caixa.top + caixa.height / 2 });
  };
  const esconderDica = () => setDica(null);
  const eventosDica = (rotulo: string) => ({ onMouseEnter: mostrarDica(rotulo), onMouseLeave: esconderDica, onFocus: mostrarDica(rotulo), onBlur: esconderDica });

  return (
    <>
      <aside
        ref={asideRef}
        aria-label="Módulos"
        className={juntar(
          "luz-marca-forte sticky top-0 z-40 hidden h-dvh shrink-0 flex-col gap-1.5 overflow-hidden border-r border-borda bg-lateral px-2.5 pb-3 transition-[width] duration-(--tempo-painel) ease-mola md:flex",
          mini ? "w-16" : "w-54",
        )}
      >
        {/* Alinhamento com as telas (PC): a esfera ocupa a altura da barra de cima (mesmo centro dos botões do topo) e o
            primeiro item começa onde começa a primeira linha de controles de cada tela (md:pt-3 depois da linha de 1 px do topo). */}
        <Link href="/" className="mb-[7px] flex h-topo shrink-0 items-center gap-2.5 px-1" aria-label="Eccellenza – início">
          <span className="relative inline-flex size-9 shrink-0 items-center justify-center">
            {/* Brilho suave atrás da esfera, como o halo do login. */}
            <span aria-hidden className="absolute inset-0 rounded-full bg-marca/30 blur-md" />
            <MenuEsfera tamanho={36} className="relative" impulso={caminho} />
          </span>
          <span className={juntar("text-[13px] font-extrabold tracking-[0.16em] text-texto", rotuloClasse)}>ECCELLENZA</span>
        </Link>

        {/* O indicador afundado (com luz e filete da marca) desliza entre os links e Configurações. Encolhido é o mesmo, só mais estreito. */}
        {indice >= 0 && topoAtivo !== null && (
          <div
            aria-hidden
            className="afundado menu-ativo pointer-events-none absolute inset-x-2.5 top-0 z-0 rounded-controle transition-transform duration-(--tempo-painel) ease-mola"
            style={{ height: ALTURA_ITEM, transform: `translateY(${topoAtivo}px)` }}
          >
            <span className="menu-ativo-filete" />
            {onda > 0 && <span key={onda} className="menu-onda" />}
          </div>
        )}

        <nav className="relative grid grid-cols-[minmax(0,1fr)] gap-0.5" aria-label="Principal">
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
              {...eventosDica(rotulo)}
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
            {...eventosDica("Abrir o menu")}
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
              {...eventosDica(LINK_CONFIG.rotulo)}
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

      </aside>

      {mini &&
        dica &&
        typeof document !== "undefined" &&
        createPortal(
          <div role="presentation" className="pointer-events-none fixed left-[72px] z-[80] hidden -translate-y-1/2 md:block" style={{ top: dica.topo }}>
            <div className="vidro animate-surgir whitespace-nowrap rounded-controle px-3 py-1.5 text-sm font-medium text-texto">{dica.rotulo}</div>
          </div>,
          document.body,
        )}

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
