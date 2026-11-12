"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogIn } from "lucide-react";
import { Botao, Campo, classeEntrada } from "@/componentes/ui";

/**
 * Login: a esfera de pontos "Eccellenza" (`componentes/login/esfera-3d.ts`) fica centralizada acima do cartão,
 * nas cores do tema escolhido neste aparelho. Sem 3D no navegador, aparece o nome parado no lugar dela.
 */
export default function PaginaLogin() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [semEsfera, setSemEsfera] = useState(false);
  const fundo = useRef<HTMLElement>(null);
  const lugar = useRef<HTMLDivElement>(null);
  const cartao = useRef<HTMLFormElement>(null);
  const halo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let parar: (() => void) | undefined;
    let ativo = true;
    // O Three.js só é baixado nesta tela.
    import("@/componentes/login/esfera-3d")
      .then(({ iniciarEsfera }) => {
        if (!ativo || !fundo.current || !lugar.current || !cartao.current || !halo.current) return;
        parar = iniciarEsfera({ fundo: fundo.current, lugar: lugar.current, cartao: cartao.current, halo: halo.current });
      })
      .catch(() => {
        if (ativo) setSemEsfera(true);
      });
    return () => {
      ativo = false;
      parar?.();
    };
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, senha }) });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro ?? "Não foi possível entrar.");
      router.push("/");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
      setEntrando(false);
    }
  }

  return (
    <main ref={fundo} className="login-fundo relative min-h-dvh overflow-x-hidden">
      <div ref={halo} className="login-halo" aria-hidden />
      <div className="pointer-events-none relative z-[1] grid min-h-dvh grid-rows-[minmax(240px,1fr)_auto] place-items-center gap-2 px-4 pt-4 pb-10 lg:px-12 lg:pt-6">
        <section className="flex size-full items-center justify-center">
          <div ref={lugar} className="flex size-full max-w-[560px] items-center justify-center">
            {semEsfera && <span className="login-nome-parado text-4xl font-extrabold tracking-[0.04em] sm:text-6xl">Eccellenza</span>}
          </div>
        </section>
        <section className="w-full max-w-sm">
          <form
            ref={cartao}
            onSubmit={entrar}
            className="login-cartao vidro pointer-events-auto space-y-4 rounded-painel p-6"
          >
            <div className="mb-5 text-center">
              <h1 className="pl-[0.16em] text-2xl font-extrabold tracking-[0.16em]">ECCELLENZA</h1>
              <p className="mt-1.5 text-sm text-texto-suave">CRM de atendimento</p>
            </div>
            <Campo rotulo="Usuário">
              <input className={classeEntrada} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus required />
            </Campo>
            <Campo rotulo="Senha">
              <input className={classeEntrada} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
            </Campo>
            {erro && (
              <p role="alert" className="rounded-controle bg-alerta-suave px-3 py-2 text-sm text-alerta">
                {erro}
              </p>
            )}
            <Botao type="submit" variante="primario" className="w-full" carregando={entrando} icone={<LogIn className="size-4" aria-hidden />}>
              Entrar
            </Botao>
          </form>
          <p className="mt-4 text-center text-xs text-texto-fraco md:hidden">No iPhone: toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot; para abrir como app.</p>
          <p className="mt-4 text-center text-xs tabular-nums text-texto-fraco">Versão {process.env.NEXT_PUBLIC_VERSAO}</p>
        </section>
      </div>
    </main>
  );
}
