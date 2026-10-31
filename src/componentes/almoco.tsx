"use client";

import { UtensilsCrossed } from "lucide-react";
import { chamarApi, useAviso, useDados } from "./dados";
import { juntar } from "./estilos";

// Botão do consultor: sai para o almoço (não recebe leads novos) e volta (volta ao rodízio e recebe a fila).
export function BotaoAlmoco() {
  const avisar = useAviso();
  const { dados, recarregar } = useDados<{ status: "online" | "almoco" }>("/api/equipe/status");
  if (!dados) return null;
  const emAlmoco = dados.status === "almoco";

  async function alternar() {
    try {
      await chamarApi("/api/equipe/status", { method: "POST", json: { status: emAlmoco ? "online" : "almoco" } });
      avisar(emAlmoco ? "Você voltou: já recebe leads novos." : "Bom almoço! Os leads novos vão para os outros consultores.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível mudar o status.", "erro");
    } finally {
      await recarregar();
    }
  }

  return (
    <button
      onClick={alternar}
      aria-pressed={emAlmoco}
      title={emAlmoco ? "Você está em almoço. Clique ao voltar." : "Sair para o almoço (pára de receber leads novos)"}
      className={juntar(
        "inline-flex min-h-toque items-center gap-2 whitespace-nowrap rounded-controle px-3 text-sm font-medium transition active:scale-[0.97]",
        emAlmoco ? "bg-aviso-suave text-aviso ring-1 ring-aviso/40" : "bg-superficie-suave text-texto-suave hover:bg-borda",
      )}
    >
      <UtensilsCrossed className="size-4" aria-hidden />
      <span className="hidden sm:inline">{emAlmoco ? "Voltei do almoço" : "Almoço"}</span>
      <span className="sr-only sm:hidden">{emAlmoco ? "Voltei do almoço" : "Almoço"}</span>
    </button>
  );
}
