"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Bell, CheckCircle2, X } from "lucide-react";
import { juntar } from "./estilos";

/** Chamada à API com mensagem de erro em português. */
export async function chamarApi<T = unknown>(url: string, opcoes?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...resto } = opcoes ?? {};
  const resposta = await fetch(url, {
    ...resto,
    headers: json !== undefined ? { "Content-Type": "application/json", ...resto.headers } : resto.headers,
    body: json !== undefined ? JSON.stringify(json) : resto.body,
  });
  if (resposta.status === 401 && typeof window !== "undefined") {
    window.location.assign(new URL("/login", window.location.origin));
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados?.erro ?? "Algo deu errado. Tente de novo.");
  return dados as T;
}

// Versão dos dados: todas as telas recarregam quando muda (bot movendo cards, rotinas etc.).
const ContextoVersao = createContext<{ versao: number; agora: string | null; avisar: () => void }>({ versao: 0, agora: null, avisar: () => {} });

export function ProvedorVersao({ children }: { children: ReactNode }) {
  const [versao, setVersao] = useState(0);
  const [agora, setAgora] = useState<string | null>(null);
  const consultar = useCallback(async () => {
    try {
      const r = await chamarApi<{ versao: number; agora: string }>("/api/versao");
      setVersao(r.versao);
      setAgora(r.agora);
    } catch {
      // Sem conexão: tenta de novo no próximo ciclo.
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira consulta ao abrir a tela
    void consultar();
    const id = setInterval(consultar, 2000);
    return () => clearInterval(id);
  }, [consultar]);
  return <ContextoVersao.Provider value={{ versao, agora, avisar: consultar }}>{children}</ContextoVersao.Provider>;
}

export const useVersao = () => useContext(ContextoVersao);

/** Carrega dados de uma rota e recarrega sozinho quando a versão muda. */
export function useDados<T>(url: string | null) {
  const { versao } = useVersao();
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const urlAtual = useRef(url);

  const carregar = useCallback(async () => {
    if (!url) return;
    urlAtual.current = url;
    try {
      const r = await chamarApi<T>(url);
      if (urlAtual.current === url) {
        setDados(r);
        setErro(null);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setCarregando(false);
    }
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega ao mudar a versão ou a rota
    void carregar();
  }, [carregar, versao]);

  return { dados, erro, carregando, recarregar: carregar, setDados };
}

// Avisos rápidos (toasts), tarefa 25: canto inferior direito, no máximo 3 visíveis (o resto vira "e mais N"),
// somem sozinhos (ok/erro em 6 s, alerta em 15 s), o mouse em cima pausa e clicar no X fecha.
export type TipoAviso = "ok" | "erro" | "alerta";
export interface OpcoesAviso {
  /** Botão dentro do toast (ex.: "Abrir" a gaveta do lead). */
  acao?: { rotulo: string; aoClicar: () => void };
}
type Aviso = { id: number; texto: string; tipo: TipoAviso; acao?: OpcoesAviso["acao"]; venceEm: number };
export type Avisar = (texto: string, tipo?: TipoAviso, opcoes?: OpcoesAviso) => void;
const ContextoAviso = createContext<Avisar>(() => {});
const MAXIMO_VISIVEIS = 3;
const DURACAO: Record<TipoAviso, number> = { ok: 6000, erro: 6000, alerta: 15000 };
const COR_AVISO: Record<TipoAviso, string> = { ok: "text-sucesso", erro: "text-alerta", alerta: "text-aviso" };

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const pausado = useRef(false);
  const avisar = useCallback<Avisar>((texto, tipo = "ok", opcoes) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo, acao: opcoes?.acao, venceEm: Date.now() + DURACAO[tipo] }]);
  }, []);
  const fechar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);

  // Um relógio só para todos: a cada meio segundo tira os vencidos (se o mouse não estiver em cima).
  useEffect(() => {
    if (!avisos.length) return;
    const t = setInterval(() => {
      if (pausado.current) {
        // Pausado: empurra o vencimento para a frente, para o aviso não sumir logo ao tirar o mouse.
        setAvisos((a) => a.map((x) => ({ ...x, venceEm: x.venceEm + 500 })));
        return;
      }
      const agora = Date.now();
      setAvisos((a) => (a.some((x) => x.venceEm <= agora) ? a.filter((x) => x.venceEm > agora) : a));
    }, 500);
    return () => clearInterval(t);
  }, [avisos.length]);

  const visiveis = avisos.slice(0, MAXIMO_VISIVEIS);
  const sobra = avisos.length - visiveis.length;
  return (
    <ContextoAviso.Provider value={avisar}>
      {children}
      <div
        data-avisos
        className="pointer-events-none fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[380px] md:bottom-4"
        aria-live="polite"
        onMouseEnter={() => (pausado.current = true)}
        onMouseLeave={() => (pausado.current = false)}
      >
        {visiveis.map((a) => (
          <div
            key={a.id}
            role={a.tipo === "erro" ? "alert" : "status"}
            className="vidro vidro-escuro pointer-events-auto relative flex w-full animate-surgir items-start gap-2 rounded-controle py-2.5 pl-4 pr-3 text-sm font-medium text-texto"
          >
            {/* Vidro escuro igual nos três; a cor (verde, vermelho, âmbar) fica só no filete e no ícone. */}
            <span className={juntar("filete-aviso", COR_AVISO[a.tipo])} aria-hidden />
            {a.tipo === "erro" ? <AlertTriangle className={juntar("mt-0.5 size-4 shrink-0", COR_AVISO.erro)} aria-hidden /> : a.tipo === "alerta" ? <Bell className={juntar("mt-0.5 size-4 shrink-0", COR_AVISO.alerta)} aria-hidden /> : <CheckCircle2 className={juntar("mt-0.5 size-4 shrink-0", COR_AVISO.ok)} aria-hidden />}
            <span className="min-w-0 flex-1">{a.texto}</span>
            {a.acao && (
              <button
                type="button"
                onClick={() => {
                  a.acao?.aoClicar();
                  fechar(a.id);
                }}
                className="shrink-0 rounded-controle bg-marca px-2 py-0.5 text-xs font-semibold text-sobre-marca hover:bg-marca-forte"
              >
                {a.acao.rotulo}
              </button>
            )}
            <button type="button" onClick={() => fechar(a.id)} className="-mr-1 -mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-controle opacity-70 hover:opacity-100" aria-label="Fechar aviso">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {sobra > 0 && (
          <button type="button" onClick={() => setAvisos((a) => a.slice(1))} className="pointer-events-auto rounded-pilula bg-superficie px-3 py-1 text-xs font-medium text-texto-suave shadow-card hover:text-texto">
            e mais {sobra} {sobra === 1 ? "aviso" : "avisos"}
          </button>
        )}
      </div>
    </ContextoAviso.Provider>
  );
}

export const useAviso = () => useContext(ContextoAviso);
