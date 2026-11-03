"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { juntar } from "../estilos";
import { Botao } from "../ui";
import { useUsuario } from "../usuario";
import { useAlertas } from "./provedor";

function Chave({ ligada, aoMudar, rotulo, desabilitada }: { ligada: boolean; aoMudar: (v: boolean) => void; rotulo: string; desabilitada?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={ligada}
      aria-label={rotulo}
      disabled={desabilitada}
      onClick={() => aoMudar(!ligada)}
      className={juntar("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40", ligada ? "bg-marca" : "bg-borda-forte")}
    >
      <span className={juntar("absolute top-0.5 size-5 rounded-full bg-superficie shadow transition-all", ligada ? "left-[1.375rem]" : "left-0.5")} />
    </button>
  );
}

/** Menu do sino: liga e desliga o som e as notificações do navegador (ESP-02, ESP-03). Vale só neste navegador. */
export function BotaoAvisos() {
  const { preferencias, permissao, definirSom, definirNotificacoes, pedirPermissao, testar } = useAlertas();
  const ehAdmin = useUsuario().perfil === "admin";
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const notificacoesAtivas = preferencias.notificacoes && permissao === "granted";
  const silenciado = !preferencias.som && !notificacoesAtivas;

  return (
    <div ref={raiz} className="relative hidden md:block">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label="Avisos de mensagem nova"
        title={silenciado ? "Avisos silenciados" : "Avisos de mensagem nova"}
        className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave"
      >
        {silenciado ? <BellOff className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
      </button>
      {aberto && (
        <div role="dialog" aria-label="Avisos" className="absolute right-0 top-full z-50 mt-2 w-80 animate-surgir space-y-3 rounded-card border border-borda bg-superficie p-4 shadow-flutuante">
          <div>
            <p className="font-semibold">Avisos neste navegador</p>
            <p className="mt-1 text-xs text-texto-suave">
              {ehAdmin ? "Você recebe os avisos de todos os leads. Para silenciar, desligue as duas opções abaixo." : "Você recebe só os avisos dos seus leads."} Só funciona com o CRM aberto numa aba.
            </p>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Som de mensagem nova</span>
            <Chave ligada={preferencias.som} aoMudar={definirSom} rotulo="Som de mensagem nova" />
          </label>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>Notificações do Windows</span>
              {permissao === "granted" ? (
                <Chave ligada={preferencias.notificacoes} aoMudar={definirNotificacoes} rotulo="Notificações do navegador" />
              ) : permissao === "default" ? (
                <Botao onClick={() => void pedirPermissao()}>Ativar</Botao>
              ) : null}
            </div>
            {permissao === "default" && <p className="text-xs text-texto-suave">O navegador vai pedir sua permissão. Clique em &quot;Permitir&quot;.</p>}
            {permissao === "denied" && <p className="rounded-controle bg-aviso-suave px-2 py-1.5 text-xs text-aviso">Bloqueadas neste navegador. Clique no cadeado ao lado do endereço do site e permita as notificações.</p>}
            {permissao === "indisponivel" && <p className="text-xs text-texto-suave">Este navegador não permite notificações.</p>}
          </div>
          <Botao variante="fantasma" onClick={testar}>
            Testar aviso
          </Botao>
        </div>
      )}
    </div>
  );
}
