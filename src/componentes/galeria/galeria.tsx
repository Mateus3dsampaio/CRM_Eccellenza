"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Download, ExternalLink, FileText, Film, MessageSquare, Trash2 } from "lucide-react";
import { formatarTamanho, type FamiliaMidia } from "@/regras/midia";
import { formatarDataHora } from "@/regras/tempo";
import type { Galeria as DadosGaleria, ItemDaGaleria } from "@/servicos/midias";
import { chamarApi, useAviso, useDados } from "../dados";
import { Abas } from "../entalhe/abas";
import { juntar } from "../estilos";
import { Botao, Carregando, EstadoErro, EstadoVazio, Modal, classeEntrada, Dica } from "../ui";
import { usePode } from "../usuario";
import { useGaveta } from "../ficha/gaveta";

const FILTROS: { codigo: "" | FamiliaMidia; nome: string }[] = [
  { codigo: "", nome: "Tudo" },
  { codigo: "imagem", nome: "Imagens" },
  { codigo: "video", nome: "Vídeos" },
  { codigo: "documento", nome: "Documentos" },
];

// Tamanho dos blocos, como no Windows: pequeno, médio e grande. O número de colunas define o tamanho, então a grade fica sempre alinhada.
type Tamanho = "pequeno" | "medio" | "grande";
const TAMANHOS: { codigo: Tamanho; rotulo: string }[] = [
  { codigo: "pequeno", rotulo: "Pequeno" },
  { codigo: "medio", rotulo: "Médio" },
  { codigo: "grande", rotulo: "Grande" },
];
const GRADE: Record<Tamanho, string> = {
  pequeno: "grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9",
  medio: "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6",
  grande: "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};
const PROPORCAO: Record<Tamanho, string> = { pequeno: "aspect-square", medio: "aspect-[4/3]", grande: "aspect-video" };
const ICONE: Record<Tamanho, string> = { pequeno: "size-6", medio: "size-9", grande: "size-12" };
const CHAVE_TAMANHO = "galeria-tamanho";

// A escolha fica guardada neste navegador; sem armazenamento, vale o médio.
const ouvintes = new Set<() => void>();
let naMemoria: Tamanho | null = null; // vale quando o navegador não deixa guardar
function lerTamanho(): Tamanho {
  if (naMemoria) return naMemoria;
  try {
    const guardado = localStorage.getItem(CHAVE_TAMANHO);
    if (guardado === "pequeno" || guardado === "medio" || guardado === "grande") return guardado;
  } catch {
    /* sem armazenamento */
  }
  return "medio";
}
function gravarTamanho(novo: Tamanho) {
  naMemoria = novo;
  try {
    localStorage.setItem(CHAVE_TAMANHO, novo);
  } catch {
    /* sem armazenamento */
  }
  ouvintes.forEach((f) => f());
}
function useTamanhoGaleria(): Tamanho {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    lerTamanho,
    () => "medio",
  );
}

/** Galeria do vendedor: imagens, vídeos e documentos (PDF, Word, Excel, DWG, ZIP) dos leads dele (o admin vê todos). Fica no sistema; dá para baixar cada arquivo. */
export function Galeria() {
  const gaveta = useGaveta();
  const avisar = useAviso();
  const podeApagar = usePode("apagar_midia");
  const [tipo, setTipo] = useState<"" | FamiliaMidia>("");
  const [vendedor, setVendedor] = useState("");
  const [limite, setLimite] = useState(60);
  const tamanho = useTamanhoGaleria();
  const escolherTamanho = gravarTamanho;
  const pequeno = tamanho === "pequeno";
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
        <Abas
          itens={FILTROS.map((f) => ({ codigo: f.codigo || "tudo", rotulo: f.nome }))}
          valor={tipo || "tudo"}
          aoMudar={(c) => {
            setTipo(c === "tudo" ? "" : (c as FamiliaMidia));
            setLimite(60);
          }}
          rotuloAria="Tipo de arquivo"
        />
        {dados && dados.vendedores.length > 0 && (
          <select className={juntar(classeEntrada, "w-auto! max-w-56")} value={vendedor} onChange={(e) => setVendedor(e.target.value)} aria-label="Vendedor">
            <option value="">Todos os vendedores</option>
            <option value="sem">Leads sem vendedor</option>
            {dados.vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        )}
        <Abas itens={TAMANHOS} valor={tamanho} aoMudar={escolherTamanho} rotuloAria="Tamanho dos blocos" />
        {dados && (
          <p className="ml-auto inline-flex items-center gap-1 text-sm text-texto-suave">
            {dados.total} {dados.total === 1 ? "arquivo" : "arquivos"}
            {dados.bytes > 0 ? ` · ${formatarTamanho(dados.bytes)}` : ""}
            <Dica rotulo="Prazo dos arquivos" texto="Arquivos com mais de 180 dias são apagados automaticamente. Para guardar um, baixe antes." />
          </p>
        )}
      </div>

      {carregando && !dados ? (
        <Carregando linhas={4} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : dados && dados.itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum arquivo ainda" texto="Imagens, vídeos e documentos (PDF, Word, Excel, DWG, ZIP) que você e os clientes trocarem aparecem aqui." />
      ) : (
        dados && (
          <>
            <ul className={juntar("grid", GRADE[tamanho])}>
              {dados.itens.map((i) => (
                <li key={i.mensagemId} className="flex flex-col overflow-hidden rounded-card border border-borda bg-superficie shadow-card">
                  <a href={`/api/midias/${i.arquivo}`} target="_blank" rel="noreferrer" className={juntar("flex items-center justify-center bg-superficie-suave", PROPORCAO[tamanho])} aria-label={`Abrir ${i.nome}`}>
                    {i.familia === "imagem" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- imagem servida por rota protegida
                      <img src={`/api/midias/${i.arquivo}`} alt={i.nome} loading="lazy" className="size-full object-cover" />
                    ) : i.familia === "video" ? (
                      <Film className={juntar(ICONE[tamanho], "text-texto-suave")} aria-hidden />
                    ) : (
                      <FileText className={juntar(ICONE[tamanho], "text-alerta")} aria-hidden />
                    )}
                  </a>
                  <div className={juntar("flex flex-1 flex-col gap-1 text-xs", pequeno ? "p-1.5" : "p-2.5")}>
                    <p className="truncate text-sm font-medium" title={i.nome}>
                      {i.nome}
                    </p>
                    {!pequeno && (
                      <>
                        <p className="flex items-center gap-1 text-texto-suave">
                          {i.rotulo}
                          {i.bytes ? ` · ${formatarTamanho(i.bytes)}` : ""} · {i.daLoja ? "enviado" : "recebido"}
                        </p>
                        <p className="truncate text-texto-suave">{i.leadNome}</p>
                        <p className="text-texto-fraco">{formatarDataHora(new Date(i.enviadaEm))}</p>
                      </>
                    )}
                    {i.apagaEmDias !== null && <p className="text-aviso">{pequeno ? `${i.apagaEmDias} d` : `Será apagado em ${i.apagaEmDias} ${i.apagaEmDias === 1 ? "dia" : "dias"}`}</p>}
                    <div className={juntar("mt-auto flex flex-wrap items-center pt-1", pequeno ? "gap-0" : "gap-1")}>
                      <a href={`/api/midias/${i.arquivo}?baixar=1`} className="inline-flex min-h-toque items-center gap-1 rounded-controle px-2 text-texto-suave hover:bg-superficie-suave" title="Baixar">
                        <Download className="size-3.5" aria-hidden /> <span className={pequeno ? "sr-only" : undefined}>Baixar</span>
                      </a>
                      {i.familia !== "documento" && (
                        <a href={`/api/midias/${i.arquivo}`} target="_blank" rel="noreferrer" className="inline-flex min-h-toque items-center gap-1 rounded-controle px-2 text-texto-suave hover:bg-superficie-suave" title="Abrir em outra aba">
                          <ExternalLink className="size-3.5" aria-hidden /> <span className={pequeno ? "sr-only" : undefined}>Abrir</span>
                        </a>
                      )}
                      <Link href={gaveta.hrefDe(i.leadId)} scroll={false} className="inline-flex min-h-toque items-center gap-1 rounded-controle px-2 text-texto-suave hover:bg-superficie-suave" title="Ver a conversa">
                        <MessageSquare className="size-3.5" aria-hidden /> <span className={pequeno ? "sr-only" : undefined}>Conversa</span>
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
