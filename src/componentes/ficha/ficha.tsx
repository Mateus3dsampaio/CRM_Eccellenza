"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Trash2 } from "lucide-react";
import { nomeEtapa } from "@/regras/etapas";
import { formatarDataHora } from "@/regras/tempo";
import type { FichaLead } from "@/servicos/consultas";
import { chamarApi, useAviso, useDados } from "../dados";
import { COR_ETAPA, juntar } from "../estilos";
import { Avatar, Botao, Carregando, EstadoErro, Modal, Sino, classeEntrada } from "../ui";
import { usePode } from "../usuario";
import { ConversaConsultor } from "./conversa";
import { DadosLead, Painel } from "./dados-lead";

type Aba = "conversa" | "ficha" | "notas";

export function Ficha({ id }: { id: string }) {
  const { dados: ficha, erro, carregando, recarregar } = useDados<FichaLead>(`/api/leads/${id}`);
  const router = useRouter();
  const avisar = useAviso();
  const podeExcluir = usePode("excluir_lead");
  const [aba, setAba] = useState<Aba>("conversa");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  if (carregando && !ficha) return <div className="mx-auto w-full max-w-6xl p-4"><Carregando linhas={4} /></div>;
  if (!ficha) return <div className="mx-auto w-full max-w-6xl p-4"><EstadoErro texto={erro ?? "Lead não encontrado. Ele pode ter sido excluído."} aoTentar={recarregar} /></div>;

  async function acao(corpo: object, sucesso: string, depois?: () => void) {
    try {
      await chamarApi("/api/leads/acoes", { method: "POST", json: { ...corpo, ids: [id] } });
      avisar(sucesso);
      depois?.();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível concluir.", "erro");
    } finally {
      void recarregar();
    }
  }

  async function restaurar() {
    try {
      await chamarApi(`/api/leads/${id}`, { method: "PATCH", json: { restaurar: true } });
      avisar("Lead restaurado.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível restaurar.", "erro");
    } finally {
      void recarregar();
    }
  }

  const abas: { id: Aba; rotulo: string }[] = [
    { id: "conversa", rotulo: "Conversa" },
    { id: "ficha", rotulo: "Ficha" },
    { id: "notas", rotulo: "Notas" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie" aria-label="Voltar ao kanban">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <Avatar nome={ficha.nomeExibicao} cor={ficha.avatarCor} tamanho="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="truncate">{ficha.nomeExibicao}</span>
            {ficha.aguardandoHumano && <Sino />}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-texto-suave">
            <span>{ficha.telefone}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className={juntar("size-2 rounded-full", COR_ETAPA[ficha.etapa])} aria-hidden />
              {nomeEtapa(ficha.etapa)}
            </span>
            {ficha.arquivado && <span className="font-medium text-aviso">Arquivado</span>}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          {ficha.arquivado ? (
            <Botao onClick={restaurar} icone={<ArchiveRestore className="size-4" aria-hidden />}>Restaurar</Botao>
          ) : (
            <Botao onClick={() => acao({ acao: "arquivar" }, "Lead arquivado.", () => router.push("/"))} icone={<Archive className="size-4" aria-hidden />}>
              Arquivar
            </Botao>
          )}
          {podeExcluir && (
            <Botao variante="perigo" onClick={() => setConfirmarExclusao(true)} icone={<Trash2 className="size-4" aria-hidden />}>
              <span className="hidden sm:inline">Excluir</span>
              <span className="sr-only sm:hidden">Excluir</span>
            </Botao>
          )}
        </div>
      </div>

      {/* Celular: abas */}
      <div className="flex gap-1 rounded-controle bg-superficie p-1 shadow-card lg:hidden" role="tablist">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={juntar("min-h-toque flex-1 rounded-controle text-sm font-medium transition", aba === a.id ? "bg-marca text-sobre-marca" : "text-texto-suave")}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className={juntar("min-w-0 space-y-4", aba !== "ficha" && "hidden lg:block")}>
          <DadosLead ficha={ficha} aoMudar={recarregar} />
        </div>
        <div className={juntar("flex min-h-0 min-w-0 flex-col gap-4", aba === "ficha" && "hidden lg:flex")}>
          <div className={juntar("flex min-h-[28rem] flex-col lg:h-[calc(100dvh-12rem)]", aba !== "conversa" && "hidden lg:flex")}>
            <ConversaConsultor ficha={ficha} aoMudar={recarregar} />
          </div>
          <div className={juntar(aba !== "notas" && "hidden lg:block", "space-y-4")}>
            <Notas ficha={ficha} aoMudar={recarregar} />
            <Historico ficha={ficha} />
          </div>
        </div>
      </div>

      <Modal aberto={confirmarExclusao} aoFechar={() => setConfirmarExclusao(false)} titulo="Excluir de vez" largura="max-w-md">
        <p className="text-sm text-texto-suave">Excluir 1 lead? Mensagens, fotos e plantas também serão apagadas. Não dá para desfazer.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setConfirmarExclusao(false)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={() => acao({ acao: "excluir" }, "Lead excluído.", () => router.push("/"))}>Excluir</Botao>
        </div>
      </Modal>
    </div>
  );
}

function Notas({ ficha, aoMudar }: { ficha: FichaLead; aoMudar: () => void }) {
  const avisar = useAviso();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  return (
    <Painel titulo="Notas internas">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          setSalvando(true);
          try {
            await chamarApi(`/api/leads/${ficha.id}/notas`, { method: "POST", json: { texto } });
            setTexto("");
            avisar("Nota salva.");
          } catch (erro) {
            avisar(erro instanceof Error ? erro.message : "Não foi possível salvar.", "erro");
          } finally {
            setSalvando(false);
            aoMudar();
          }
        }}
      >
        <input className={classeEntrada} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva uma nota (o cliente não vê)" aria-label="Nova nota" />
        <Botao type="submit" variante="primario" carregando={salvando} disabled={!texto.trim()} className="whitespace-nowrap">
          Salvar nota
        </Botao>
      </form>
      <ul className="mt-3 space-y-2">
        {ficha.notas.length === 0 && <li className="text-sm text-texto-suave">Nenhuma nota.</li>}
        {ficha.notas.map((n) => (
          <li key={n.id} className="rounded-controle bg-superficie-suave p-3 text-sm">
            <p className="whitespace-pre-wrap">{n.texto}</p>
            <p className="mt-1 text-xs text-texto-fraco">
              {n.autorNome} · {formatarDataHora(new Date(n.criadoEm))}
            </p>
          </li>
        ))}
      </ul>
    </Painel>
  );
}

function Historico({ ficha }: { ficha: FichaLead }) {
  return (
    <Painel titulo="Histórico de alterações">
      <ol className="max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
        {ficha.historico.map((h) => (
          <li key={h.id} className="flex gap-3 border-l-2 border-borda pl-3">
            <div className="min-w-0">
              <p>{h.descricao}</p>
              <p className="text-xs text-texto-fraco">
                {h.autor === "bot" ? "Bot" : h.autor === "sistema" ? "Sistema" : h.autor} · {formatarDataHora(new Date(h.criadoEm))}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Painel>
  );
}
