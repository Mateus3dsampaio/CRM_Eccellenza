"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Bot, FileCheck2, Headset, Hourglass, Info, Paperclip, RotateCcw, Send, X } from "lucide-react";
import { ACEITO_NO_ANEXO, formatarTamanho, limiteDoTipo, tipoDoArquivo, tipoPodeEnviar } from "@/regras/midia";
import { situacaoDaJanela } from "@/regras/janela24h";
import { MODELOS, faltaParaLembrete, preencherModelo, proximoCompromisso, variaveisDoHorario } from "@/regras/modelos";
import { formatarDataHora } from "@/regras/tempo";
import type { FichaLead } from "@/servicos/consultas";
import { ListaMensagens } from "../chat";
import { chamarApi, useAviso } from "../dados";
import { useAgoraDoServidor } from "../espera";
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
  const refTexto = useRef<HTMLTextAreaElement>(null);
  const podeApagarMidia = usePode("apagar_midia");
  const agora = useAgoraDoServidor();
  const janela = situacaoDaJanela(ficha.ultimaMsgClienteEm, agora);
  const previa = previaDoModelo(modelo, ficha, agora);
  const podeEnviar = previa ? !previa.falta : !!anexo || !!texto.trim();

  // Caixa de texto que cresce com o conteúdo até o limite do CSS (max-h); passou disso, rola por dentro.
  useLayoutEffect(() => {
    const campo = refTexto.current;
    if (!campo) return;
    campo.style.height = "auto";
    campo.style.height = `${campo.scrollHeight + 2}px`;
  }, [texto, previa]);

  function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    const tipo = tipoDoArquivo(arquivo.name, arquivo.type) ?? "";
    if (!tipoPodeEnviar(tipo)) return avisar("Para enviar, use imagem JPG ou PNG, vídeo MP4, PDF, Word, Excel, DWG ou ZIP.", "erro");
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
      <div className="flex items-center gap-2 border-b border-borda bg-superficie px-4 py-2">
        <span className={juntar("flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium", ficha.modo === "bot" ? "text-sucesso" : "text-marca-texto")}>
          {ficha.modo === "bot" ? <Bot className="size-4 shrink-0" aria-hidden /> : <Headset className="size-4 shrink-0" aria-hidden />}
          {modoTexto}
        </span>
        <div className="flex shrink-0 gap-2">
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
      <div className="rolagem-fina min-h-24 flex-1 overflow-y-auto p-4">
        <ListaMensagens mensagens={ficha.mensagens} lado="loja" aoApagarMidia={podeApagarMidia ? setApagar : undefined} />
      </div>
      {/* Área de envio fixa embaixo: nunca encolhe nem é cortada; quem cede espaço é a lista de mensagens. */}
      <form onSubmit={enviar} className="shrink-0 space-y-2 border-t border-borda bg-superficie p-3">
        {!ficha.janelaAberta && (
          <div className="flex flex-wrap items-center gap-2 rounded-controle bg-aviso-suave px-3 py-2 text-xs text-aviso">
            <Info className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">Fora da janela de 24h (regra da Meta): só é possível enviar um modelo aprovado. A janela reabre quando o cliente escrever.</span>
            {/* Só escolhe o modelo e deixa o texto à vista: quem envia é o vendedor. */}
            <button
              type="button"
              onClick={() => { setModelo("retomada"); setAnexo(null); }}
              className="inline-flex min-h-toque items-center gap-1.5 rounded-controle border border-aviso/60 px-3 font-semibold hover:bg-aviso/10"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Reabrir com modelo
            </button>
          </div>
        )}
        {ficha.janelaAberta && ficha.janelaFechaEm && (janela.faixa === "amarelo" || janela.faixa === "vermelho") ? (
          <p className={juntar("flex items-start gap-2 rounded-controle px-3 py-2 text-xs", janela.faixa === "vermelho" ? "bg-alerta-suave text-alerta" : "bg-aviso-suave text-aviso")}>
            <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              A janela fecha em <strong>{janela.texto}</strong> (texto livre até {formatarDataHora(new Date(ficha.janelaFechaEm))}). Só a resposta do cliente renova: chame agora para ele responder.
            </span>
          </p>
        ) : (
          ficha.janelaAberta && ficha.janelaFechaEm && <p className="text-xs text-texto-fraco">Texto livre liberado até {formatarDataHora(new Date(ficha.janelaFechaEm))}.</p>
        )}
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
        {previa && (
          // Prévia inteira do modelo, como o cliente vai receber (o campo de texto some enquanto há modelo escolhido).
          <div className={juntar("rounded-controle border px-3 py-2.5", previa.falta ? "border-aviso/50 bg-aviso-suave" : "border-marca/40 bg-superficie-suave")}>
            <div className="mb-1.5 flex items-center gap-2">
              <FileCheck2 className={juntar("size-4 shrink-0", previa.falta ? "text-aviso" : "text-marca-texto")} aria-hidden />
              <span className="min-w-0 flex-1 text-xs font-semibold text-texto-suave">
                Modelo aprovado: <span className="text-texto">{previa.nome}</span>
              </span>
              <button type="button" onClick={() => setModelo("")} className="inline-flex size-8 items-center justify-center rounded-controle text-texto-fraco hover:bg-superficie hover:text-texto" aria-label="Tirar o modelo">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {previa.falta ? (
              <p role="alert" className="flex items-start gap-2 text-sm text-aviso">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                {previa.falta}
              </p>
            ) : (
              <p className="rolagem-fina max-h-[min(14rem,28vh)] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-texto" aria-label="Prévia do modelo">
                {previa.texto}
              </p>
            )}
          </div>
        )}
        {!previa && (
          <textarea
            ref={refTexto}
            rows={1}
            className={juntar(classeEntrada, "rolagem-fina block max-h-40 resize-none overflow-y-auto leading-relaxed")}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra a linha (como no WhatsApp Web).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (podeEnviar && !enviando) e.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={!ficha.janelaAberta}
            placeholder={anexo ? "Legenda (opcional)" : ficha.janelaAberta ? "Responder como consultor… (Enter envia, Shift+Enter quebra linha)" : "Texto livre bloqueado fora da janela de 24h"}
            aria-label="Mensagem"
          />
        )}
        {/* Barra de ferramentas: modelo e anexo à esquerda, Enviar sempre à vista na direita. */}
        <div className="flex items-center gap-2">
          <select className={juntar(classeEntrada, "w-auto min-w-0 max-w-[16rem] flex-1 sm:flex-none")} value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Modelo aprovado">
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
            className="inline-flex size-toque shrink-0 items-center justify-center rounded-controle border border-borda text-texto-suave hover:bg-superficie-suave disabled:opacity-50"
            title={ficha.janelaAberta ? "Enviar imagem, vídeo (MP4), PDF, Word, Excel, DWG ou ZIP" : "Arquivos só dentro da janela de 24h"}
            aria-label="Anexar arquivo"
          >
            <Paperclip className="size-4" aria-hidden />
          </button>
          <Botao type="submit" variante="primario" carregando={enviando} disabled={!podeEnviar} className="ml-auto shrink-0" icone={<Send className="size-4" aria-hidden />}>
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

/** Texto do modelo como o cliente vai receber; nos lembretes, com a data e a hora do próximo compromisso. Sem compromisso marcado, `falta` traz o aviso e não há texto. */
function previaDoModelo(codigo: string, ficha: FichaLead, agora: Date): { nome: string; texto: string; falta: string | null } | null {
  const modelo = MODELOS.find((m) => m.codigo === codigo);
  if (!modelo) return null;
  if (!modelo.compromisso) return { nome: modelo.nome, texto: modelo.texto, falta: null };
  const visitas = ficha.visitas.map((v) => ({ tipo: v.tipo, status: v.status, inicio: new Date(v.inicio) }));
  const compromisso = proximoCompromisso(visitas, modelo.compromisso, agora);
  return compromisso
    ? { nome: modelo.nome, texto: preencherModelo(modelo.texto, variaveisDoHorario(compromisso.inicio)), falta: null }
    : { nome: modelo.nome, texto: "", falta: faltaParaLembrete(modelo, null) };
}
