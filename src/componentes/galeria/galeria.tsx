"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, ExternalLink, FileText, Film, MessageSquare, Trash2 } from "lucide-react";
import { formatarTamanho, type FamiliaMidia } from "@/regras/midia";
import { formatarDataHora } from "@/regras/tempo";
import type { Galeria as DadosGaleria, ItemDaGaleria } from "@/servicos/midias";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Botao, Carregando, EstadoErro, EstadoVazio, Modal, classeEntrada } from "../ui";
import { usePode } from "../usuario";

const FILTROS: { codigo: "" | FamiliaMidia; nome: string }[] = [
  { codigo: "", nome: "Tudo" },
  { codigo: "imagem", nome: "Imagens" },
  { codigo: "video", nome: "Vídeos" },
  { codigo: "documento", nome: "Documentos" },
];

/** Galeria do vendedor: imagens, vídeos e documentos (PDF, Word, Excel, DWG, ZIP) dos leads dele (o admin vê todos). Fica no sistema; dá para baixar cada arquivo. */
export function Galeria() {
  const avisar = useAviso();
  const podeApagar = usePode("apagar_midia");
  const [tipo, setTipo] = useState<"" | FamiliaMidia>("");
  const [vendedor, setVendedor] = useState("");
  const [limite, setLimite] = useState(60);
  const [apagar, setApagar] = useState<ItemDaGaleria | null>(null);
  const consulta = new URLSearchParams({ limite: String(limite), ...(tipo ? { tipo } : {}), ...(vendedor ? { vendedor } : {}) }).toString();
  const { dados, erro, carregando, recarregar } = useDados<DadosGaleria>(`/api/galeria?${consulta}`);

  async function confirmarApagar() {
    if (!apagar) return;
    try {
      await chamarApi(`/api/mensagens/${apagar.mensagemId}/midia`, { method: "DELETE" });
      avisar("Arquivo apagado.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível apagar.", "erro");
    } finally {
      setApagar(null);
      await recarregar();
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-controle bg-superficie-suave p-1" role="tablist" aria-label="Tipo de arquivo">
          {FILTROS.map((f) => (
            <button
              key={f.codigo}
              role="tab"
              aria-selected={tipo === f.codigo}
              onClick={() => {
                setTipo(f.codigo);
                setLimite(60);
              }}
              className={juntar("min-h-toque rounded-controle px-3 text-sm font-medium transition", tipo === f.codigo ? "bg-marca-suave text-marca-texto" : "text-texto-suave hover:text-texto")}
            >
              {f.nome}
            </button>
          ))}
        </div>
        {dados && dados.vendedores.length > 0 && (
          <select className={juntar(classeEntrada, "w-auto")} value={vendedor} onChange={(e) => setVendedor(e.target.value)} aria-label="Vendedor">
            <option value="">Todos os vendedores</option>
            <option value="sem">Leads sem vendedor</option>
            {dados.vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        )}
        {dados && (
          <p className="ml-auto text-sm text-texto-suave">
            {dados.total} {dados.total === 1 ? "arquivo" : "arquivos"}
            {dados.bytes > 0 ? ` · ${formatarTamanho(dados.bytes)}` : ""}
          </p>
        )}
      </div>
      <p className="text-xs text-texto-fraco">Arquivos com mais de 180 dias são apagados automaticamente. Para guardar um, baixe antes.</p>

      {carregando && !dados ? (
        <Carregando linhas={4} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : dados && dados.itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum arquivo ainda" texto="Imagens, vídeos e documentos (PDF, Word, Excel, DWG, ZIP) que você e os clientes trocarem aparecem aqui." />
      ) : (
        dados && (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {dados.itens.map((i) => (
                <li key={i.mensagemId} className="flex flex-col overflow-hidden rounded-card border border-borda bg-superficie shadow-card">
                  <a href={`/api/midias/${i.arquivo}`} target="_blank" rel="noreferrer" className="flex aspect-video items-center justify-center bg-superficie-suave" aria-label={`Abrir ${i.nome}`}>
                    {i.familia === "imagem" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- imagem servida por rota protegida
                      <img src={`/api/midias/${i.arquivo}`} alt={i.nome} loading="lazy" className="size-full object-cover" />
                    ) : i.familia === "video" ? (
                      <Film className="size-10 text-texto-suave" aria-hidden />
                    ) : (
                      <FileText className="size-10 text-alerta" aria-hidden />
                    )}
                  </a>
                  <div className="flex flex-1 flex-col gap-1 p-2.5 text-xs">
                    <p className="truncate text-sm font-medium" title={i.nome}>
                      {i.nome}
                    </p>
                    <p className="flex items-center gap-1 text-texto-suave">
                      {i.rotulo}
                      {i.bytes ? ` · ${formatarTamanho(i.bytes)}` : ""} · {i.daLoja ? "enviado" : "recebido"}
                    </p>
                    <p className="truncate text-texto-suave">{i.leadNome}</p>
                    <p className="text-texto-fraco">{formatarDataHora(new Date(i.enviadaEm))}</p>
                    {i.apagaEmDias !== null && <p className="text-aviso">Será apagado em {i.apagaEmDias} {i.apagaEmDias === 1 ? "dia" : "dias"}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                      <a href={`/api/midias/${i.arquivo}?baixar=1`} className="inline-flex min-h-toque items-center gap-1 rounded-controle px-2 text-texto-suave hover:bg-superficie-suave" title="Baixar">
                        <Download className="size-3.5" aria-hidden /> Baixar
                      </a>
                      {i.familia !== "documento" && (
                        <a href={`/api/midias/${i.arquivo}`} target="_blank" rel="noreferrer" className="inline-flex min-h-toque items-center gap-1 rounded-controle px-2 text-texto-suave hover:bg-superficie-suave" title="Abrir em outra aba">
                          <ExternalLink className="size-3.5" aria-hidden /> Abrir
                        </a>
                      )}
                      <Link href={`/lead/${i.leadId}`} className="inline-flex min-h-toque items-center gap-1 rounded-controle px-2 text-texto-suave hover:bg-superficie-suave" title="Ver a conversa">
                        <MessageSquare className="size-3.5" aria-hidden /> Conversa
                      </Link>
                      {podeApagar && (
                        <button type="button" onClick={() => setApagar(i)} className="ml-auto inline-flex min-h-toque items-center gap-1 rounded-controle px-2 text-alerta hover:bg-alerta-suave" title="Apagar arquivo">
                          <Trash2 className="size-3.5" aria-hidden />
                          <span className="sr-only">Apagar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {dados.itens.length < dados.total && (
              <div className="flex justify-center">
                <Botao onClick={() => setLimite((l) => l + 60)}>Mostrar mais</Botao>
              </div>
            )}
          </>
        )
      )}

      <Modal aberto={!!apagar} aoFechar={() => setApagar(null)} titulo="Apagar arquivo" largura="max-w-md">
        <p className="text-sm text-texto-suave">
          Apagar <strong className="text-texto">{apagar?.nome}</strong>? A mensagem continua na conversa, mas o arquivo é apagado do sistema e não dá para recuperar.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setApagar(null)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={confirmarApagar}>
            Apagar
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
