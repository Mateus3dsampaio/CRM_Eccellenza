"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Tema = "claro" | "escuro";
const CHAVE = "tema-crm"; // igual ao script de tema-script.ts

function assinar(aviso: () => void) {
  window.addEventListener("tema-crm", aviso);
  return () => window.removeEventListener("tema-crm", aviso);
}
const lerTema = (): Tema => (document.documentElement.dataset.tema === "escuro" ? "escuro" : "claro");

export function BotaoTema() {
  const tema = useSyncExternalStore(assinar, lerTema, () => "claro" as Tema);
  function alternar() {
    const novo: Tema = tema === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // Sem armazenamento: vale só nesta visita.
    }
    window.dispatchEvent(new Event("tema-crm"));
  }
  const Icone = tema === "escuro" ? Sun : Moon;
  const rotulo = tema === "escuro" ? "Mudar para o tema claro" : "Mudar para o tema escuro";
  return (
    <button onClick={alternar} className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave transition hover:bg-superficie-suave" aria-label={rotulo} title={rotulo}>
      <Icone className="size-5" aria-hidden />
    </button>
  );
}
