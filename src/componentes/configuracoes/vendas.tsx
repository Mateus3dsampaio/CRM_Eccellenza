"use client";

import { ArrowDown, ArrowUp, CalendarClock, EyeOff, Eye, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import type { MotivoDePerda } from "@/regras/vendas";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Botao, Campo, Carregando, EstadoErro, Modal, classeEntrada } from "../ui";

interface Regras {
  exigirContatoNegociacao: boolean;
  motivos: MotivoDePerda[];
}

type Edicao = { codigo: string | null; nome: string; pergunta: string };

/** Configurações > Vendas: se Negociação exige o próximo contato e a lista de motivos de perda. */
export function VendasConfig() {
  const avisar = useAviso();
  const { dados, erro, carregando, recarregar } = useDados<Regras>("/api/vendas/regras");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [excluindo, setExcluindo] = useState<MotivoDePerda | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // A caixa muda na hora; o servidor confirma em seguida (se falhar, volta ao valor salvo).
  const [exigirAgora, setExigirAgora] = useState<boolean | null>(null);

  async function agir(corpo: object, sucesso: string): Promise<boolean> {
    setOcupado(true);
    try {
      await chamarApi("/api/configuracoes/vendas", { method: "POST", json: corpo });
      avisar(sucesso);
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível salvar.", "erro");
      return false;
    } finally {
      await recarregar();
      setExigirAgora(null);
      setOcupado(false);
    }
  }

  if (carregando && !dados) return <Carregando linhas={4} />;
  if (erro && !dados) return <EstadoErro texto={erro} aoTentar={recarregar} />;
  if (!dados) return null;

  const { motivos } = dados;
  const exigir = exigirAgora ?? dados.exigirContatoNegociacao;
  function mover(i: number, delta: -1 | 1) {
    const codigos = motivos.map((m) => m.codigo);
    const j = i + delta;
    if (j < 0 || j >= codigos.length) return;
    [codigos[i], codigos[j]] = [codigos[j], codigos[i]];
    void agir({ acao: "reordenar_motivos", codigos }, "Ordem salva.");
  }

  async function salvarEdicao() {
    if (!edicao) return;
    const ok = edicao.codigo
      ? await agir({ acao: "editar_motivo", codigo: edicao.codigo, nome: edicao.nome, pergunta: edicao.pergunta.trim() || null }, "Motivo salvo.")
      : await agir({ acao: "criar_motivo", nome: edicao.nome, pergunta: edicao.pergunta.trim() || null }, "Motivo criado.");
    if (ok) setEdicao(null);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <CalendarClock className="size-4 text-texto-suave" aria-hidden /> Próximo contato ao mover o card
        </h2>
        <p className="mb-3 text-sm text-texto-suave">
          Em <strong className="text-texto">Orçamento apresentado</strong> o próximo contato é sempre obrigatório. Aqui você escolhe se <strong className="text-texto">Negociação</strong> também exige.
        </p>
        <label className="flex min-h-toque cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-[var(--color-marca)]"
            checked={exigir}
            disabled={ocupado}
            onChange={(e) => {
              setExigirAgora(e.target.checked);
              void agir({ acao: "exigir_contato_negociacao", exigir: e.target.checked }, e.target.checked ? "Negociação agora exige o próximo contato." : "Negociação não exige mais o próximo contato.");
            }}
          />
          Exigir &quot;Próximo contato em&quot; ao mover para Negociação
        </label>
        {!exigir && <p className="mt-2 text-xs text-texto-fraco">Desligado: a janela deixa a data em branco, e os leads em Negociação sem data não aparecem em &quot;Retornos de hoje&quot;.</p>}
      </section>

      <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <XCircle className="size-4 text-texto-suave" aria-hidden /> Motivos de perda
          </h2>
          <Botao variante="primario" icone={<Plus className="size-4" aria-hidden />} onClick={() => setEdicao({ codigo: null, nome: "", pergunta: "" })}>
            Novo motivo
          </Botao>
        </div>
        <p className="mb-3 text-sm text-texto-suave">É a lista que aparece quando o vendedor move um card para Perdido. Motivo desativado some da lista, mas continua nos números do painel.</p>
        <ul className="divide-y divide-borda rounded-controle border border-borda">
          {motivos.map((m, i) => (
            <li key={m.codigo} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className={juntar("truncate text-sm font-medium", !m.ativo && "text-texto-fraco line-through")}>{m.nome}</p>
                {m.pergunta && <p className="truncate text-xs text-texto-fraco">Pergunta: {m.pergunta}</p>}
                {!m.ativo && <p className="text-xs text-texto-fraco">Desativado</p>}
              </div>
              <div className="flex items-center">
                <button title="Subir" aria-label={`Subir ${m.nome}`} disabled={ocupado || i === 0} onClick={() => mover(i, -1)} className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave disabled:opacity-40">
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button title="Descer" aria-label={`Descer ${m.nome}`} disabled={ocupado || i === motivos.length - 1} onClick={() => mover(i, 1)} className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave disabled:opacity-40">
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button title="Editar" aria-label={`Editar ${m.nome}`} onClick={() => setEdicao({ codigo: m.codigo, nome: m.nome, pergunta: m.pergunta ?? "" })} className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave">
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  aria-label={m.ativo ? `Desativar ${m.nome}` : `Ativar ${m.nome}`}
                  title={m.ativo ? "Desativar" : "Ativar"}
                  disabled={ocupado}
                  onClick={() => void agir({ acao: "editar_motivo", codigo: m.codigo, ativo: !m.ativo }, m.ativo ? "Motivo desativado." : "Motivo ativado.")}
                  className="inline-flex size-toque items-center justify-center rounded-controle text-texto-suave hover:bg-superficie-suave"
                >
                  {m.ativo ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
                <button title="Excluir" aria-label={`Excluir ${m.nome}`} onClick={() => setExcluindo(m)} className="ml-3 inline-flex size-toque items-center justify-center rounded-controle text-alerta hover:bg-alerta-suave">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Modal aberto={!!edicao} aoFechar={() => setEdicao(null)} titulo={edicao?.codigo ? "Editar motivo" : "Novo motivo"} largura="max-w-md">
        {edicao && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void salvarEdicao();
            }}
          >
            <Campo rotulo="Nome do motivo">
              <input className={classeEntrada} value={edicao.nome} maxLength={60} required onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Pergunta extra (opcional)" dica='Se preencher, o vendedor precisa responder ao escolher este motivo. Ex.: "Qual concorrente?"'>
              <input className={classeEntrada} value={edicao.pergunta} maxLength={100} onChange={(e) => setEdicao({ ...edicao, pergunta: e.target.value })} />
            </Campo>
            <div className="flex justify-end gap-2">
              <Botao type="button" variante="fantasma" onClick={() => setEdicao(null)}>
                Cancelar
              </Botao>
              <Botao type="submit" variante="primario" carregando={ocupado}>
                Salvar
              </Botao>
            </div>
          </form>
        )}
      </Modal>

      <Modal aberto={!!excluindo} aoFechar={() => setExcluindo(null)} titulo="Excluir motivo" largura="max-w-md">
        <p className="text-sm text-texto-suave">
          Excluir &quot;{excluindo?.nome}&quot;? Se algum lead já perdeu por esse motivo, ele não pode ser excluído: desative em vez disso.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setExcluindo(null)}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            carregando={ocupado}
            onClick={async () => {
              if (excluindo) await agir({ acao: "excluir_motivo", codigo: excluindo.codigo }, "Motivo excluído.");
              setExcluindo(null);
            }}
          >
            Excluir
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
