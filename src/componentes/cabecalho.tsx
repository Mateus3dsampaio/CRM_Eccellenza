"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, BarChart3, CalendarDays, Clock, KanbanSquare, LogOut, MessageSquarePlus, Settings, Smartphone } from "lucide-react";
import { formatarDataHora } from "@/regras/tempo";
import { chamarApi, useVersao } from "./dados";
import { juntar } from "./estilos";
import { BotaoAguardando } from "./aguardando";
import { BotaoAvisos } from "./alertas/botao-avisos";
import { BotaoAlmoco } from "./almoco";
import { NovaMensagem } from "./nova-mensagem";
import { BotaoTema } from "./tema";
import { usePode, useUsuario } from "./usuario";

const LINKS = [
  { href: "/", rotulo: "Kanban", icone: KanbanSquare },
  { href: "/agenda", rotulo: "Agenda", icone: CalendarDays },
  { href: "/painel", rotulo: "Painel", icone: BarChart3 },
  { href: "/simulador", rotulo: "Simulador", icone: Smartphone },
  { href: "/arquivados", rotulo: "Arquivados", icone: Archive },
];
const LINK_CONFIG = { href: "/configuracoes", rotulo: "Configurações", icone: Settings };

export function Cabecalho() {
  const caminho = usePathname();
  const router = useRouter();
  const usuario = useUsuario();
  const { agora } = useVersao();
  const [novaAberta, setNovaAberta] = useState(false);
  const links = usePode("configurar") ? [...LINKS, LINK_CONFIG] : LINKS;

  const ativo = (href: string) => (href === "/" ? caminho === "/" || caminho.startsWith("/lead") : caminho.startsWith(href));

  async function sair() {
    await chamarApi("/api/login", { method: "DELETE" }).catch(() => undefined);
    router.push("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-borda bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex h-topo max-w-[1800px] items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-marca">
            <span className="inline-flex size-toque items-center justify-center rounded-controle bg-marca text-sm font-bold text-sobre-marca">E</span>
            <span className="hidden sm:inline">Eccellenza</span>
          </Link>
          <nav className="ml-2 hidden min-w-0 items-center gap-1 md:flex lg:ml-4" aria-label="Principal">
            {links.map(({ href, rotulo, icone: Icone }) => (
              <Link
                key={href}
                href={href}
                aria-current={ativo(href) ? "page" : undefined}
                className={juntar(
                  "inline-flex min-h-toque items-center gap-2 rounded-controle px-3 text-sm font-medium transition",
                  ativo(href) ? "bg-marca-suave text-marca" : "text-texto-suave hover:bg-superficie-suave hover:text-texto",
                )}
              >
                <Icone className="size-4" aria-hidden />
                <span className="sr-only min-[1400px]:not-sr-only">{rotulo}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {agora && (
              <Link href="/simulador" title="Relógio do simulador" className="hidden items-center gap-1.5 whitespace-nowrap rounded-pilula bg-superficie-suave px-3 py-1.5 text-xs font-medium text-texto-suave 2xl:inline-flex">
                <Clock className="size-3.5" aria-hidden />
                {formatarDataHora(new Date(agora))}
              </Link>
            )}
            <BotaoAguardando />
            {usuario.perfil === "consultor" && <BotaoAlmoco />}
            <button
              onClick={() => setNovaAberta(true)}
              className="inline-flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-controle bg-marca px-3 text-sm font-medium text-sobre-marca shadow-card transition hover:bg-marca-forte active:scale-[0.97] sm:px-4"
            >
              <MessageSquarePlus className="size-4" aria-hidden />
              <span className="hidden whitespace-nowrap sm:inline">Nova mensagem</span>
              <span className="sr-only sm:hidden">Nova mensagem</span>
            </button>
            <span
              className="inline-flex size-toque items-center justify-center rounded-full bg-marca-suave text-xs font-semibold text-marca 2xl:hidden"
              title={`${usuario.nome} (${usuario.perfil === "admin" ? "Administrador" : "Consultor"})`}
            >
              {usuario.nome.slice(0, 1)}
              <span className="sr-only">{usuario.nome}</span>
            </span>
            <div className="hidden text-right leading-tight 2xl:block">
              <p className="text-sm font-medium">{usuario.nome}</p>
              <p className="text-xs text-texto-fraco">{usuario.perfil === "admin" ? "Administrador" : "Consultor"}</p>
            </div>
            <BotaoAvisos />
            <BotaoTema />
            <button onClick={sair} className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave" aria-label="Sair" title="Sair">
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {/* Navegação inferior no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-borda bg-superficie md:hidden" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }} aria-label="Principal (celular)">
        {links.map(({ href, rotulo, icone: Icone }) => (
          <Link
            key={href}
            href={href}
            aria-current={ativo(href) ? "page" : undefined}
            className={juntar("flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium", ativo(href) ? "text-marca" : "text-texto-suave")}
          >
            <Icone className="size-5" aria-hidden />
            {rotulo}
          </Link>
        ))}
      </nav>

      <NovaMensagem aberta={novaAberta} aoFechar={() => setNovaAberta(false)} />
    </>
  );
}
