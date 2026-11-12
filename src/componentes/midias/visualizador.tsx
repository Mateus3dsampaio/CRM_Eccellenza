"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, X } from "lucide-react";

export interface MidiaAberta {
  /** Endereço do arquivo (rota protegida `/api/midias/...`). */
  url: string;
  familia: "imagem" | "video" | "documento";
  nome: string;
  /** Linha de detalhes abaixo do nome (tipo, tamanho, cliente, data). */
  detalhe?: string;
}

/**
 * Visualizador de mídia dentro do app: a imagem (ou vídeo) ocupa a tela, com X para fechar.
 * Existe porque no app instalado no iPhone não há "outra aba" nem botão de voltar: abrir o arquivo
 * direto prendia a pessoa na imagem. Fecha no X, no Esc e ao tocar fora da imagem.
 */
export function VisualizadorMidia({ midia, aoFechar, acoes }: { midia: MidiaAberta | null; aoFechar: () => void; acoes?: ReactNode }) {
  const refFechar = useRef(aoFechar);
  const refBotao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    refFechar.current = aoFechar;
  });
  useEffect(() => {
    if (!midia) return;
    const tecla = (e: KeyboardEvent) => {
      // Uma janela de confirmação aberta por cima (apagar arquivo) fecha primeiro.
      if (e.key === "Escape" && document.querySelectorAll("[role=dialog][aria-modal=true]").length <= 1) refFechar.current();
    };
    document.addEventListener("keydown", tecla);
    refBotao.current?.focus();
    return () => document.removeEventListener("keydown", tecla);
  }, [midia]);

  if (!midia || typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Arquivo ${midia.nome}`} data-visualizador className="fixed inset-0 z-[65] flex animate-surgir flex-col bg-black/92">
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white" title={midia.nome}>
            {midia.nome}
          </p>
          {midia.detalhe && <p className="truncate text-xs text-white/65">{midia.detalhe}</p>}
        </div>
        <button ref={refBotao} type="button" onClick={aoFechar} aria-label="Fechar" title="Fechar" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/22">
          <X className="size-6" aria-hidden />
        </button>
      </div>

      {/* Tocar fora da imagem fecha. */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-3" onClick={aoFechar}>
        {midia.familia === "imagem" ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem servida por rota protegida
          <img src={midia.url} alt={midia.nome} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-controle object-contain shadow-flutuante" />
        ) : midia.familia === "video" ? (
          <video src={midia.url} controls playsInline preload="metadata" onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-controle bg-black" aria-label={midia.nome} />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center text-white/80" onClick={(e) => e.stopPropagation()}>
            <FileText className="size-16 text-alerta" aria-hidden />
            <p className="max-w-xs text-sm">Este tipo de arquivo não abre na tela. Use “Baixar”.</p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
        <a href={`${midia.url}?baixar=1`} className="inline-flex min-h-toque items-center gap-2 rounded-controle bg-white/12 px-4 text-sm font-medium text-white transition hover:bg-white/22">
          <Download className="size-4" aria-hidden /> Baixar
        </a>
        {acoes}
      </div>
    </div>,
    document.body,
  );
}

/** Classe dos botões extras passados em `acoes` (mesmo visual do "Baixar"). */
export const classeAcaoVisualizador = "inline-flex min-h-toque items-center gap-2 rounded-controle bg-white/12 px-4 text-sm font-medium text-white transition hover:bg-white/22";
