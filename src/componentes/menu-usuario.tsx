"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { KeyRound, LogOut, Palette } from "lucide-react";
import { TEMAS } from "@/regras/temas";
import { chamarApi } from "./dados";
import { juntar } from "./estilos";
import { pausarPushAoSair } from "./alertas/push";
import { JanelaMinhaSenha } from "./configuracoes/equipe";
import { aplicarTema, lerTema } from "./tema";
import { useUsuario } from "./usuario";

/** Menu do avatar (tarefa 26): nome e perfil, trocar senha, tema e sair. Tira dois ícones da barra de cima. */
export function MenuUsuario() {
  const usuario = useUsuario();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [tema, setTema] = useState("padrao");
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a escolha vive no navegador (localStorage)
    setTema(lerTema());
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  async function sair() {
    await pausarPushAoSair().catch(() => undefined);
    await chamarApi("/api/login", { method: "DELETE" }).catch(() => undefined);
    router.push("/login");
  }

  const perfil = usuario.perfil === "admin" ? "Administrador" : "Consultor";
  const classeItem = "flex min-h-toque w-full items-center gap-3 rounded-controle px-3 text-left text-sm text-texto hover:bg-superficie-suave";

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label={`Menu de ${usuario.nome}`}
        title={`${usuario.nome} (${perfil})`}
        className={juntar("inline-flex size-toque items-center justify-center rounded-full bg-marca-suave text-sm font-semibold text-marca-texto ring-offset-2 ring-offset-fundo transition hover:ring-2 hover:ring-marca/40", aberto && "ring-2 ring-marca")}
      >
        {usuario.nome.slice(0, 1)}
      </button>
      {aberto && (
        <div role="menu" aria-label="Menu do usuário" className="absolute right-0 top-full z-50 mt-2 w-64 animate-surgir rounded-card border border-borda bg-superficie p-1.5 shadow-flutuante">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{usuario.nome}</p>
            <p className="text-xs text-texto-fraco">{perfil}</p>
          </div>
          <div className="my-1 border-t border-borda" />
          <button
            role="menuitem"
            type="button"
            className={classeItem}
            onClick={() => {
              setAberto(false);
              setSenhaAberta(true);
            }}
          >
            <KeyRound className="size-4 text-texto-suave" aria-hidden /> Trocar minha senha
          </button>
          <div className="my-1 border-t border-borda" />
          <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-texto-fraco">
            <Palette className="size-3.5" aria-hidden /> Tema
          </p>
          <div className="flex flex-wrap gap-2 px-3 pb-2" role="radiogroup" aria-label="Tema de cores">
            {TEMAS.map((t) => (
              <button
                key={t.codigo}
                type="button"
                role="radio"
                aria-checked={t.codigo === tema}
                aria-label={t.nome}
                title={t.nome}
                onClick={() => {
                  setTema(t.codigo);
                  aplicarTema(t.codigo);
                }}
                className={juntar("size-6 rounded-full transition-transform hover:scale-110", t.codigo === tema && "ring-2 ring-marca ring-offset-2 ring-offset-superficie")}
                style={{ background: `linear-gradient(180deg, ${t.cores.map((c, k) => `${c} ${(k * 100) / 6}% ${((k + 1) * 100) / 6}%`).join(", ")})` }}
              />
            ))}
          </div>
          <div className="my-1 border-t border-borda" />
          <button role="menuitem" type="button" className={classeItem} onClick={sair}>
            <LogOut className="size-4 text-texto-suave" aria-hidden /> Sair
          </button>
        </div>
      )}
      {senhaAberta && <JanelaMinhaSenha aoFechar={() => setSenhaAberta(false)} />}
    </div>
  );
}
