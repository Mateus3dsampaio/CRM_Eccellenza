"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";
import { Botao, Campo, classeEntrada } from "@/componentes/ui";

export default function PaginaLogin() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

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
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm animate-surgir">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-painel bg-marca text-2xl font-bold text-sobre-marca shadow-card">E</span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Eccellenza</h1>
            <p className="text-sm text-texto-suave">CRM de atendimento · simulador</p>
          </div>
        </div>
        <form onSubmit={entrar} className="space-y-4 rounded-painel bg-superficie p-6 shadow-flutuante">
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
        <p className="mt-4 text-center text-xs text-texto-fraco">Ambiente de simulação com dados fictícios. Usuários de teste no README.</p>
      </div>
    </main>
  );
}
