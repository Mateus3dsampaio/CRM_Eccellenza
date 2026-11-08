"use client";

import { LogIn, LogOut, UtensilsCrossed } from "lucide-react";
import { chamarApi, useAviso, useDados } from "./dados";
import { juntar } from "./estilos";

type Status = "online" | "almoco" | "offline";

// Botões do consultor (tarefa 35): "Ficar online / Sair" (quem não clicar online não recebe lead) e almoço
// (pára de receber leads novos; ao voltar recebe a fila e volta ao rodízio).
export function BotoesDePresenca() {
  const avisar = useAviso();
  const { dados, recarregar } = useDados<{ status: Status }>("/api/equipe/status");
  if (!dados) return null;
  const { status } = dados;

  async function mudar(novo: Status, mensagem: (fila: number) => string) {
    try {
      const r = await chamarApi<{ filaAguardando?: number }>("/api/equipe/status", { method: "POST", json: { status: novo } });
      avisar(mensagem(r.filaAguardando ?? 0));
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível mudar o status.", "erro");
    } finally {
      await recarregar();
    }
  }

  const base = "inline-flex min-h-toque items-center gap-2 whitespace-nowrap rounded-controle px-3 text-sm font-medium transition active:scale-[0.97]";

  if (status === "offline") {
    return (
      <button
        onClick={() => mudar("online", (fila) => (fila ? `Você está online. A fila (${fila} ${fila === 1 ? "lead" : "leads"}) é repartida no horário configurado; lead novo já chega até você.` : "Você está online: já recebe leads novos."))}
        title="Você está offline e não recebe leads. Clique ao chegar."
        className={juntar(base, "tecla-pri text-sobre-marca")}
      >
        <LogIn className="size-4" aria-hidden />
        <span className="hidden sm:inline">Ficar online</span>
        <span className="sr-only sm:hidden">Ficar online</span>
      </button>
    );
  }

  const emAlmoco = status === "almoco";
  return (
    <>
      <button
        onClick={() => mudar(emAlmoco ? "online" : "almoco", () => (emAlmoco ? "Você voltou: já recebe leads novos." : "Bom almoço! Os leads novos vão para os outros consultores."))}
        aria-pressed={emAlmoco}
        title={emAlmoco ? "Você está em almoço. Clique ao voltar." : "Sair para o almoço (pára de receber leads novos)"}
        className={juntar(base, emAlmoco ? "bg-aviso-suave text-aviso ring-1 ring-aviso/40" : "bg-superficie-suave text-texto-suave hover:bg-borda")}
      >
        <UtensilsCrossed className="size-4" aria-hidden />
        <span className="hidden sm:inline">{emAlmoco ? "Voltei do almoço" : "Almoço"}</span>
        <span className="sr-only sm:hidden">{emAlmoco ? "Voltei do almoço" : "Almoço"}</span>
      </button>
      <button
        onClick={() => mudar("offline", () => "Você ficou offline: não recebe mais leads até clicar em online.")}
        title="Ficar offline (não recebe leads)"
        className={juntar(base, "bg-superficie-suave text-texto-suave hover:bg-borda")}
      >
        <LogOut className="size-4" aria-hidden />
        <span className="hidden lg:inline">Offline</span>
        <span className="sr-only lg:hidden">Ficar offline</span>
      </button>
    </>
  );
}
