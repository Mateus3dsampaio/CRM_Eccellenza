"use client";

import { useState, type ReactNode } from "react";
import { CalendarPlus, Check, ChevronDown, Presentation, Ruler } from "lucide-react";
import { NOMES_COMPROMISSO, type TipoCompromisso } from "@/regras/agenda";
import type { TipoDecisao } from "@/regras/decisao";
import { etapaComAgenda, type CodigoEtapa } from "@/regras/etapas";
import { ETAPAS_QUE_PEDEM_DADOS } from "@/regras/vendas";
import type { FichaLead } from "@/servicos/consultas";
import { chamarApi, useAviso } from "../dados";
import { COR_ETAPA, juntar } from "../estilos";
import { useNomesEtapas } from "../etapas";
import { JanelaDecisao, type EscolhaDecisao } from "../kanban/decisao";
import { Botao, Modal, Popover, classeEntrada } from "../ui";
import { usePode } from "../usuario";
import { JanelaMudanca } from "../vendas/janela-mudanca";
import { retornoObrigatorio, useRegrasVendas } from "../vendas/regras";
import { AgendarVisita } from "./agendar";
import { JanelaLembrete } from "./lembrete";

/** Tudo o que a gaveta e a ficha completa fazem com o lead. As janelas (agenda, lembrete, decisão, nota) ficam em `janelas`. */
export interface AcoesDoLead {
  podeEditar: boolean;
  /** Em Negociação o próximo contato é obrigatório (conforme a configuração): não dá para concluir, só trocar a data. */
  lembreteObrigatorio: boolean;
  salvar: (corpo: object, sucesso?: string) => Promise<boolean>;
  acaoLead: (corpo: object, sucesso: string) => Promise<void>;
  transferir: (para: string) => Promise<void>;
  /** Troca a etapa, abrindo antes a janela que a etapa pede (agenda, dados de venda, cancelar compromisso). */
  pedirEtapa: (etapa: string) => void;
  agendar: (tipo: TipoCompromisso) => void;
  cancelarCompromisso: (visitaId: string) => void;
  editarLembrete: () => void;
  concluirLembrete: () => void;
  decidir: (decisao: { tipo: TipoDecisao; venceuEm: string }) => void;
  editarVenda: () => void;
  novaNota: () => void;
  copiarResumo: () => void;
}

export function useAcoesDoLead(ficha: FichaLead, aoMudar: () => void): { acoes: AcoesDoLead; janelas: ReactNode } {
  const avisar = useAviso();
  const nomesEtapas = useNomesEtapas();
  const regras = useRegrasVendas();
  const podeEditar = usePode("editar_lead");
  const [agendar, setAgendar] = useState<TipoCompromisso | null>(null);
  const [voltando, setVoltando] = useState(false);
  // Etapa que pede dados (retorno, valor fechado, motivo da perda): abre a janela; trocar só vale ao confirmar.
  const [pedido, setPedido] = useState<{ etapa: CodigoEtapa; novoRetorno?: boolean } | null>(null);
  const [lembrete, setLembrete] = useState(false);
  const [decidindo, setDecidindo] = useState<{ tipo: TipoDecisao; venceuEm: string } | null>(null);
  const [nota, setNota] = useState(false);
  const compromissosMarcados = ficha.visitas.filter((v) => v.status === "agendada" && v.tipo !== "visita");
  const lembreteObrigatorio = retornoObrigatorio(regras, ficha.etapa);

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

  async function transferir(para: string) {
    try {
      await chamarApi(`/api/leads/${ficha.id}/transferir`, { method: "POST", json: { para } });
      avisar("Lead transferido.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível transferir.", "erro");
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

  async function cancelarCompromisso(visitaId: string) {
    try {
      await chamarApi("/api/agenda", { method: "POST", json: { acao: "cancelar", visitaId } });
      avisar("Cancelado.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível cancelar.", "erro");
    } finally {
      aoMudar();
    }
  }

  function pedirEtapa(etapa: string) {
    if (etapa === ficha.etapa) return;
    // Medição/Apresentação: o card só entra com o compromisso marcado (abre a agenda).
    if (etapaComAgenda(etapa)) return setAgendar(etapa);
    if ((ETAPAS_QUE_PEDEM_DADOS as string[]).includes(etapa)) return setPedido({ etapa: etapa as CodigoEtapa });
    // Voltar para qualificação com medição/apresentação marcada: pergunta antes de cancelar o compromisso.
    if (etapa === "qualificacao" && compromissosMarcados.length) return setVoltando(true);
    void acaoLead({ acao: "mover", etapa }, "Etapa alterada.");
  }

  // Mesmo caminho do kanban: a decisão leva para a agenda, para a janela de dados ou para a nova data de retorno.
  function aoDecidir(escolha: EscolhaDecisao) {
    setDecidindo(null);
    if ("agendar" in escolha) return setAgendar(escolha.agendar);
    if ("mover" in escolha) return setPedido({ etapa: escolha.mover });
    setPedido({ etapa: "negociacao", novoRetorno: true });
  }

  async function copiarResumo() {
    try {
      await navigator.clipboard.writeText(ficha.resumo ?? "");
      avisar("Resumo copiado.");
    } catch {
      avisar("Não foi possível copiar. Selecione o texto e copie.", "erro");
    }
  }

  const acoes: AcoesDoLead = {
    podeEditar,
    lembreteObrigatorio,
    salvar,
    acaoLead,
    transferir,
    pedirEtapa,
    agendar: setAgendar,
    cancelarCompromisso: (id) => void cancelarCompromisso(id),
    editarLembrete: () => setLembrete(true),
    concluirLembrete: () => void salvar({ venda: { proximoContatoEm: null } }, "Lembrete concluído."),
    decidir: setDecidindo,
    editarVenda: () => setPedido({ etapa: ficha.etapa as CodigoEtapa }),
    novaNota: () => setNota(true),
    copiarResumo: () => void copiarResumo(),
  };

  const janelas = (
    <>
      <AgendarVisita leadId={ficha.id} tipo={agendar ?? "visita"} aberto={agendar !== null} aoFechar={() => setAgendar(null)} aoAgendar={aoMudar} />
      <Modal aberto={voltando} aoFechar={() => setVoltando(false)} titulo="Cancelar compromisso?" largura="max-w-md">
        <p className="text-sm text-texto-suave">
          Este card tem {compromissosMarcados.map((v) => `${NOMES_COMPROMISSO[v.tipo as TipoCompromisso].toLowerCase()} de ${v.rotulo}`).join(" e ")} na agenda. Voltar para &quot;{nomesEtapas.nome("qualificacao")}&quot; cancela{" "}
          {compromissosMarcados.length > 1 ? "esses compromissos" : "esse compromisso"}. Deseja cancelar e mover o card?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setVoltando(false)}>
            Manter como está
          </Botao>
          <Botao
            variante="perigo"
            onClick={() => {
              setVoltando(false);
              void acaoLead({ acao: "mover", etapa: "qualificacao", cancelarCompromissos: true }, "Compromisso cancelado e etapa alterada.");
            }}
          >
            Cancelar compromisso e mover
          </Botao>
        </div>
      </Modal>
      {pedido && (
        <JanelaMudanca
          etapa={pedido.etapa}
          atuais={pedido.novoRetorno ? { ...ficha, proximoContatoEm: null, lembreteNota: null } : ficha}
          aoCancelar={() => setPedido(null)}
          aoConfirmar={(venda) => {
            void acaoLead({ acao: "mover", etapa: pedido.etapa, dados: venda }, pedido.etapa === ficha.etapa ? "Dados atualizados." : "Etapa alterada.");
            setPedido(null);
          }}
        />
      )}
      {lembrete && <JanelaLembrete ficha={ficha} obrigatorio={lembreteObrigatorio} aoFechar={() => setLembrete(false)} salvar={salvar} />}
      {decidindo && <JanelaDecisao nome={ficha.nomeExibicao} tipo={decidindo.tipo} venceuEm={decidindo.venceuEm} aoFechar={() => setDecidindo(null)} aoEscolher={aoDecidir} />}
      {nota && <JanelaNota leadId={ficha.id} aoFechar={() => setNota(false)} aoMudar={aoMudar} />}
    </>
  );
  return { acoes, janelas };
}

/** Nota interna rápida (o cliente não vê): abre pela gaveta e pelo bloco Notas da ficha. */
function JanelaNota({ leadId, aoFechar, aoMudar }: { leadId: string; aoFechar: () => void; aoMudar: () => void }) {
  const avisar = useAviso();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Nova nota" largura="max-w-md">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSalvando(true);
          try {
            await chamarApi(`/api/leads/${leadId}/notas`, { method: "POST", json: { texto } });
            avisar("Nota salva.");
            aoFechar();
          } catch (erro) {
            avisar(erro instanceof Error ? erro.message : "Não foi possível salvar.", "erro");
          } finally {
            setSalvando(false);
            aoMudar();
          }
        }}
      >
        <textarea autoFocus className={juntar(classeEntrada, "h-28 resize-none py-2")} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva uma nota (o cliente não vê)" aria-label="Nova nota" />
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" carregando={salvando} disabled={!texto.trim()}>
            Salvar nota
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

/** Etapa do lead como botão: mostra a etapa atual e abre a lista para trocar (gaveta e barra de cima da ficha). */
export function SeletorEtapa({ etapa, aoEscolher, alinhar = "direita" }: { etapa: string; aoEscolher: (etapa: string) => void; alinhar?: "esquerda" | "direita" }) {
  const nomesEtapas = useNomesEtapas();
  const [aberto, setAberto] = useState(false);
  return (
    <Popover
      aberto={aberto}
      aoFechar={() => setAberto(false)}
      titulo="Trocar etapa"
      largura="sm:w-64"
      alinhar={alinhar}
      gatilho={
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-haspopup="dialog"
          aria-label={`Etapa: ${nomesEtapas.nome(etapa)}. Trocar etapa`}
          title="Trocar etapa"
          className="tecla inline-flex min-h-10 max-w-[13rem] items-center gap-2 rounded-controle px-3 text-sm font-medium"
        >
          <span className={juntar("size-2.5 shrink-0 rounded-full", COR_ETAPA[etapa])} aria-hidden />
          <span className="truncate">{nomesEtapas.nome(etapa)}</span>
          <ChevronDown className="size-4 shrink-0 text-texto-suave" aria-hidden />
        </button>
      }
    >
      <div className="-mt-1 grid gap-0.5">
        {nomesEtapas.lista.map((e) => (
          <button
            key={e.codigo}
            type="button"
            onClick={() => {
              setAberto(false);
              aoEscolher(e.codigo);
            }}
            className={juntar("flex min-h-toque items-center gap-3 rounded-controle px-3 text-left text-sm hover:bg-superficie-suave", e.codigo === etapa && "bg-superficie-suave font-semibold")}
          >
            <span className={juntar("size-2.5 shrink-0 rounded-full", COR_ETAPA[e.codigo])} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{e.nome}</span>
            {e.codigo === etapa && <Check className="size-4 text-marca-texto" aria-hidden />}
          </button>
        ))}
      </div>
    </Popover>
  );
}

const ICONE_COMPROMISSO: Record<TipoCompromisso, typeof CalendarPlus> = { visita: CalendarPlus, medicao: Ruler, apresentacao: Presentation };

/** Botão "Agendar" que pergunta o que marcar: visita à loja, medição ou apresentação. */
export function MenuAgendar({ aoEscolher, abrir = "baixo", alinhar = "direita", destaque, rotulo = "Agendar" }: { aoEscolher: (tipo: TipoCompromisso) => void; abrir?: "baixo" | "cima"; alinhar?: "esquerda" | "direita"; destaque?: boolean; rotulo?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Popover
      aberto={aberto}
      aoFechar={() => setAberto(false)}
      titulo="O que agendar?"
      largura="sm:w-60"
      abrir={abrir}
      alinhar={alinhar}
      gatilho={
        <Botao variante={destaque ? "secundario" : "fantasma"} className={destaque ? undefined : "min-h-10 px-3"} icone={<CalendarPlus className="size-4" aria-hidden />} onClick={() => setAberto((a) => !a)} aria-expanded={aberto} aria-haspopup="dialog">
          {rotulo}
        </Botao>
      }
    >
      <div className="-mt-1 grid gap-0.5">
        {(Object.keys(NOMES_COMPROMISSO) as TipoCompromisso[]).map((tipo) => {
          const Icone = ICONE_COMPROMISSO[tipo];
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setAberto(false);
                aoEscolher(tipo);
              }}
              className="flex min-h-toque items-center gap-3 rounded-controle px-3 text-left text-sm hover:bg-superficie-suave"
            >
              <Icone className="size-4 text-texto-suave" aria-hidden />
              {NOMES_COMPROMISSO[tipo]}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
