"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
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

// Avisos rápidos (toasts).
type Aviso = { id: number; texto: string; tipo: "ok" | "erro" };
const ContextoAviso = createContext<(texto: string, tipo?: "ok" | "erro") => void>(() => {});

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: "ok" | "erro" = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ContextoAviso.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === "erro" ? "alert" : "status"}
            className={juntar(
              "pointer-events-auto flex max-w-md animate-surgir items-center gap-2 rounded-controle px-4 py-3 text-sm font-medium shadow-flutuante",
              a.tipo === "erro" ? "bg-alerta text-sobre-cor" : "bg-texto text-sobre-cor",
            )}
          >
            {a.tipo === "erro" ? <AlertTriangle className="size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
            {a.texto}
          </div>
        ))}
      </div>
    </ContextoAviso.Provider>
  );
}

export const useAviso = () => useContext(ContextoAviso);
