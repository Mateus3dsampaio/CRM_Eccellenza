"use client";

import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { formatarTamanho } from "@/regras/midia";
import { chamarApi } from "../dados";

type Alvo = { ids: string[] } | { etapa: string };

/** Aviso antes de excluir leads: quantos arquivos (fotos, vídeos, PDFs) vão junto. Não aparece se não houver nenhum. */
export function AvisoMidias({ alvo }: { alvo: Alvo | null }) {
  // O resultado carrega a chave do pedido: se o alvo mudar, o resultado antigo deixa de valer sem precisar limpar.
  const [pronto, setPronto] = useState<{ chave: string; arquivos: number; bytes: number } | null>(null);
  const chave = alvo ? JSON.stringify(alvo) : "";

  useEffect(() => {
    if (!chave) return;
    let ativo = true;
    chamarApi<{ arquivos: number; bytes: number }>("/api/midias/resumo", { method: "POST", json: JSON.parse(chave) })
      .then((r) => ativo && setPronto({ chave, ...r }))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [chave]);

  const resumo = pronto && pronto.chave === chave ? pronto : null;
  if (!resumo || resumo.arquivos === 0) return null;
  return (
    <div role="alert" className="mt-3 flex gap-2 rounded-controle bg-alerta-suave px-3 py-2 text-sm text-alerta">
      <Paperclip className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <strong>
          Também serão apagados {resumo.arquivos} {resumo.arquivos === 1 ? "arquivo" : "arquivos"}
          {resumo.bytes > 0 ? ` (${formatarTamanho(resumo.bytes)})` : ""}
        </strong>{" "}
        (fotos, vídeos e PDFs da conversa). Não dá para recuperar. Se precisar de algum, baixe antes na Galeria.
      </p>
    </div>
  );
}
