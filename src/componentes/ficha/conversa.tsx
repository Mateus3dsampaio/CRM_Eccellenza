"use client";

import { useState } from "react";
import { Bot, Headset, Info, Send } from "lucide-react";
import { MODELOS } from "@/regras/modelos";
import { formatarDataHora } from "@/regras/tempo";
import type { FichaLead } from "@/servicos/consultas";
import { ListaMensagens } from "../chat";
import { chamarApi, useAviso } from "../dados";
import { juntar } from "../estilos";
import { Botao, classeEntrada } from "../ui";

// Conversa vista pelo consultor: assumir, devolver ao bot e responder (CHAT-03, BOT-05).
export function ConversaConsultor({ ficha, aoMudar }: { ficha: FichaLead; aoMudar: () => void }) {
  const avisar = useAviso();
  const [texto, setTexto] = useState("");
  const [modelo, setModelo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function conversa(corpo: object, sucesso?: string) {
    setEnviando(true);
    try {
      await chamarApi(`/api/leads/${ficha.id}/conversa`, { method: "POST", json: corpo });
      if (sucesso) avisar(sucesso);
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível concluir.", "erro");
      return false;
    } finally {
      setEnviando(false);
      aoMudar();
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const ok = await conversa({ acao: "responder", texto: modelo ? undefined : texto, modelo: modelo || undefined });
    if (ok) {
      setTexto("");
      setModelo("");
    }
  }

  const modoTexto =
    ficha.modo === "humano" ? "Consultor na conversa: o bot não responde." : ficha.modo === "pausado" ? "Bot pausado: o lead foi passado ao consultor." : "Bot atendendo esta conversa.";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-painel border border-borda bg-chat-fundo shadow-painel">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda bg-superficie px-4 py-2">
        <span className={juntar("inline-flex items-center gap-1.5 text-sm font-medium", ficha.modo === "bot" ? "text-sucesso" : "text-marca")}>
          {ficha.modo === "bot" ? <Bot className="size-4" aria-hidden /> : <Headset className="size-4" aria-hidden />}
          {modoTexto}
        </span>
        <div className="ml-auto flex gap-2">
          {ficha.modo !== "humano" && (
            <Botao onClick={() => conversa({ acao: "assumir" }, "Você assumiu a conversa.")} disabled={enviando}>
              Assumir conversa
            </Botao>
          )}
          {ficha.modo !== "bot" && (
            <Botao onClick={() => conversa({ acao: "devolver" }, "Conversa devolvida ao bot.")} disabled={enviando} icone={<Bot className="size-4" aria-hidden />}>
              Devolver ao bot
            </Botao>
          )}
        </div>
      </div>
      {ficha.erroBot && (
        <p role="alert" className="border-b border-alerta/30 bg-alerta-suave px-4 py-2 text-sm text-alerta">
          O bot não conseguiu responder: {ficha.erroBot} A conversa está aguardando um consultor.
        </p>
      )}
      <div className="rolagem-fina min-h-64 flex-1 overflow-y-auto p-4">
        <ListaMensagens mensagens={ficha.mensagens} lado="loja" />
      </div>
      <form onSubmit={enviar} className="space-y-2 border-t border-borda bg-superficie p-3">
        {!ficha.janelaAberta && (
          <p className="flex gap-2 rounded-controle bg-aviso-suave px-3 py-2 text-xs text-aviso">
            <Info className="size-4 shrink-0" aria-hidden />
            Fora da janela de 24h (regra da Meta): só é possível enviar um modelo aprovado. A janela reabre quando o cliente escrever.
          </p>
        )}
        {ficha.janelaAberta && ficha.janelaFechaEm && <p className="text-xs text-texto-fraco">Texto livre liberado até {formatarDataHora(new Date(ficha.janelaFechaEm))}.</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className={juntar(classeEntrada, "sm:w-52")} value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Modelo aprovado">
            <option value="">{ficha.janelaAberta ? "Texto livre" : "Escolha um modelo"}</option>
            {MODELOS.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                Modelo: {m.nome}
              </option>
            ))}
          </select>
          <input
            className={classeEntrada}
            value={modelo ? MODELOS.find((m) => m.codigo === modelo)?.texto ?? "" : texto}
            onChange={(e) => setTexto(e.target.value)}
            readOnly={!!modelo}
            disabled={!modelo && !ficha.janelaAberta}
            placeholder={ficha.janelaAberta ? "Responder como consultor..." : "Texto livre bloqueado fora da janela de 24h"}
            aria-label="Mensagem"
          />
          <Botao type="submit" variante="primario" carregando={enviando} disabled={!modelo && !texto.trim()} icone={<Send className="size-4" aria-hidden />}>
            Enviar
          </Botao>
        </div>
        {ficha.modo === "bot" && <p className="text-xs text-texto-fraco">Ao responder, você assume a conversa e o bot para de responder (dá para devolver depois).</p>}
      </form>
    </div>
  );
}
