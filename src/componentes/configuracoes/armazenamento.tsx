"use client";

import { HardDrive } from "lucide-react";
import { formatarTamanho } from "@/regras/midia";
import { useDados } from "../dados";
import { juntar } from "../estilos";

interface Uso {
  arquivos: number;
  bytes: number;
  limiteBytes: number | null;
}

/** Quanto espaço as mídias (imagens, vídeos, PDFs) ocupam. O Railway mostra o uso real do disco na aba do Volume; aqui é a conta do sistema. */
export function Armazenamento() {
  const { dados } = useDados<Uso>("/api/configuracoes/armazenamento");
  const pct = dados?.limiteBytes ? Math.min(100, Math.round((dados.bytes / dados.limiteBytes) * 100)) : null;
  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <HardDrive className="size-4 text-texto-suave" aria-hidden /> Armazenamento de arquivos
      </h2>
      {!dados ? (
        <p className="text-sm text-texto-suave">Carregando…</p>
      ) : (
        <>
          <p className="text-sm text-texto-suave">
            <strong className="text-texto">{formatarTamanho(dados.bytes)}</strong> em {dados.arquivos} {dados.arquivos === 1 ? "arquivo" : "arquivos"}
            {dados.limiteBytes ? ` de ${formatarTamanho(dados.limiteBytes)} (${pct}%)` : ""}.
          </p>
          {pct !== null && (
            <div className="mt-2 h-2 overflow-hidden rounded-pilula bg-superficie-suave" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Espaço usado">
              <div className={juntar("h-full", pct >= 80 ? "bg-alerta" : "bg-marca")} style={{ width: `${pct}%` }} />
            </div>
          )}
          {pct !== null && pct >= 80 && <p className="mt-2 rounded-controle bg-alerta-suave px-3 py-2 text-sm text-alerta">O disco está acima de 80%. Aumente o Volume no Railway ou apague arquivos antigos.</p>}
          {!dados.limiteBytes && <p className="mt-2 text-xs text-texto-fraco">Para ver a porcentagem, defina MIDIAS_LIMITE_MB no Railway com o tamanho do seu Volume (em MB). O uso real do disco também aparece no painel do Railway.</p>}
          <p className="mt-1 text-xs text-texto-fraco">Arquivos com mais de 180 dias são apagados automaticamente.</p>
        </>
      )}
    </section>
  );
}
