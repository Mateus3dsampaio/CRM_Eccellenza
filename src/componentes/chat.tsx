"use client";

import { useEffect, useRef } from "react";
import { Bot, Download, FileText, Headset, Trash2, Zap } from "lucide-react";
import { familiaDoTipo, formatarTamanho, rotuloDoArquivo } from "@/regras/midia";
import { formatarData, formatarHora, inicioDoDiaLocal } from "@/regras/tempo";
import { juntar } from "./estilos";
import { StatusMensagem } from "./ui";

export interface MensagemChat {
  id: string;
  autor: string;
  autorNome?: string | null;
  texto: string | null;
  midia: string | null;
  midiaTipo?: string | null;
  midiaNome?: string | null;
  midiaBytes?: number | null;
  enviadaEm: string;
  status: string | null;
  modelo?: string | null;
  /** Botões de resposta rápida do modelo (só na conversa do simulador, onde o cliente pode tocar). */
  botoes?: readonly string[] | null;
}

/**
 * Lista de mensagens estilo WhatsApp.
 * lado "loja": cliente à esquerda, loja à direita (ficha). lado "cliente": o contrário (simulador).
 */
export function ListaMensagens({ mensagens, lado, digitando, aoApagarMidia, aoTocarBotao }: { mensagens: MensagemChat[]; lado: "loja" | "cliente"; digitando?: boolean; aoApagarMidia?: (mensagemId: string) => void; aoTocarBotao?: (texto: string) => void }) {
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
                {m.midia && <MidiaDaMensagem m={m} aoApagar={aoApagarMidia} />}
                {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                {/* Botões de resposta rápida: só o do último movimento da conversa (depois que o cliente responde, somem). */}
                {aoTocarBotao && m.botoes && i === mensagens.length - 1 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {m.botoes.map((b) => (
                      <button key={b} type="button" onClick={() => aoTocarBotao(b)} className="min-h-toque rounded-controle border border-borda bg-superficie px-3 text-sm font-medium text-marca-texto hover:bg-superficie-suave">
                        {b}
                      </button>
                    ))}
                  </div>
                )}
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

/** Imagem, vídeo ou PDF dentro da bolha. Os arquivos vêm de uma rota protegida (só logado). */
function MidiaDaMensagem({ m, aoApagar }: { m: MensagemChat; aoApagar?: (mensagemId: string) => void }) {
  const url = `/api/midias/${m.midia}`;
  const familia = m.midiaTipo ? familiaDoTipo(m.midiaTipo) : "imagem"; // mensagens antigas só tinham imagem
  const nome = m.midiaNome || "arquivo";
  return (
    <div className="mb-1">
      {familia === "video" ? (
        <video src={url} controls preload="metadata" className="max-h-72 w-full rounded-controle bg-black" aria-label="Vídeo da conversa" />
      ) : familia === "documento" ? (
        <a href={url} download className="flex items-center gap-3 rounded-controle bg-superficie-suave px-3 py-2 hover:bg-superficie" title="Baixar arquivo">
          <FileText className="size-8 shrink-0 text-alerta" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{nome}</span>
            <span className="text-xs text-texto-suave">{m.midiaTipo ? rotuloDoArquivo(m.midiaTipo, m.midiaNome) : "Arquivo"}{m.midiaBytes ? ` · ${formatarTamanho(m.midiaBytes)}` : ""}</span>
          </span>
          <Download className="size-4 shrink-0 text-texto-suave" aria-hidden />
        </a>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- imagem servida por rota protegida
        <img src={url} alt="Imagem da conversa" className="max-h-72 rounded-controle object-contain" />
      )}
      {aoApagar && (
        <button type="button" onClick={() => aoApagar(m.id)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-alerta hover:underline">
          <Trash2 className="size-3" aria-hidden /> Apagar arquivo
        </button>
      )}
    </div>
  );
}
