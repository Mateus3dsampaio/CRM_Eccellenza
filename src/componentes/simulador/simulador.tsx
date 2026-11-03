"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, Mic, Plus, Send, Smartphone, UserPlus, X } from "lucide-react";
import { TAMANHO_MAXIMO_IMAGEM } from "@/regras/limites";
import { normalizarTelefone, formatarTelefone } from "@/regras/telefone";
import { ListaMensagens, type MensagemChat } from "../chat";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Avatar, Botao, Campo, Carregando, EstadoVazio, Modal, classeEntrada } from "../ui";
import { Relogio } from "./relogio";

interface DadosSimulador {
  contatos: { telefone: string; nome: string; nomePerfil: string | null; previa: string | null; avatarCor: number }[];
  conversa?: { leadId: string; nome: string; modo: string; erroBot: string | null; mensagens: MensagemChat[] } | null;
}

function telefoneAleatorio() {
  // Faixa fictícia usada no simulador: +55 88 90000-xxxx.
  return `+55 88 90000-${String(Math.floor(1000 + Math.random() * 8999))}`;
}

// Tela do simulador: o Mateus faz o papel do cliente no WhatsApp (CHAT-01).
export function Simulador() {
  const avisar = useAviso();
  const [telefone, setTelefone] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState<string | null>(null);
  const { dados, recarregar } = useDados<DadosSimulador>(`/api/simulador${telefone ? `?telefone=${encodeURIComponent(telefone)}` : ""}`);
  const [texto, setTexto] = useState("");
  const [imagem, setImagem] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendente, setPendente] = useState<MensagemChat | null>(null);
  const [baseIguais, setBaseIguais] = useState(0);
  const [criar, setCriar] = useState(false);
  const [formNovo, setFormNovo] = useState({ nome: "", telefone: telefoneAleatorio() });
  const refArquivo = useRef<HTMLInputElement>(null);

  const conversa = dados?.conversa;
  // A mensagem já pode estar salva (recarga automática) enquanto o bot ainda responde:
  // nesse caso a pendente some, para não aparecer duas vezes.
  const iguaisSalvas = pendente ? (conversa?.mensagens ?? []).filter((m) => m.autor === "cliente" && m.texto === pendente.texto).length : 0;
  const jaSalva = pendente !== null && iguaisSalvas > baseIguais;
  const mensagens = [...(conversa?.mensagens ?? []), ...(pendente && !jaSalva ? [pendente] : [])];

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!telefone || (!texto.trim() && !imagem)) return;
    const form = new FormData();
    form.set("telefone", telefone);
    if (nomeNovo) form.set("nome", nomeNovo);
    form.set("texto", texto);
    if (imagem) form.set("imagem", imagem);
    const textoPendente = texto || (imagem ? "📷 Imagem" : "");
    setBaseIguais((conversa?.mensagens ?? []).filter((m) => m.autor === "cliente" && m.texto === textoPendente).length);
    setPendente({ id: "pendente", autor: "cliente", texto: textoPendente, midia: null, enviadaEm: new Date().toISOString(), status: null });
    setTexto("");
    setImagem(null);
    setEnviando(true);
    try {
      const r = await chamarApi<{ erro?: string }>("/api/simulador", { method: "POST", body: form });
      if (r.erro) avisar(`O bot não respondeu: ${r.erro}`, "erro");
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível enviar.", "erro");
    } finally {
      setPendente(null);
      setEnviando(false);
      await recarregar();
    }
  }

  function abrirContato(tel: string, nome?: string) {
    setTelefone(tel);
    setNomeNovo(nome ?? null);
  }

  return (
    <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* Contatos fictícios */}
      <aside className={juntar("flex min-w-0 flex-col gap-3 rounded-painel border border-borda bg-superficie p-3 shadow-painel", telefone && "hidden lg:flex")}>
        <div className="flex items-center justify-between gap-2 px-1">
          <h1 className="font-semibold">Clientes simulados</h1>
          <Botao variante="primario" onClick={() => setCriar(true)} icone={<UserPlus className="size-4" aria-hidden />}>
            Novo
          </Botao>
        </div>
        <p className="px-1 text-xs text-texto-fraco">Você faz o papel do cliente. Só dados fictícios.</p>
        {!dados && <Carregando linhas={3} />}
        <ul className="rolagem-fina -mx-1 flex-1 space-y-1 overflow-y-auto lg:max-h-[calc(100dvh-14rem)]">
          {dados?.contatos.map((c) => (
            <li key={c.telefone}>
              <button
                onClick={() => abrirContato(c.telefone)}
                className={juntar("flex min-h-toque w-full items-center gap-3 rounded-controle px-2 py-2 text-left hover:bg-superficie-suave", telefone === c.telefone && "bg-marca-suave")}
              >
                <Avatar nome={c.nome} cor={c.avatarCor} tamanho="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.nome}</span>
                  <span className="block truncate text-xs text-texto-fraco">{c.previa}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Conversa do lado do cliente */}
      <section className={juntar("flex min-h-[32rem] flex-col overflow-hidden rounded-painel border border-borda bg-chat-fundo shadow-painel lg:h-[calc(100dvh-8rem)]", !telefone && "hidden lg:flex")}>
        {!telefone ? (
          <div className="m-auto max-w-xs p-6">
            <EstadoVazio titulo="Escolha um cliente ou crie um novo" texto="As mensagens que você enviar aqui chegam ao bot como se viessem do WhatsApp." icone={<Smartphone className="size-6 text-texto-fraco" aria-hidden />} />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 bg-whatsapp-escuro px-3 py-2 text-sobre-cor">
              <button onClick={() => setTelefone(null)} className="inline-flex size-toque shrink-0 items-center justify-center rounded-controle lg:hidden" aria-label="Voltar para a lista">
                <X className="size-5" aria-hidden />
              </button>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-sobre-cor/15 text-sm font-bold">E</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">Eccellenza Planejados</p>
                <p className="truncate text-xs">
                  Você é: {conversa?.nome ?? nomeNovo ?? formatarTelefone(normalizarTelefone(telefone) ?? telefone)}
                </p>
              </div>
              {conversa && (
                <Link href={`/lead/${conversa.leadId}`} className="ml-auto inline-flex min-h-toque shrink-0 items-center whitespace-nowrap rounded-controle bg-sobre-cor/15 px-3 text-xs font-medium hover:bg-sobre-cor/25">
                  Ver ficha
                </Link>
              )}
            </header>
            <div className="rolagem-fina flex-1 overflow-y-auto p-4">
              <ListaMensagens mensagens={mensagens} lado="cliente" digitando={enviando} />
            </div>
            {conversa?.erroBot && <p className="bg-alerta-suave px-4 py-2 text-xs text-alerta">Aviso do sistema: o bot não respondeu ({conversa.erroBot}).</p>}
            <form onSubmit={enviar} className="space-y-2 bg-superficie-suave p-2">
              {imagem && (
                <p className="flex items-center gap-2 rounded-controle bg-superficie px-3 py-2 text-xs">
                  📷 {imagem.name}
                  <button type="button" onClick={() => setImagem(null)} className="ml-auto inline-flex size-toque items-center justify-center" aria-label="Remover imagem">
                    <X className="size-4" aria-hidden />
                  </button>
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={refArquivo}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,video/mp4,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > TAMANHO_MAXIMO_IMAGEM) avisar("Imagem maior que 5 MB.", "erro");
                    else setImagem(f ?? null);
                    e.target.value = "";
                  }}
                />
                <button type="button" onClick={() => refArquivo.current?.click()} className="inline-flex size-toque shrink-0 items-center justify-center rounded-full text-texto-suave hover:bg-superficie" aria-label="Enviar imagem (foto ou planta)">
                  <ImagePlus className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setTexto((t) => (t.startsWith("[áudio transcrito]") ? t : `[áudio transcrito] ${t}`))}
                  className="inline-flex size-toque shrink-0 items-center justify-center rounded-full text-texto-suave hover:bg-superficie"
                  aria-label="Simular áudio transcrito"
                  title="Simular áudio (texto transcrito)"
                >
                  <Mic className="size-5" aria-hidden />
                </button>
                <input className={juntar(classeEntrada, "rounded-pilula")} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mensagem" aria-label="Mensagem do cliente" disabled={enviando} />
                <button type="submit" disabled={enviando || (!texto.trim() && !imagem)} className="inline-flex size-toque shrink-0 items-center justify-center rounded-full bg-whatsapp text-sobre-cor transition active:scale-95 disabled:opacity-50" aria-label="Enviar">
                  <Send className="size-5" aria-hidden />
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      <Relogio />

      <Modal aberto={criar} aoFechar={() => setCriar(false)} titulo="Novo cliente fictício" largura="max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const tel = normalizarTelefone(formNovo.telefone);
            if (!tel) return avisar("Telefone inválido.", "erro");
            abrirContato(tel, formNovo.nome.trim() || undefined);
            setCriar(false);
            setFormNovo({ nome: "", telefone: telefoneAleatorio() });
          }}
        >
          <Campo rotulo="Nome no perfil do WhatsApp" dica="Fictício. Pode ser um apelido ou frase, para testar a regra do nome.">
            <input className={classeEntrada} value={formNovo.nome} onChange={(e) => setFormNovo({ ...formNovo, nome: e.target.value })} placeholder="Ex.: Ana Souza" />
          </Campo>
          <Campo rotulo="Telefone" dica="Números terminados em 0000 simulam número sem WhatsApp.">
            <input className={classeEntrada} value={formNovo.telefone} onChange={(e) => setFormNovo({ ...formNovo, telefone: e.target.value })} inputMode="tel" />
          </Campo>
          <Botao type="submit" variante="primario" icone={<Plus className="size-4" aria-hidden />}>
            Começar conversa
          </Botao>
        </form>
      </Modal>
    </div>
  );
}
