"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ClipboardCopy, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { CLASSIFICACOES, ETIQUETAS, type Classificacao } from "@/regras/etapas";
import { formatarDataHora } from "@/regras/tempo";
import type { FichaLead } from "@/servicos/consultas";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Botao, Campo, Etiqueta, classeEntrada } from "../ui";
import { usePode } from "../usuario";
import type { AcoesDoLead } from "./acoes-lead";

const FONTES: Record<string, string> = { texto: "Texto", foto: "Foto", planta: "Planta", audio: "Áudio" };

/** Quadro que ocupa a altura toda de onde está e rola por dentro (abas Notas e Histórico, ao lado da conversa). */
export function Painel({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-painel border border-borda bg-superficie p-4 shadow-painel">
      <div className="mb-2 flex min-h-9 shrink-0 items-center justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {acao}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

/**
 * Bloco da coluna da ficha: altura do próprio conteúdo, sem cor (só o "Próximo passo" tem destaque).
 * Com `vazio`, vira uma linha só: título, o texto e a ação.
 */
export function Bloco({ titulo, junto, acao, vazio, children }: { titulo: string; junto?: ReactNode; acao?: ReactNode; vazio?: string; children?: ReactNode }) {
  return (
    <section className={juntar("shrink-0 rounded-painel border border-borda bg-coluna", vazio ? "py-1.5 pl-3.5 pr-2" : "p-3.5")}>
      <div className={juntar("flex min-h-10 flex-wrap items-center gap-x-2", !vazio && "mb-1.5")}>
        <h2 className="font-semibold">{titulo}</h2>
        {junto}
        <span className="min-w-0 flex-1 truncate text-sm text-texto-fraco">{vazio}</span>
        {acao}
      </div>
      {!vazio && children}
    </section>
  );
}

/** Campos do cliente que o bot ou o consultor preencheram (nome e telefone ficam no cabeçalho). */
function camposDoCliente(ficha: FichaLead): [string, string | null][] {
  return [
    ["Cidade", ficha.cidade],
    ["Endereço", ficha.endereco],
    ["Ambientes", ficha.ambientes.join(", ") || null],
    ["Imóvel", ficha.situacaoImovel],
    ["Prazo", ficha.prazo],
    ["Investimento", ficha.investimento],
    ["Exigências", ficha.exigencias.join("; ") || null],
    ["Pedidos técnicos", ficha.pedidosTecnicos.length ? ficha.pedidosTecnicos.map((p) => `“${p}”`).join("; ") : null],
    ["Observações", ficha.observacoes],
  ];
}

/** Lista "rótulo: valor" só com o que está preenchido (ou tudo, com `mostrarVazios`). */
export function CamposDoCliente({ ficha, mostrarVazios }: { ficha: FichaLead; mostrarVazios?: boolean }) {
  const linhas = camposDoCliente(ficha).filter(([, valor]) => valor || mostrarVazios);
  if (!linhas.length) return <p className="text-sm text-texto-suave">Nada preenchido ainda.</p>;
  return (
    <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-sm">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="contents">
          <dt className="text-texto-fraco">{rotulo}</dt>
          <dd className={juntar("min-w-0 whitespace-pre-line break-words", !valor && "text-texto-fraco")}>{valor || "não informado"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Uma linha que resume o cliente (gaveta): cidade, ambientes, imóvel e classificação. */
export function linhaDoCliente(ficha: FichaLead): string {
  const classificacao = ficha.classificacao ? CLASSIFICACOES[ficha.classificacao as Classificacao] : null;
  return [ficha.cidade, ficha.ambientes.join(", "), ficha.situacaoImovel, classificacao].filter(Boolean).join(" · ") || "Ainda sem dados do cliente";
}

/** "Cliente": o antigo resumo e os dados do lead num bloco só, sem repetir. Vazios ficam atrás de um botão. */
export function BlocoCliente({ ficha, acoes }: { ficha: FichaLead; acoes: AcoesDoLead }) {
  const [editando, setEditando] = useState(false);
  const [mostrarVazios, setMostrarVazios] = useState(false);
  if (editando) return <FormularioDados ficha={ficha} aoCancelar={() => setEditando(false)} aoSalvar={async (corpo) => (await acoes.salvar(corpo)) && setEditando(false)} />;
  const vazias = camposDoCliente(ficha).filter(([, valor]) => !valor).length;
  const classificacao = ficha.classificacao ? CLASSIFICACOES[ficha.classificacao as Classificacao] : null;
  return (
    <Bloco
      titulo="Cliente"
      junto={classificacao && <span className="rounded-pilula bg-superficie-suave px-2.5 py-0.5 text-xs font-semibold text-texto-suave">{classificacao}</span>}
      acao={
        <span className="flex items-center">
          <Botao variante="fantasma" className="min-h-10 px-3" icone={<ClipboardCopy className="size-4" aria-hidden />} onClick={acoes.copiarResumo} title="Copia o resumo do cliente para colar onde precisar">
            Copiar resumo
          </Botao>
          <Botao variante="fantasma" className="min-h-10 px-3" icone={<Pencil className="size-4" aria-hidden />} onClick={() => setEditando(true)} aria-label="Editar dados do cliente">
            Editar
          </Botao>
        </span>
      }
    >
      <CamposDoCliente ficha={ficha} mostrarVazios={mostrarVazios} />
      {vazias > 0 && (
        <button type="button" onClick={() => setMostrarVazios((v) => !v)} aria-expanded={mostrarVazios} className="-ml-2 mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-controle px-2 text-xs font-medium text-texto-suave hover:bg-superficie-suave hover:text-texto">
          {mostrarVazios ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
          {mostrarVazios ? "Esconder campos vazios" : `Mostrar campos vazios (${vazias})`}
        </button>
      )}
    </Bloco>
  );
}

/** As notas mais recentes à vista, ao lado da conversa (a lista inteira fica na aba Notas). Sem nota, vira uma linha. */
export function BlocoNotas({ ficha, acoes, aoVerTodas }: { ficha: FichaLead; acoes: AcoesDoLead; aoVerTodas?: () => void }) {
  const recentes = ficha.notas.slice(0, 2);
  return (
    <Bloco
      titulo="Notas"
      vazio={recentes.length ? undefined : "nenhuma ainda"}
      acao={
        <span className="flex items-center">
          {aoVerTodas && ficha.notas.length > recentes.length && (
            <Botao variante="fantasma" className="min-h-10 px-3" onClick={aoVerTodas}>
              Ver todas ({ficha.notas.length})
            </Botao>
          )}
          <Botao variante="fantasma" className="min-h-10 px-3" icone={<Plus className="size-4" aria-hidden />} onClick={acoes.novaNota} aria-label="Adicionar nota">
            Adicionar
          </Botao>
        </span>
      }
    >
      <ul className="space-y-2">
        {recentes.map((n) => (
          <li key={n.id} className="rounded-controle bg-superficie px-3 py-2 text-sm">
            <p className="whitespace-pre-wrap break-words">{n.texto}</p>
            <p className="mt-0.5 text-xs text-texto-fraco">
              {n.autorNome} · {formatarDataHora(new Date(n.criadoEm))}
            </p>
          </li>
        ))}
      </ul>
    </Bloco>
  );
}

/** "Gestão": o que muda raramente (consultor, classificação, etiquetas). Fica recolhido. */
export function BlocoGestao({ ficha, acoes }: { ficha: FichaLead; acoes: AcoesDoLead }) {
  const [aberto, setAberto] = useState(false);
  const souAdmin = usePode("configurar");
  const { dados: agenda } = useDados<{ consultores: { id: string; nome: string }[] }>(aberto ? "/api/agenda?visao=dia" : null);
  const etiquetas = ficha.etiquetas.length ? `${ficha.etiquetas.length} ${ficha.etiquetas.length === 1 ? "etiqueta" : "etiquetas"}` : "sem etiquetas";
  return (
    <section className="shrink-0 overflow-hidden rounded-painel border border-borda bg-coluna">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex min-h-[52px] w-full items-center gap-2 px-3.5 text-left hover:bg-superficie-suave/50">
        <span className="font-semibold">Gestão</span>
        <span className="min-w-0 flex-1 truncate text-sm text-texto-fraco">
          {ficha.consultor?.nome ?? "Sem consultor"} · {etiquetas}
        </span>
        <ChevronDown className={juntar("size-4 shrink-0 text-texto-suave transition-transform duration-200", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <div className="grid animate-surgir gap-3 px-3.5 pb-3.5 sm:grid-cols-2">
          <Campo rotulo="Consultor responsável" dica={souAdmin ? undefined : "Só o administrador transfere o lead para outro consultor."}>
            <select className={classeEntrada} value={ficha.consultor?.id ?? ""} disabled={!souAdmin} onChange={(e) => e.target.value && void acoes.transferir(e.target.value)}>
              {!ficha.consultor && <option value="">Sem consultor</option>}
              {ficha.consultor && !agenda?.consultores.some((c) => c.id === ficha.consultor?.id) && <option value={ficha.consultor.id}>{ficha.consultor.nome}{agenda ? " (inativo)" : ""}</option>}
              {agenda?.consultores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Classificação">
            <select className={classeEntrada} value={ficha.classificacao ?? ""} onChange={(e) => void acoes.salvar({ classificacao: e.target.value || null })}>
              <option value="">Sem classificação</option>
              {(Object.keys(CLASSIFICACOES) as Classificacao[]).map((c) => (
                <option key={c} value={c}>
                  {CLASSIFICACOES[c]}
                </option>
              ))}
            </select>
          </Campo>
          <div className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Etiquetas</span>
            <div className="flex flex-wrap gap-1.5">
              {ficha.etiquetas.map((e) => (
                <Etiqueta key={e} codigo={e} aoRemover={() => void acoes.acaoLead({ acao: "etiqueta", etiqueta: e, ativa: false }, "Etiqueta removida.")} />
              ))}
              <select
                className="min-h-toque rounded-controle border border-dashed border-borda-forte bg-superficie px-3 text-sm text-texto-suave"
                value=""
                onChange={(e) => e.target.value && void acoes.acaoLead({ acao: "etiqueta", etiqueta: e.target.value, ativa: true }, "Etiqueta adicionada.")}
                aria-label="Adicionar etiqueta"
              >
                <option value="">+ etiqueta</option>
                {ETIQUETAS.filter((e) => !ficha.etiquetas.includes(e.codigo)).map((e) => (
                  <option key={e.codigo} value={e.codigo}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FormularioDados({ ficha, aoCancelar, aoSalvar }: { ficha: FichaLead; aoCancelar: () => void; aoSalvar: (corpo: object) => void }) {
  const [f, setF] = useState({
    nome: ficha.nome ?? "",
    cidade: ficha.cidade ?? "",
    endereco: ficha.endereco ?? "",
    ambientes: ficha.ambientes.join(", "),
    situacaoImovel: ficha.situacaoImovel ?? "",
    prazo: ficha.prazo ?? "",
    investimento: ficha.investimento ?? "",
    exigencias: ficha.exigencias.join("\n"),
    pedidosTecnicos: ficha.pedidosTecnicos.join("\n"),
    observacoes: ficha.observacoes ?? "",
  });
  const campo = (chave: keyof typeof f) => ({ value: f[chave], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [chave]: e.target.value }) });
  const lista = (texto: string, separador: RegExp) => texto.split(separador).map((s) => s.trim()).filter(Boolean);

  return (
    <Bloco titulo="Editar dados">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar({
            nome: f.nome,
            cidade: f.cidade,
            endereco: f.endereco,
            ambientes: lista(f.ambientes, /,/),
            situacaoImovel: f.situacaoImovel,
            prazo: f.prazo,
            investimento: f.investimento,
            exigencias: lista(f.exigencias, /\n/),
            pedidosTecnicos: lista(f.pedidosTecnicos, /\n/),
            observacoes: f.observacoes,
          });
        }}
      >
        <Campo rotulo="Nome"><input className={classeEntrada} {...campo("nome")} /></Campo>
        <Campo rotulo="Cidade"><input className={classeEntrada} {...campo("cidade")} /></Campo>
        <Campo rotulo="Endereço"><input className={classeEntrada} {...campo("endereco")} /></Campo>
        <Campo rotulo="Ambientes" dica="Separe por vírgula."><input className={classeEntrada} {...campo("ambientes")} /></Campo>
        <Campo rotulo="Situação do imóvel"><input className={classeEntrada} {...campo("situacaoImovel")} /></Campo>
        <Campo rotulo="Prazo"><input className={classeEntrada} {...campo("prazo")} /></Campo>
        <Campo rotulo="Investimento informado"><input className={classeEntrada} {...campo("investimento")} /></Campo>
        <Campo rotulo="Exigências" dica="Uma por linha."><textarea className={juntar(classeEntrada, "min-h-20")} {...campo("exigencias")} /></Campo>
        <Campo rotulo="Pedidos técnicos (texto do cliente)" dica="Um por linha."><textarea className={juntar(classeEntrada, "min-h-20")} {...campo("pedidosTecnicos")} /></Campo>
        <Campo rotulo="Observações"><textarea className={juntar(classeEntrada, "min-h-20")} {...campo("observacoes")} /></Campo>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Botao type="button" variante="fantasma" onClick={aoCancelar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" icone={<Check className="size-4" aria-hidden />}>Salvar</Botao>
        </div>
      </form>
    </Bloco>
  );
}

export function BlocoMedidas({ ficha, aoMudar }: { ficha: FichaLead; aoMudar: () => void }) {
  const podeRemover = usePode("remover_medida");
  const avisar = useAviso();
  const [nova, setNova] = useState<{ ambiente: string; descricao: string } | null>(null);
  const [editando, setEditando] = useState<{ id: string; descricao: string; confirmada: boolean } | null>(null);

  async function enviar(corpo: object, sucesso: string) {
    try {
      await chamarApi(`/api/leads/${ficha.id}/medidas`, { method: "POST", json: corpo });
      avisar(sucesso);
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível salvar.", "erro");
      return false;
    } finally {
      aoMudar();
    }
  }

  return (
    <Bloco
      titulo="Medidas"
      vazio={ficha.medidas.length === 0 && !nova ? "nenhuma ainda" : undefined}
      acao={
        !nova && (
          <Botao variante="fantasma" className="min-h-10 px-3" icone={<Plus className="size-4" aria-hidden />} onClick={() => setNova({ ambiente: "", descricao: "" })}>
            Adicionar
          </Botao>
        )
      }
    >
      <ul className="space-y-2">
        {ficha.medidas.map((m) => (
          <li key={m.id} className="rounded-controle border border-borda p-3 text-sm">
            {editando?.id === m.id ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input className={classeEntrada} value={editando.descricao} onChange={(e) => setEditando({ ...editando, descricao: e.target.value })} aria-label="Medida" />
                <label className="flex min-h-toque items-center gap-2 text-sm">
                  <input type="checkbox" checked={editando.confirmada} onChange={(e) => setEditando({ ...editando, confirmada: e.target.checked })} className="size-4" />
                  Confirmada
                </label>
                <Botao variante="primario" onClick={async () => (await enviar({ acao: "editar", medidaId: m.id, descricao: editando.descricao, confirmada: editando.confirmada }, "Medida corrigida.")) && setEditando(null)}>
                  Salvar
                </Botao>
                <Botao variante="fantasma" onClick={() => setEditando(null)} aria-label="Cancelar edição"><X className="size-4" aria-hidden /></Botao>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {m.ambiente}: {m.descricao}
                  </p>
                  <p className="text-xs text-texto-suave">
                    {FONTES[m.fonte] ?? m.fonte} · origem: {m.origem} ·{" "}
                    <span className={m.confirmada ? "text-sucesso" : "text-aviso"}>{m.confirmada ? "confirmada pelo cliente" : "a confirmar"}</span>
                  </p>
                </div>
                <div className="flex shrink-0">
                  <button onClick={() => setEditando({ id: m.id, descricao: m.descricao, confirmada: m.confirmada })} className="botao-icone" aria-label="Corrigir medida">
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  {podeRemover && (
                    <button onClick={() => enviar({ acao: "remover", medidaId: m.id }, "Medida removida.")} className="botao-icone botao-icone-perigo" aria-label="Remover medida">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {nova && (
        <form
          className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await enviar({ acao: "adicionar", ...nova, fonte: "texto", confirmada: true }, "Medida adicionada.")) setNova(null);
          }}
        >
          <input className={classeEntrada} placeholder="Ambiente" value={nova.ambiente} onChange={(e) => setNova({ ...nova, ambiente: e.target.value })} required aria-label="Ambiente" />
          <input className={classeEntrada} placeholder="Ex.: 3,20 × 2,10 m" value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} required aria-label="Medida" />
          <Botao type="submit" variante="primario">Salvar</Botao>
          <Botao type="button" variante="fantasma" onClick={() => setNova(null)}>Cancelar</Botao>
        </form>
      )}
    </Bloco>
  );
}
