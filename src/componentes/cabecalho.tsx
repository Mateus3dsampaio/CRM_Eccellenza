"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Clock, MessageSquarePlus } from "lucide-react";
import { formatarDataHora } from "@/regras/tempo";
import { useVersao } from "./dados";
import { BotaoAguardando } from "./aguardando";
import { BotaoRetornos } from "./retornos";
import { BotaoJanelas } from "./janelas";
import { BotoesDePresenca } from "./presenca";
import { MenuEsfera } from "./menu-esfera";
import { MenuUsuario } from "./menu-usuario";
import { NovaMensagem } from "./nova-mensagem";
import { useUsuario } from "./usuario";
import { useTituloTela } from "./titulo-tela";

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
  const tituloDaTela = useTituloTela();

  return (
    <>
      {/* O desfoque do topo fica numa camada atrás (before), não no header: assim os menus em vidro que abrem daqui desfocam a tela de trás. */}
      <header className="topo-luz sticky top-0 z-30 border-b border-borda before:absolute before:inset-0 before:-z-10 before:bg-fundo/90 before:backdrop-blur">
        <div className="flex h-topo items-center gap-2 px-3 sm:gap-3 sm:px-4">
          {/* No celular não há menu lateral: a mini esfera (a mesma do menu) leva ao kanban. */}
          <Link href="/" className="relative inline-flex size-9 shrink-0 items-center justify-center md:hidden" aria-label="Eccellenza – início">
            <span aria-hidden className="absolute inset-0 rounded-full bg-marca/30 blur-md" />
            <MenuEsfera tamanho={34} className="relative" impulso={caminho} />
          </Link>
          {tituloDaTela ? (
            <div className="flex min-w-0 items-center gap-3" data-titulo-tela>
              {tituloDaTela.conteudo}
            </div>
          ) : (
            <p className="truncate text-lg font-semibold tracking-tight max-sm:hidden" data-titulo-tela>
              {titulo}
            </p>
          )}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {simulador && agora && (
              <Link href="/simulador" title="Relógio do simulador" className="hidden items-center gap-1.5 whitespace-nowrap rounded-pilula bg-superficie-suave px-3 py-1.5 text-xs font-medium text-texto-suave 2xl:inline-flex">
                <Clock className="size-3.5" aria-hidden />
                {formatarDataHora(new Date(agora))}
              </Link>
            )}
            <BotaoJanelas />
            <BotaoRetornos />
            <BotaoAguardando />
            {usuario.perfil === "consultor" && <BotoesDePresenca />}
            <button
              onClick={() => setNovaAberta(true)}
              className="tecla-pri inline-flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-controle px-3 text-sm font-semibold text-sobre-marca sm:px-4"
            >
              <MessageSquarePlus className="size-4" aria-hidden />
              <span className="hidden whitespace-nowrap sm:inline">Nova mensagem</span>
              <span className="sr-only sm:hidden">Nova mensagem</span>
            </button>
            <MenuUsuario />
          </div>
        </div>
      </header>

      <NovaMensagem aberta={novaAberta} aoFechar={() => setNovaAberta(false)} />
    </>
  );
}
