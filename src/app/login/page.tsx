"use client";

import "./login.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowBigUp, Eye, EyeOff, LogIn } from "lucide-react";
import { Botao, Campo, classeEntrada } from "@/componentes/ui";
import type { Cena } from "@/componentes/login/cena/cena";

/**
 * Login com a cena "Da conversa ao card" (tarefa 46): a mensagem do cliente vira card e anda pelo funil, atrás do
 * cartão. A cena (`componentes/login/cena/`, GSAP) só é baixada nesta tela e é enfeite: se não carregar, o
 * formulário funciona igual. PC: cena à esquerda, cartão à direita. Celular em pé: cena em cima, cartão embaixo.
 * O login antigo (esfera de pontos) está guardado em `docs/legado/login-esfera/`.
 */
export default function PaginaLogin() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [caps, setCaps] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const mundo = useRef<HTMLDivElement>(null);
  const nevoa = useRef<HTMLDivElement>(null);
  const esfera = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const lugarEsfera = useRef<HTMLSpanElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const cena = useRef<Cena | null>(null);

  useEffect(() => {
    router.prefetch("/");
    let ativo = true;
    let iniciada: Cena | null = null;
    import("@/componentes/login/cena/cena")
      .then(({ iniciarCena }) => {
        if (!ativo || !raiz.current || !palco.current || !mundo.current || !nevoa.current || !esfera.current || !cursor.current || !lugarEsfera.current) return null;
        return iniciarCena({ raiz: raiz.current, palco: palco.current, mundo: mundo.current, nevoa: nevoa.current, esfera: esfera.current, cursor: cursor.current, lugarEsfera: lugarEsfera.current });
      })
      .then((c) => {
        if (!c) return;
        if (!ativo) c.parar();
        else cena.current = iniciada = c;
      })
      .catch(() => {
        // Sem a cena, fica só o fundo com a luz da marca.
      });
    return () => {
      ativo = false;
      iniciada?.parar();
      cena.current = null;
    };
  }, [router]);

  function balancar() {
    const f = formulario.current;
    if (!f) return;
    f.classList.remove("login-balanca");
    void f.offsetWidth; // reinicia a animação
    f.classList.add("login-balanca");
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, senha }) });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro ?? "Não foi possível entrar.");
      // A câmera mergulha no quadro enquanto o kanban já está pré-carregado.
      await cena.current?.mergulhar().catch(() => {});
      router.push("/");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
      setEntrando(false);
      balancar();
    }
  }

  const verCaps = (e: React.KeyboardEvent) => setCaps(e.getModifierState("CapsLock"));

  return (
    <main className="relative min-h-dvh overflow-x-hidden min-[900px]:h-dvh min-[900px]:overflow-hidden">
      <div ref={raiz} className="cena-login login-fundo" aria-hidden>
        <div ref={palco} className="palco">
          <div ref={mundo} className="mundo" />
        </div>
        <div ref={nevoa} className="nevoa" />
        <canvas ref={esfera} className="esfera" />
        <div ref={cursor} className="cursor">
          <span className="onda" />
          <svg className="seta" width="22" height="24" viewBox="0 0 22 24">
            <path d="M2 2v18.5l5.2-4.6 3.6 7.6 3.3-1.6-3.6-7.4h7z" fill="#fff" stroke="#0a1222" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span className="tag">Rafael</span>
        </div>
      </div>

      <div className="pointer-events-none relative z-[3] grid min-h-dvh grid-rows-[52dvh_auto] min-[900px]:h-dvh min-[900px]:grid-cols-[minmax(0,1fr)_460px] min-[900px]:grid-rows-1">
        <section className="relative">
          <p className="absolute left-5 top-[calc(env(safe-area-inset-top)+16px)] flex items-center gap-3 text-xs font-extrabold tracking-[0.32em] text-texto-suave min-[900px]:left-16 min-[900px]:top-9 min-[900px]:text-[13px]" aria-hidden>
            <span ref={lugarEsfera} className="inline-block size-[22px]" />
            ECCELLENZA
          </p>
        </section>
        <section className="pointer-events-auto flex items-start justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] min-[900px]:items-center min-[900px]:py-6 min-[900px]:pl-0 min-[900px]:pr-12">
          <div className="login-entrada w-full max-w-sm">
            <form ref={formulario} onSubmit={entrar} onAnimationEnd={() => formulario.current?.classList.remove("login-balanca")} className="vidro space-y-3 rounded-painel p-5 min-[900px]:space-y-4 min-[900px]:p-6">
              <div className="mb-3 text-center min-[900px]:mb-5">
                <h1 className="pl-[0.16em] text-xl font-extrabold tracking-[0.16em] min-[900px]:text-2xl">ECCELLENZA</h1>
                <p className="mt-1 text-sm text-texto-suave min-[900px]:mt-1.5">CRM de atendimento</p>
              </div>
              <Campo rotulo="Usuário">
                <input className={classeEntrada} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus required />
              </Campo>
              <Campo rotulo="Senha">
                <span className="relative block">
                  <input
                    className={`${classeEntrada} pr-12`}
                    type={verSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    onKeyDown={verCaps}
                    onKeyUp={verCaps}
                    onBlur={() => setCaps(false)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    aria-label={verSenha ? "Esconder a senha digitada" : "Mostrar a senha digitada"}
                    title={verSenha ? "Esconder" : "Mostrar"}
                    className="botao-icone absolute right-1 top-1/2 -translate-y-1/2"
                  >
                    {verSenha ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </span>
              </Campo>
              {caps && (
                <p role="status" className="flex items-center gap-1.5 text-xs font-medium text-aviso">
                  <ArrowBigUp className="size-3.5" aria-hidden /> Caps Lock ligado
                </p>
              )}
              {erro && (
                <p role="alert" className="rounded-controle bg-alerta-suave px-3 py-2 text-sm text-alerta">
                  {erro}
                </p>
              )}
              <Botao type="submit" variante="primario" className="w-full" carregando={entrando} icone={<LogIn className="size-4" aria-hidden />}>
                Entrar
              </Botao>
            </form>
            <p className="mt-2 text-center text-xs text-texto-fraco min-[900px]:hidden">No iPhone: toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot; para abrir como app.</p>
            <p className="mt-2 text-center text-xs tabular-nums text-texto-fraco min-[900px]:mt-4">Versão {process.env.NEXT_PUBLIC_VERSAO}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
