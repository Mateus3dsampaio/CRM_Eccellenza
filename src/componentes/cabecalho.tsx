"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Clock, MessageSquarePlus } from "lucide-react";
import { formatarDataHora } from "@/regras/tempo";
import { useVersao } from "./dados";
import { BotaoAguardando } from "./aguardando";
import { BotaoRetornos } from "./retornos";
import { BotaoAvisos } from "./alertas/botao-avisos";
import { BotaoAlmoco } from "./almoco";
import { MenuUsuario } from "./menu-usuario";
import { NovaMensagem } from "./nova-mensagem";
import { useUsuario } from "./usuario";

const TITULOS: [string, string][] = [
  ["/agenda", "Agenda"],
  ["/painel", "Painel"],
  ["/galeria", "Galeria"],
  ["/simulador", "Simulador"],
  ["/arquivados", "Arquivados"],
  ["/configuracoes", "Configurações"],
  ["/lead", "Ficha do lead"],
];

/** Barra de cima: título da tela e ações do dia a dia. A navegação fica no menu lateral. */
export function Cabecalho({ simulador = true }: { simulador?: boolean }) {
  const caminho = usePathname();
  const usuario = useUsuario();
  const { agora } = useVersao();
  const [novaAberta, setNovaAberta] = useState(false);
  const titulo = TITULOS.find(([prefixo]) => caminho.startsWith(prefixo))?.[1] ?? "Atendimentos";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/90 backdrop-blur">
        <div className="flex h-topo items-center gap-2 px-3 sm:gap-3 sm:px-4">
          {/* No celular não há menu lateral: o logo leva ao kanban. */}
          <Link href="/" className="tecla-pri inline-flex size-9 shrink-0 items-center justify-center rounded-controle text-sm font-bold text-sobre-marca md:hidden" aria-label="Eccellenza – início">
            E
          </Link>
          <p className="truncate text-lg font-semibold tracking-tight" data-titulo-tela>
            {titulo}
          </p>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {simulador && agora && (
              <Link href="/simulador" title="Relógio do simulador" className="hidden items-center gap-1.5 whitespace-nowrap rounded-pilula bg-superficie-suave px-3 py-1.5 text-xs font-medium text-texto-suave 2xl:inline-flex">
                <Clock className="size-3.5" aria-hidden />
                {formatarDataHora(new Date(agora))}
              </Link>
            )}
            <BotaoRetornos />
            <BotaoAguardando />
            {usuario.perfil === "consultor" && <BotaoAlmoco />}
            <button
              onClick={() => setNovaAberta(true)}
              className="tecla-pri inline-flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-controle px-3 text-sm font-semibold text-sobre-marca sm:px-4"
            >
              <MessageSquarePlus className="size-4" aria-hidden />
              <span className="hidden whitespace-nowrap sm:inline">Nova mensagem</span>
              <span className="sr-only sm:hidden">Nova mensagem</span>
            </button>
            <BotaoAvisos />
            <MenuUsuario />
          </div>
        </div>
      </header>

      <NovaMensagem aberta={novaAberta} aoFechar={() => setNovaAberta(false)} />
    </>
  );
}
