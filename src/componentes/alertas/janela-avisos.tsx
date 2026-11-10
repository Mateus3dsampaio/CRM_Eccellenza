"use client";

import { useEffect, useState } from "react";
import { juntar } from "../estilos";
import { Botao, Modal } from "../ui";
import { useUsuario } from "../usuario";
import { chamarApi } from "../dados";
import { ativarPush, desativarPush, ehIphone, pushLigadoNesteNavegador, pushSuportado, renovarPushSeLigado } from "./push";
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

/** Ao abrir o CRM, quem já ligou os avisos com o CRM fechado neste aparelho volta a ser assinado. Fica no menu do usuário (sempre montado). */
export function useRenovarPush(): void {
  const usuario = useUsuario();
  useEffect(() => {
    void renovarPushSeLigado(usuario.id);
  }, [usuario.id]);
}

/** Avisos aparecem silenciados? (som e notificações desligados). Para o menu do usuário mostrar o estado. */
export function useAvisosSilenciados(): boolean {
  const { preferencias, permissao } = useAlertas();
  return !preferencias.som && !(preferencias.notificacoes && permissao === "granted");
}

/** Janela "Avisos" do menu do usuário (ESP-02, ESP-03): som, notificações e avisos com o CRM fechado. Vale só neste aparelho. */
export function JanelaAvisos({ aoFechar }: { aoFechar: () => void }) {
  const { preferencias, permissao, definirSom, definirNotificacoes, pedirPermissao, testar } = useAlertas();
  const usuario = useUsuario();
  const ehAdmin = usuario.perfil === "admin";
  const [iphone, setIphone] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushOcupado, setPushOcupado] = useState(false);
  const [pushErro, setPushErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende do aparelho, só existe no navegador
    setIphone(ehIphone());
    void pushLigadoNesteNavegador(usuario.id).then((ligado) => vivo && setPushOn(ligado));
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

  const sistema = iphone ? "iPhone" : "Windows";

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Avisos" largura="max-w-md">
      <div className="space-y-4">
        <p className="text-xs text-texto-suave">
          {ehAdmin ? "Você recebe os avisos de todos os leads." : "Você recebe só os avisos dos seus leads."} Vale só neste aparelho.
        </p>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Som de mensagem nova</span>
          <Chave ligada={preferencias.som} aoMudar={definirSom} rotulo="Som de mensagem nova" />
        </label>
        {!iphone && (
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
        )}
        {pushSuportado() ? (
          <div className="space-y-1.5 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span>Avisar com o CRM fechado ou minimizado</span>
              <Chave ligada={pushOn} aoMudar={(v) => void mudarPush(v)} rotulo="Avisar com o CRM fechado ou minimizado" desabilitada={pushOcupado} />
            </label>
            <p className="text-xs text-texto-suave">
              Aparece um cartão do {sistema} com o nome do cliente e um trecho da mensagem. Ao sair do CRM, este aparelho para de receber.
            </p>
            {pushOn && (
              <button
                type="button"
                className="min-h-toque text-xs font-medium text-marca-texto hover:underline"
                onClick={() => {
                  setPushErro(null);
                  chamarApi("/api/push/teste", { method: "POST" })
                    .then(() => setPushErro(iphone ? "Volte para a tela de início agora: o aviso de teste chega em 5 segundos." : "Minimize o CRM agora: o aviso de teste chega em 5 segundos."))
                    .catch((e) => setPushErro(e instanceof Error ? e.message : "Não foi possível testar."));
                }}
              >
                {iphone ? "Testar com o CRM fechado" : "Testar com o CRM minimizado"}
              </button>
            )}
            {pushErro && <p className="rounded-controle bg-aviso-suave px-2 py-1.5 text-xs text-aviso">{pushErro}</p>}
          </div>
        ) : iphone ? (
          <p className="rounded-controle bg-aviso-suave px-2 py-1.5 text-xs text-aviso">
            Para receber avisos com o CRM fechado, abra o CRM pelo ícone da tela de início (no Safari: Compartilhar &gt; Adicionar à Tela de Início).
          </p>
        ) : null}
        <Botao variante="fantasma" onClick={testar}>
          Testar aviso
        </Botao>
      </div>
    </Modal>
  );
}
