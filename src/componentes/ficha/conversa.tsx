"use client";

import { useRef, useState } from "react";
import { Bot, Headset, Info, Paperclip, Send, X } from "lucide-react";
import { ACEITO_NO_ANEXO, formatarTamanho, limiteDoTipo, tipoDoArquivo, tipoPodeEnviar } from "@/regras/midia";
import { MODELOS } from "@/regras/modelos";
import { formatarDataHora } from "@/regras/tempo";
import type { FichaLead } from "@/servicos/consultas";
import { ListaMensagens } from "../chat";
import { chamarApi, useAviso } from "../dados";
import { juntar } from "../estilos";
import { Botao, Modal, classeEntrada } from "../ui";
import { usePode } from "../usuario";

// Conversa vista pelo consultor: assumir, devolver ao bot e responder (CHAT-03, BOT-05).
export function ConversaConsultor({ ficha, aoMudar }: { ficha: FichaLead; aoMudar: () => void }) {
  const avisar = useAviso();
  const [texto, setTexto] = useState("");
  const [modelo, setModelo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [anexo, setAnexo] = useState<File | null>(null);
  const [apagar, setApagar] = useState<string | null>(null);
  const refArquivo = useRef<HTMLInputElement>(null);
  const podeApagarMidia = usePode("apagar_midia");

  function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    const tipo = tipoDoArquivo(arquivo.name, arquivo.type) ?? "";
    if (!tipoPodeEnviar(tipo)) return avisar("Para enviar, use imagem JPG ou PNG, vídeo MP4, PDF, Word, Excel ou DWG.", "erro");
    if (arquivo.size > limiteDoTipo(tipo)) return avisar(`Arquivo grande demais (máximo ${formatarTamanho(limiteDoTipo(tipo))} para este tipo).`, "erro");
    setAnexo(arquivo);
    setModelo("");
  }

  async function apagarArquivo() {
    if (!apagar) return;
    try {
      await chamarApi(`/api/mensagens/${apagar}/midia`, { method: "DELETE" });
      avisar("Arquivo apagado.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível apagar.", "erro");
    } finally {
      setApagar(null);
      aoMudar();
    }
  }

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
    if (anexo) {
      // Arquivo (imagem, vídeo ou PDF) com o texto como legenda.
      setEnviando(true);
      try {
        const form = new FormData();
        form.set("arquivo", anexo);
        form.set("legenda", texto);
        await chamarApi(`/api/leads/${ficha.id}/anexo`, { method: "POST", body: form });
        setAnexo(null);
        setTexto("");
        avisar("Arquivo enviado.");
      } catch (erro) {
        avisar(erro instanceof Error ? erro.message : "Não foi possível enviar o arquivo.", "erro");
      } finally {
        setEnviando(false);
        aoMudar();
      }
      return;
    }
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
        <span className={juntar("inline-flex items-center gap-1.5 text-sm font-medium", ficha.modo === "bot" ? "text-sucesso" : "text-marca-texto")}>
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
        <ListaMensagens mensagens={ficha.mensagens} lado="loja" aoApagarMidia={podeApagarMidia ? setApagar : undefined} />
      </div>
      <form onSubmit={enviar} className="space-y-2 border-t border-borda bg-superficie p-3">
        {!ficha.janelaAberta && (
          <p className="flex gap-2 rounded-controle bg-aviso-suave px-3 py-2 text-xs text-aviso">
            <Info className="size-4 shrink-0" aria-hidden />
            Fora da janela de 24h (regra da Meta): só é possível enviar um modelo aprovado. A janela reabre quando o cliente escrever.
          </p>
        )}
        {ficha.janelaAberta && ficha.janelaFechaEm && <p className="text-xs text-texto-fraco">Texto livre liberado até {formatarDataHora(new Date(ficha.janelaFechaEm))}.</p>}
        {anexo && (
          <p className="flex items-center gap-2 rounded-controle bg-superficie-suave px-3 py-2 text-sm">
            <Paperclip className="size-4 shrink-0 text-texto-suave" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {anexo.name} <span className="text-texto-fraco">({formatarTamanho(anexo.size)})</span> · o texto abaixo vira a legenda
            </span>
            <button type="button" onClick={() => setAnexo(null)} className="inline-flex size-toque items-center justify-center" aria-label="Remover arquivo">
              <X className="size-4" aria-hidden />
            </button>
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className={juntar(classeEntrada, "sm:w-52")} value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Modelo aprovado">
            <option value="">{ficha.janelaAberta ? "Texto livre" : "Escolha um modelo"}</option>
            {MODELOS.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                Modelo: {m.nome}
              </option>
            ))}
          </select>
          <input ref={refArquivo} type="file" accept={ACEITO_NO_ANEXO} className="hidden" onChange={(e) => { escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
          <button
            type="button"
            onClick={() => refArquivo.current?.click()}
            disabled={!ficha.janelaAberta}
            className="inline-flex min-h-toque items-center justify-center gap-2 rounded-controle border border-borda px-3 text-sm text-texto-suave hover:bg-superficie-suave disabled:opacity-50"
            title={ficha.janelaAberta ? "Enviar imagem, vídeo (MP4), PDF, Word, Excel ou DWG" : "Arquivos só dentro da janela de 24h"}
            aria-label="Anexar arquivo"
          >
            <Paperclip className="size-4" aria-hidden />
          </button>
          <input
            className={classeEntrada}
            value={modelo ? MODELOS.find((m) => m.codigo === modelo)?.texto ?? "" : texto}
            onChange={(e) => setTexto(e.target.value)}
            readOnly={!!modelo}
            disabled={!modelo && !ficha.janelaAberta}
            placeholder={anexo ? "Legenda (opcional)" : ficha.janelaAberta ? "Responder como consultor..." : "Texto livre bloqueado fora da janela de 24h"}
            aria-label="Mensagem"
          />
          <Botao type="submit" variante="primario" carregando={enviando} disabled={!anexo && !modelo && !texto.trim()} icone={<Send className="size-4" aria-hidden />}>
            Enviar
          </Botao>
        </div>
        {ficha.modo === "bot" && <p className="text-xs text-texto-fraco">Ao responder, você assume a conversa e o bot para de responder (dá para devolver depois).</p>}
      </form>
      <Modal aberto={!!apagar} aoFechar={() => setApagar(null)} titulo="Apagar arquivo" largura="max-w-md">
        <p className="text-sm text-texto-suave">Apagar este arquivo da conversa? A mensagem fica, mas o arquivo é apagado do sistema e não dá para recuperar.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setApagar(null)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={apagarArquivo}>Apagar</Botao>
        </div>
      </Modal>
    </div>
  );
}
