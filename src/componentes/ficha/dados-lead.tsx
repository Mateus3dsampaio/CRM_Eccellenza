"use client";

import { useState } from "react";
import { CalendarPlus, Check, ClipboardCopy, Pencil, Plus, Presentation, Trash2, X } from "lucide-react";
import { CLASSIFICACOES, ETAPAS, ETIQUETAS, type Classificacao, type CodigoEtapa } from "@/regras/etapas";
import { formatarVisitaCurta } from "@/regras/tempo";
import { ETAPAS_QUE_PEDEM_DADOS, formatarReais, nomeMotivo } from "@/regras/vendas";
import type { FichaLead } from "@/servicos/consultas";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Botao, Campo, Etiqueta, classeEntrada } from "../ui";
import { usePode } from "../usuario";
import { JanelaMudanca } from "../vendas/janela-mudanca";
import { AgendarVisita } from "./agendar";

const FONTES: Record<string, string> = { texto: "Texto", foto: "Foto", planta: "Planta", audio: "Áudio" };

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className="min-w-0 break-words text-texto">{valor || <span className="text-texto-fraco">não informado</span>}</dd>
    </div>
  );
}

/** Retorno marcado, valores e motivo da perda, conforme a etapa. Só aparece nas etapas que têm esses dados. */
function DadosDeVenda({ ficha, aoEditar }: { ficha: FichaLead; aoEditar: () => void }) {
  const podeEditar = usePode("editar_lead");
  if (!(ETAPAS_QUE_PEDEM_DADOS as string[]).includes(ficha.etapa)) return null;
  const linhas: [string, string][] = [];
  if (ficha.etapa === "orcamento" || ficha.etapa === "negociacao") {
    linhas.push(["Próximo contato", ficha.proximoContatoEm ? formatarVisitaCurta(new Date(ficha.proximoContatoEm)) : "não definido"]);
    linhas.push(["Valor do orçamento", formatarReais(ficha.valorOrcamento) || "não informado"]);
  }
  if (ficha.etapa === "fechado") linhas.push(["Valor fechado", formatarReais(ficha.valorFechado) || "não informado"]);
  if (ficha.etapa === "perdido") linhas.push(["Motivo da perda", `${nomeMotivo(ficha.motivoPerda)}${ficha.concorrente ? ` – ${ficha.concorrente}` : ""}`]);
  return (
    <div className="sm:col-span-2 rounded-controle bg-superficie-suave p-3">
      <dl>
        {linhas.map(([r, v]) => (
          <Linha key={r} rotulo={r} valor={v} />
        ))}
      </dl>
      {podeEditar && (
        <Botao variante="secundario" className="mt-1" icone={<Pencil className="size-4" aria-hidden />} onClick={aoEditar}>
          Editar
        </Botao>
      )}
    </div>
  );
}

export function Painel({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  // Dentro da grade da ficha o quadro tem altura própria: o conteúdo rola dentro dele.
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

// Blocos da ficha (FICHA-01/02/04). Cada bloco é um quadro da grade; o estado compartilhado fica neste hook.
export function useBlocosDadosLead(ficha: FichaLead, aoMudar: () => void) {
  const avisar = useAviso();
  const { dados: agenda } = useDados<{ consultores: { id: string; nome: string }[] }>("/api/agenda?visao=dia");
  const [editando, setEditando] = useState(false);
  const [agendar, setAgendar] = useState<"visita" | "apresentacao" | null>(null);
  // Etapa que pede dados (retorno, valor fechado, motivo da perda): abre a janela; trocar só vale ao confirmar.
  const [pedido, setPedido] = useState<CodigoEtapa | null>(null);

  async function salvar(corpo: object, sucesso = "Ficha atualizada.") {
    try {
      await chamarApi(`/api/leads/${ficha.id}`, { method: "PATCH", json: corpo });
      avisar(sucesso);
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível salvar.", "erro");
      return false;
    } finally {
      aoMudar();
    }
  }

  async function acaoLead(corpo: object, sucesso: string) {
    try {
      await chamarApi("/api/leads/acoes", { method: "POST", json: { ...corpo, ids: [ficha.id] } });
      avisar(sucesso);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível concluir.", "erro");
    } finally {
      aoMudar();
    }
  }

  async function cancelarVisita(visitaId: string) {
    try {
      await chamarApi("/api/agenda", { method: "POST", json: { acao: "cancelar", visitaId } });
      avisar("Cancelado.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível cancelar.", "erro");
    } finally {
      aoMudar();
    }
  }

  const visitaAtiva = ficha.visitas.find((v) => v.status === "agendada" && v.tipo === "visita");
  const apresentacaoAtiva = ficha.visitas.find((v) => v.status === "agendada" && v.tipo === "apresentacao");

  const blocos = {
    resumo: (
        <Painel
          titulo="Resumo para o consultor"
          acao={
            <Botao
              variante="fantasma"
              icone={<ClipboardCopy className="size-4" aria-hidden />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(ficha.resumo ?? "");
                  avisar("Resumo copiado.");
                } catch {
                  avisar("Não foi possível copiar. Selecione o texto e copie.", "erro");
                }
              }}
            >
              Copiar
            </Botao>
          }
        >
          <pre className="whitespace-pre-wrap rounded-controle bg-superficie-suave p-3 font-sans text-sm leading-relaxed text-texto">{ficha.resumo || "O resumo aparece quando o bot ou o consultor preencher a ficha."}</pre>
        </Painel>
    ),
    etapa: (
        <Painel titulo="Etapa e responsável">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Etapa">
              <select className={classeEntrada} value={ficha.etapa} onChange={(e) => ((ETAPAS_QUE_PEDEM_DADOS as string[]).includes(e.target.value) ? setPedido(e.target.value as CodigoEtapa) : void acaoLead({ acao: "mover", etapa: e.target.value }, "Etapa alterada."))}>
                {ETAPAS.map((e) => (
                  <option key={e.codigo} value={e.codigo}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <DadosDeVenda ficha={ficha} aoEditar={() => setPedido(ficha.etapa as CodigoEtapa)} />
            <Campo rotulo="Consultor responsável">
              <select className={classeEntrada} value={ficha.consultor?.id ?? ""} onChange={(e) => salvar({ consultorId: e.target.value || null })}>
                <option value="">Sem consultor</option>
                {agenda?.consultores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Classificação">
              <select className={classeEntrada} value={ficha.classificacao ?? ""} onChange={(e) => salvar({ classificacao: e.target.value || null })}>
                <option value="">Sem classificação</option>
                {(Object.keys(CLASSIFICACOES) as Classificacao[]).map((c) => (
                  <option key={c} value={c}>
                    {CLASSIFICACOES[c]}
                  </option>
                ))}
              </select>
            </Campo>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Etiquetas</span>
              <div className="flex flex-wrap gap-1.5">
                {ficha.etiquetas.map((e) => (
                  <Etiqueta key={e} codigo={e} aoRemover={() => acaoLead({ acao: "etiqueta", etiqueta: e, ativa: false }, "Etiqueta removida.")} />
                ))}
                <select
                  className="min-h-toque rounded-controle border border-dashed border-borda-forte bg-superficie px-3 text-sm text-texto-suave"
                  value=""
                  onChange={(e) => e.target.value && acaoLead({ acao: "etiqueta", etiqueta: e.target.value, ativa: true }, "Etiqueta adicionada.")}
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
        </Painel>
    ),
    visita: (
        <Painel
          titulo="Visita"
          acao={
            <Botao variante="fantasma" icone={<CalendarPlus className="size-4" aria-hidden />} onClick={() => setAgendar("visita")}>
              {visitaAtiva ? "Remarcar" : "Agendar"}
            </Botao>
          }
        >
          {visitaAtiva ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-controle bg-sucesso-suave p-3">
              <p className="text-sm font-medium text-sucesso">
                {visitaAtiva.rotulo} com {visitaAtiva.consultor}
              </p>
              <Botao variante="fantasma" onClick={() => cancelarVisita(visitaAtiva.id)}>
                Cancelar visita
              </Botao>
            </div>
          ) : (
            <p className="text-sm text-texto-suave">Nenhuma visita agendada.</p>
          )}
          {ficha.visitas.some((v) => v.status === "cancelada") && (
            <p className="mt-2 text-xs text-texto-fraco">
              Canceladas: {ficha.visitas.filter((v) => v.status === "cancelada" && v.tipo === "visita").map((v) => v.rotulo).join(", ")}
            </p>
          )}
        </Painel>
    ),
    apresentacao: (
        <Painel
          titulo="Apresentação na loja"
          acao={
            <Botao variante="fantasma" icone={<Presentation className="size-4" aria-hidden />} onClick={() => setAgendar("apresentacao")}>
              {apresentacaoAtiva ? "Remarcar" : "Agendar"}
            </Botao>
          }
        >
          {apresentacaoAtiva ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-controle bg-alerta-suave p-3">
              <p className="text-sm font-medium text-alerta">
                {apresentacaoAtiva.rotulo} com {apresentacaoAtiva.consultor}
              </p>
              <Botao variante="fantasma" onClick={() => cancelarVisita(apresentacaoAtiva.id)}>
                Cancelar apresentação
              </Botao>
            </div>
          ) : (
            <p className="text-sm text-texto-suave">Nenhuma apresentação agendada.</p>
          )}
        </Painel>
    ),
    dados: editando ? (
          <FormularioDados ficha={ficha} aoCancelar={() => setEditando(false)} aoSalvar={async (corpo) => (await salvar(corpo)) && setEditando(false)} />
        ) : (
          <Painel
            titulo="Dados do lead"
            acao={
              <Botao variante="fantasma" icone={<Pencil className="size-4" aria-hidden />} onClick={() => setEditando(true)}>
                Editar
              </Botao>
            }
          >
            <dl className="divide-y divide-borda">
              <Linha rotulo="Nome" valor={ficha.nome ?? ficha.nomePerfil} />
              <Linha rotulo="Telefone" valor={ficha.telefone} />
              <Linha rotulo="Cidade" valor={ficha.cidade} />
              <Linha rotulo="Endereço" valor={ficha.endereco} />
              <Linha rotulo="Ambientes" valor={ficha.ambientes.join(", ")} />
              <Linha rotulo="Situação do imóvel" valor={ficha.situacaoImovel} />
              <Linha rotulo="Prazo" valor={ficha.prazo} />
              <Linha rotulo="Investimento" valor={ficha.investimento} />
              <Linha rotulo="Exigências" valor={ficha.exigencias.join("; ")} />
              <Linha rotulo="Pedidos técnicos" valor={ficha.pedidosTecnicos.length ? ficha.pedidosTecnicos.map((p) => `“${p}”`).join("; ") : null} />
              <Linha rotulo="Observações" valor={ficha.observacoes} />
            </dl>
          </Painel>
        ),
    medidas: <Medidas ficha={ficha} aoMudar={aoMudar} />,
  };
  // Janela de agendar visita/apresentação: fica fora da grade.
  const janelas = (
    <>
      <AgendarVisita leadId={ficha.id} tipo={agendar ?? "visita"} aberto={agendar !== null} aoFechar={() => setAgendar(null)} aoAgendar={aoMudar} />
      {pedido && (
        <JanelaMudanca
          etapa={pedido}
          atuais={ficha}
          aoCancelar={() => setPedido(null)}
          aoConfirmar={(venda) => {
            void acaoLead({ acao: "mover", etapa: pedido, dados: venda }, pedido === ficha.etapa ? "Dados atualizados." : "Etapa alterada.");
            setPedido(null);
          }}
        />
      )}
    </>
  );
  return { blocos, janelas };
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
    <Painel titulo="Editar dados">
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
    </Painel>
  );
}

function Medidas({ ficha, aoMudar }: { ficha: FichaLead; aoMudar: () => void }) {
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
    <Painel
      titulo="Medidas"
      acao={
        !nova && (
          <Botao variante="fantasma" icone={<Plus className="size-4" aria-hidden />} onClick={() => setNova({ ambiente: "", descricao: "" })}>
            Adicionar
          </Botao>
        )
      }
    >
      {ficha.medidas.length === 0 && !nova && <p className="text-sm text-texto-suave">Nenhuma medida registrada.</p>}
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
                  <button onClick={() => setEditando({ id: m.id, descricao: m.descricao, confirmada: m.confirmada })} className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave" aria-label="Corrigir medida">
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  {podeRemover && (
                    <button onClick={() => enviar({ acao: "remover", medidaId: m.id }, "Medida removida.")} className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-alerta-suave hover:text-alerta" aria-label="Remover medida">
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
    </Painel>
  );
}
