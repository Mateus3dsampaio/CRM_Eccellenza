"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Save, Undo2 } from "lucide-react";
import { Botao, Modal } from "../ui";

// Barra de salvar das Configurações (tarefa 31): cada bloco editável se registra com "mudou?", "salvar" e "descartar".
// A barra aparece no rodapé só quando algum bloco mudou; um Salvar grava todos. Sair da seção com mudança pendente pergunta.
interface Registro {
  mudou: boolean;
  salvar: () => Promise<void>;
  descartar: () => void;
}

interface ContextoBarra {
  registrar: (chave: string, registro: Registro | null) => void;
  /** Quer trocar de seção? Se houver mudança pendente, pergunta antes; senão, segue. */
  pedirSaida: (seguir: () => void) => void;
}

const Contexto = createContext<ContextoBarra | null>(null);

/** Bloco editável: chama a cada render com o estado atual. Fora do provedor (ex.: tela sem barra) não faz nada. */
export function useBlocoSalvavel(chave: string, registro: Registro) {
  const ctx = useContext(Contexto);
  const { mudou } = registro;
  const vivo = useRef(registro);
  useEffect(() => {
    vivo.current = registro;
  });
  useEffect(() => {
    if (!ctx) return;
    ctx.registrar(chave, { mudou, salvar: () => vivo.current.salvar(), descartar: () => vivo.current.descartar() });
  }, [ctx, chave, mudou]);
  useEffect(() => () => ctx?.registrar(chave, null), [ctx, chave]);
}

export function useBarraSalvar() {
  const ctx = useContext(Contexto);
  return ctx ?? { registrar: () => {}, pedirSaida: (seguir: () => void) => seguir() };
}

export function ProvedorBarraSalvar({ children }: { children: ReactNode }) {
  const [registros, setRegistros] = useState<Record<string, Registro>>({});
  // O contexto precisa ser estável (senão os blocos se registram de novo a cada mudança, em laço): lê os registros por ref.
  const registrosRef = useRef(registros);
  useEffect(() => {
    registrosRef.current = registros;
  });
  const [salvando, setSalvando] = useState(false);
  const [saida, setSaida] = useState<(() => void) | null>(null);

  const registrar = useCallback((chave: string, registro: Registro | null) => {
    setRegistros((r) => {
      if (!registro) {
        if (!(chave in r)) return r;
        const { [chave]: _fora, ...resto } = r;
        void _fora;
        return resto;
      }
      return { ...r, [chave]: registro };
    });
  }, []);

  const pendentes = Object.values(registros).filter((r) => r.mudou);
  const temPendente = pendentes.length > 0;

  const salvarTudo = useCallback(async () => {
    setSalvando(true);
    try {
      for (const r of Object.values(registros)) if (r.mudou) await r.salvar();
    } finally {
      setSalvando(false);
    }
  }, [registros]);
  const descartarTudo = useCallback(() => Object.values(registros).forEach((r) => r.mudou && r.descartar()), [registros]);

  const pedirSaida = useCallback((seguir: () => void) => {
    if (!Object.values(registrosRef.current).some((r) => r.mudou)) return seguir();
    setSaida(() => seguir);
  }, []);

  // Fechar a aba do navegador com mudança pendente: o navegador avisa.
  useEffect(() => {
    if (!temPendente) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [temPendente]);

  const valor = useMemo(() => ({ registrar, pedirSaida }), [registrar, pedirSaida]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {temPendente && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-4">
          <div role="status" className="pointer-events-auto flex w-full max-w-2xl animate-surgir items-center gap-3 rounded-painel border border-marca/40 bg-superficie px-4 py-2.5 shadow-flutuante">
            <span className="text-sm font-medium">
              Alterações não salvas
              <span className="text-texto-suave"> · {pendentes.length === 1 ? "1 bloco" : `${pendentes.length} blocos`}</span>
            </span>
            <div className="ml-auto flex gap-2">
              <Botao variante="fantasma" onClick={descartarTudo} disabled={salvando} icone={<Undo2 className="size-4" aria-hidden />}>
                Descartar
              </Botao>
              <Botao variante="primario" onClick={salvarTudo} carregando={salvando} icone={<Save className="size-4" aria-hidden />}>
                Salvar
              </Botao>
            </div>
          </div>
        </div>
      )}
      <Modal aberto={saida !== null} aoFechar={() => setSaida(null)} titulo="Alterações não salvas" largura="max-w-md">
        <p className="text-sm text-texto-suave">Você mudou algo nesta seção e ainda não salvou. O que quer fazer?</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setSaida(null)}>
            Continuar editando
          </Botao>
          <Botao
            onClick={() => {
              descartarTudo();
              saida?.();
              setSaida(null);
            }}
          >
            Descartar e sair
          </Botao>
          <Botao
            variante="primario"
            carregando={salvando}
            onClick={async () => {
              await salvarTudo();
              saida?.();
              setSaida(null);
            }}
          >
            Salvar e sair
          </Botao>
        </div>
      </Modal>
    </Contexto.Provider>
  );
}
