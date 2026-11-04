"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { juntar } from "../estilos";
import { Botao } from "../ui";
import { useUsuario } from "../usuario";
import { chamarApi } from "../dados";
import { ativarPush, desativarPush, pushLigadoNesteNavegador, pushSuportado, renovarPushSeLigado } from "./push";
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
  const usuario = useUsuario();
  const [aberto, setAberto] = useState(false);
  // Avisos com o CRM fechado ou minimizado (Web Push).
  const [pushOn, setPushOn] = useState(false);
  const [pushOcupado, setPushOcupado] = useState(false);
  const [pushErro, setPushErro] = useState<string | null>(null);
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

  useEffect(() => {
    let vivo = true;
    // Quem ligou antes volta a ser assinado (sair e entrar, ou o navegador trocou o endereço) e o botão mostra a verdade.
    void renovarPushSeLigado(usuario.id).then(() => pushLigadoNesteNavegador(usuario.id)).then((ligado) => vivo && setPushOn(ligado));
    return () => {
      vivo = false;
    };
  }, [usuario.id]);

  async function mudarPush(ligar: boolean) {
    setPushOcupado(true);
    setPushErro(null);
    try {
      if (ligar) await ativarPush(usuario.id);
      else await desativarPush(usuario.id);
      setPushOn(ligar);
    } catch (e) {
      setPushErro(e instanceof Error ? e.message : "Não foi possível mudar.");
    } finally {
      setPushOcupado(false);
    }
  }

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
              {ehAdmin ? "Você recebe os avisos de todos os leads. Para silenciar, desligue o som e as notificações." : "Você recebe só os avisos dos seus leads."} Com a última opção ligada, os avisos chegam também com o CRM fechado ou minimizado.
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
          {pushSuportado() && (
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center justify-between gap-3">
                <span>Avisar com o CRM fechado ou minimizado</span>
                <Chave ligada={pushOn} aoMudar={(v) => void mudarPush(v)} rotulo="Avisar com o CRM fechado ou minimizado" desabilitada={pushOcupado} />
              </label>
              <p className="text-xs text-texto-suave">
                Aparece um cartão do Windows com o nome do cliente e um trecho da mensagem. Vale só neste navegador; ao sair do CRM, ele para de receber.
              </p>
              {pushOn && (
                <button
                  type="button"
                  className="text-xs font-medium text-marca-texto hover:underline"
                  onClick={() => {
                    setPushErro(null);
                    chamarApi("/api/push/teste", { method: "POST" })
                      .then(() => setPushErro("Minimize o CRM agora: o aviso de teste chega em 5 segundos."))
                      .catch((e) => setPushErro(e instanceof Error ? e.message : "Não foi possível testar."));
                  }}
                >
                  Testar com o CRM minimizado
                </button>
              )}
              {pushErro && <p className="rounded-controle bg-aviso-suave px-2 py-1.5 text-xs text-aviso">{pushErro}</p>}
            </div>
          )}
          <Botao variante="fantasma" onClick={testar}>
            Testar aviso
          </Botao>
        </div>
      )}
    </div>
  );
}
