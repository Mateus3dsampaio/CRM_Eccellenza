"use client";

import { Bell, Check, CheckCheck, Inbox, Loader2, X, AlertTriangle } from "lucide-react";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { nomeEtiqueta } from "@/regras/etapas";
import { COR_AVATAR, COR_ETIQUETA, juntar } from "./estilos";

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

// Primário, secundário e perigo são "teclas" (classes em globals.css): lateral sólida que afunda ao clicar.
const VARIANTES: Record<Variante, string> = {
  primario: "tecla-pri text-sobre-marca",
  secundario: "tecla text-texto",
  fantasma: "text-texto-suave hover:bg-superficie-suave hover:text-texto active:scale-[0.97]",
  perigo: "tecla-perigo text-sobre-marca",
};

export function Botao({
  variante = "secundario",
  carregando,
  icone,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; icone?: ReactNode }) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={juntar(
        "inline-flex min-h-toque items-center justify-center gap-2 rounded-controle px-4 text-sm font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTES[variante],
        className,
      )}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  );
}

export function iniciais(nome: string): string {
  const partes = nome.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ nome, cor, tamanho = "md" }: { nome: string; cor: number; tamanho?: "sm" | "md" | "lg" }) {
  const t = tamanho === "sm" ? "size-8 text-xs" : tamanho === "lg" ? "size-14 text-lg" : "size-10 text-sm";
  return (
    <span aria-hidden className={juntar("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-sobre-cor", t, COR_AVATAR[cor % COR_AVATAR.length])}>
      {iniciais(nome)}
    </span>
  );
}

export function Etiqueta({ codigo, aoRemover }: { codigo: string; aoRemover?: () => void }) {
  return (
    <span className={juntar("inline-flex items-center gap-1 rounded-pilula px-2.5 py-0.5 text-xs font-medium", COR_ETIQUETA[codigo] ?? "bg-superficie-suave text-texto-suave")}>
      {nomeEtiqueta(codigo)}
      {aoRemover && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            aoRemover();
          }}
          className="-mr-1 inline-flex size-5 items-center justify-center rounded-full hover:bg-superficie/60"
          aria-label={`Remover etiqueta ${nomeEtiqueta(codigo)}`}
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}

export function Sino({ titulo = "Cliente aguardando resposta humana" }: { titulo?: string }) {
  return (
    <span title={titulo} className="inline-flex text-alerta">
      <Bell className="size-4 fill-current" aria-hidden />
      <span className="sr-only">{titulo}</span>
    </span>
  );
}

/** Ícones de status da mensagem (MSG-03). */
export function StatusMensagem({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "falhou")
    return (
      <span title="Falhou: número sem WhatsApp" className="inline-flex items-center gap-1 text-alerta">
        <AlertTriangle className="size-3.5" aria-hidden />
        <span className="text-[11px] font-medium">falhou</span>
      </span>
    );
  if (status === "enviado")
    return (
      <span title="Enviado" className="text-texto-fraco">
        <Check className="size-4" aria-label="Enviado" />
      </span>
    );
  if (status === "entregue")
    return (
      <span title="Entregue" className="text-texto-fraco">
        <CheckCheck className="size-4" aria-label="Entregue" />
      </span>
    );
  return (
    <span title="Lido" className="text-check-lido">
      <CheckCheck className="size-4" aria-label="Lido" />
    </span>
  );
}

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="h-20 animate-brilho rounded-card bg-superficie shadow-card" />
      ))}
    </div>
  );
}

export function EstadoVazio({ titulo, texto, icone }: { titulo: string; texto?: string; icone?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-borda-forte px-4 py-8 text-center">
      {icone ?? <Inbox className="size-6 text-texto-fraco" aria-hidden />}
      <p className="text-sm font-medium text-texto-suave">{titulo}</p>
      {texto && <p className="text-xs text-texto-fraco">{texto}</p>}
    </div>
  );
}

export function EstadoErro({ texto, aoTentar }: { texto: string; aoTentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-card border border-alerta/30 bg-alerta-suave px-4 py-6 text-center">
      <AlertTriangle className="size-6 text-alerta" aria-hidden />
      <p className="text-sm text-texto">{texto}</p>
      {aoTentar && <Botao onClick={aoTentar}>Tentar de novo</Botao>}
    </div>
  );
}

export function Modal({ aberto, aoFechar, titulo, children, largura = "max-w-lg" }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode; largura?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // aoFechar costuma ser uma função nova a cada render; guardada em ref para o efeito
  // não rodar de novo (e devolver o foco ao primeiro campo) a cada tecla digitada.
  const refFechar = useRef(aoFechar);
  useEffect(() => {
    refFechar.current = aoFechar;
  });
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && refFechar.current();
    document.addEventListener("keydown", tecla);
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    return () => document.removeEventListener("keydown", tecla);
  }, [aberto]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-texto/40 p-0 sm:items-center sm:p-4" onMouseDown={aoFechar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
        className={juntar("max-h-[92dvh] w-full animate-surgir overflow-y-auto rounded-t-painel bg-superficie p-5 shadow-flutuante sm:rounded-painel", largura)}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button onClick={aoFechar} className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave" aria-label="Fechar">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-texto">{rotulo}</span>
      {children}
      {dica && <span className="block text-xs text-texto-fraco">{dica}</span>}
    </label>
  );
}

export const classeEntrada =
  "w-full min-h-toque rounded-controle border border-borda bg-superficie px-3 py-2 text-sm text-texto placeholder:text-texto-fraco focus:border-marca focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-marca/25";
