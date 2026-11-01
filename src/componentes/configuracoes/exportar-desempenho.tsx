"use client";

import { Download, FileArchive } from "lucide-react";
import { useState } from "react";
import { LIMITE_DIAS_EXPORTACAO } from "@/regras/exportacao";
import { useAviso } from "../dados";
import { Botao, Campo, classeEntrada } from "../ui";

interface Props {
  equipe: { id: string; nome: string; perfil: string; ativo: boolean }[];
  periodoPadrao: { de: string; ate: string };
}

export function ExportarDesempenho({ equipe, periodoPadrao }: Props) {
  const avisar = useAviso();
  const vendedores = equipe.filter((u) => u.perfil === "consultor");
  const [vendedorId, setVendedorId] = useState(vendedores[0]?.id ?? "");
  const [de, setDe] = useState(periodoPadrao.de);
  const [ate, setAte] = useState(periodoPadrao.ate);
  const [incluirMidia, setIncluirMidia] = useState(false);
  const [baixando, setBaixando] = useState(false);

  async function baixar() {
    setBaixando(true);
    try {
      const resposta = await fetch("/api/configuracoes/exportar-desempenho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedorId, de, ate, incluirMidia }),
      });
      if (!resposta.ok) throw new Error((await resposta.json().catch(() => ({}))).erro ?? "Não foi possível exportar.");
      const arquivo = /filename="([^"]+)"/.exec(resposta.headers.get("Content-Disposition") ?? "")?.[1] ?? "desempenho.zip";
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = arquivo;
      link.click();
      URL.revokeObjectURL(url);
      avisar("Exportação pronta.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível exportar.", "erro");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <section className="space-y-4 rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <FileArchive className="size-4 text-texto-suave" aria-hidden /> Exportar desempenho do vendedor
        </h2>
        <p className="mt-1 text-sm text-texto-suave">
          Gera um arquivo .zip para analisar no Claude Code: tempo de resposta, leads atendidos, etapas que cada lead alcançou e uma conversa por arquivo. O bot e o consultor aparecem separados. O arquivo não leva telefone nem nome do cliente, mas as conversas podem citar nomes e endereços.
        </p>
      </div>

      {vendedores.length === 0 ? (
        <p className="rounded-controle bg-aviso-suave px-3 py-2 text-sm text-aviso">Não há consultores cadastrados.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Vendedor">
              <select className={classeEntrada} value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                    {v.ativo ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="De">
              <input type="date" className={classeEntrada} value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} />
            </Campo>
            <Campo rotulo="Até" dica={`Máximo de ${LIMITE_DIAS_EXPORTACAO} dias.`}>
              <input type="date" className={classeEntrada} value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} />
            </Campo>
          </div>

          <label className="flex min-h-toque cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--marca)]" checked={incluirMidia} onChange={(e) => setIncluirMidia(e.target.checked)} />
            <span>
              Incluir fotos e plantas
              <span className="block text-xs text-texto-fraco">Deixa o arquivo maior. Sem isso, a conversa só indica que o cliente enviou uma imagem.</span>
            </span>
          </label>

          <Botao variante="primario" onClick={baixar} carregando={baixando} disabled={!vendedorId || !de || !ate} icone={<Download className="size-4" aria-hidden />}>
            Exportar
          </Botao>
        </>
      )}
    </section>
  );
}
