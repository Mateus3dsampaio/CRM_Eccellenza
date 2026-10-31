"use client";

import { useEffect, useRef } from "react";
import { Bot, Headset, Zap } from "lucide-react";
import { formatarData, formatarHora, inicioDoDiaLocal } from "@/regras/tempo";
import { juntar } from "./estilos";
import { StatusMensagem } from "./ui";

export interface MensagemChat {
  id: string;
  autor: string;
  autorNome?: string | null;
  texto: string | null;
  midia: string | null;
  enviadaEm: string;
  status: string | null;
  modelo?: string | null;
}

/**
 * Lista de mensagens estilo WhatsApp.
 * lado "loja": cliente à esquerda, loja à direita (ficha). lado "cliente": o contrário (simulador).
 */
export function ListaMensagens({ mensagens, lado, digitando }: { mensagens: MensagemChat[]; lado: "loja" | "cliente"; digitando?: boolean }) {
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, digitando]);

  const diaDe = (m: MensagemChat) => inicioDoDiaLocal(new Date(m.enviadaEm)).toISOString();
  return (
    <div className="flex flex-col gap-1.5">
      {mensagens.length === 0 && <p className="py-8 text-center text-sm text-texto-suave">Nenhuma mensagem ainda.</p>}
      {mensagens.map((m, i) => {
        const data = new Date(m.enviadaEm);
        const separador = i === 0 || diaDe(m) !== diaDe(mensagens[i - 1]);
        const daLoja = m.autor !== "cliente";
        const direita = lado === "loja" ? daLoja : !daLoja;
        return (
          <div key={m.id} className="animate-surgir">
            {separador && (
              <p className="mx-auto my-2 w-fit rounded-controle bg-superficie/90 px-3 py-1 text-xs font-medium text-texto-suave shadow-card">{formatarData(data)}</p>
            )}
            <div className={juntar("flex", direita ? "justify-end" : "justify-start")}>
              <div
                className={juntar(
                  "max-w-[85%] rounded-card px-3 py-2 text-sm shadow-card sm:max-w-[70%]",
                  m.autor === "sistema" ? "bg-chat-sistema" : direita ? "bg-chat-loja" : "bg-chat-cliente",
                  m.status === "falhou" && "ring-1 ring-alerta",
                )}
              >
                {lado === "loja" && daLoja && (
                  <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-texto-suave">
                    {m.autor === "bot" ? <Bot className="size-3" aria-hidden /> : m.autor === "consultor" ? <Headset className="size-3" aria-hidden /> : <Zap className="size-3" aria-hidden />}
                    {m.autor === "bot" ? "Bot" : m.autorNome ?? "Sistema"}
                    {m.modelo && <span className="font-normal">· modelo aprovado</span>}
                  </p>
                )}
                {m.midia && (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem servida por rota protegida
                  <img src={`/api/midias/${m.midia}`} alt="Imagem enviada pelo cliente" className="mb-1 max-h-72 rounded-controle object-contain" />
                )}
                {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-texto-fraco">
                  {formatarHora(data)}
                  {daLoja && <StatusMensagem status={m.status} />}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      {digitando && (
        <div className={juntar("flex", lado === "cliente" ? "justify-start" : "justify-end")}>
          <p className="rounded-card bg-superficie px-3 py-2 text-sm text-texto-suave shadow-card">
            <span className="animate-brilho">digitando...</span>
          </p>
        </div>
      )}
      <div ref={fim} />
    </div>
  );
}
