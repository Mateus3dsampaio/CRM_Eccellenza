"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { TEMAS } from "@/regras/temas";
import { juntar } from "../estilos";
import { Pilula } from "../entalhe/pilula";
import { aplicarTema, lerTema } from "../tema";

const TAMANHO = 56;

/** Configurações > Temas: uma bolinha por tema (as cores dele por dentro). O anel de escolha anda de uma bolinha à outra como mola. */
export function Temas() {
  const [atual, setAtual] = useState("padrao");
  const raiz = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a escolha vive no navegador (localStorage)
    setAtual(lerTema());
  }, []);

  function escolher(codigo: string) {
    setAtual(codigo);
    aplicarTema(codigo);
  }

  const indice = TEMAS.findIndex((t) => t.codigo === atual);
  const tema = TEMAS[Math.max(indice, 0)];

  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 luz-marca-fio">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Palette className="size-4 text-texto-suave" aria-hidden /> Tema de cores
      </h2>
      <p className="mb-4 text-sm text-texto-suave">Escolha a paleta do sistema. A escolha vale só neste aparelho; cada pessoa pode ter o seu tema.</p>

      <div className="rolagem-fina overflow-x-auto py-2">
        <div ref={raiz} role="radiogroup" aria-label="Tema de cores" className="relative flex w-max gap-5 px-3 py-[5px]">
          <Pilula raiz={raiz} itens={botoes} indice={indice} variante="anel" />
          {TEMAS.map((t, i) => (
            <button
              key={t.codigo}
              ref={(el) => {
                botoes.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={t.codigo === atual}
              aria-label={t.nome}
              title={t.nome}
              onClick={() => escolher(t.codigo)}
              className={juntar("relative shrink-0 rounded-full transition-transform duration-150 active:scale-95", t.codigo !== atual && "hover:scale-105")}
              style={{
                width: TAMANHO,
                height: TAMANHO,
                // As seis cores em faixas, da mais escura (em cima) ao destaque (embaixo), como na paleta.
                background: `linear-gradient(180deg, ${t.cores.map((c, k) => `${c} ${(k * 100) / 6}% ${((k + 1) * 100) / 6}%`).join(", ")})`,
                boxShadow: "inset 0 1px 2px rgb(255 255 255 / 0.25), inset 0 -3px 6px rgb(0 0 0 / 0.35), 0 4px 10px rgb(0 0 0 / 0.4)",
              }}
            />
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm">
        <span className="text-texto-suave">Tema atual: </span>
        <span className="font-medium">{tema.nome}</span>
      </p>
    </section>
  );
}
