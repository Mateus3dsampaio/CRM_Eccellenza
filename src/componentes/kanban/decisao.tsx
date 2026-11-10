"use client";

import type { ReactNode } from "react";
import { CalendarClock, CalendarPlus, CalendarSync, CheckCircle2, CircleDollarSign, Handshake, XCircle } from "lucide-react";
import type { TipoDecisao } from "@/regras/decisao";
import type { EtapaComAgenda } from "@/regras/etapas";
import { formatarVisitaCurta } from "@/regras/tempo";
import { juntar } from "../estilos";
import { Botao, Modal } from "../ui";

/** O que a decisão faz: abre a agenda, move o card (com a janela de dados quando a etapa pede) ou pede uma nova data de retorno. */
export type EscolhaDecisao = { agendar: EtapaComAgenda } | { mover: "negociacao" | "fechado" | "perdido" } | { novoRetorno: true } | { concluirMedicao: true };

interface Opcao {
  titulo: string;
  detalhe: string;
  icone: ReactNode;
  escolha: EscolhaDecisao;
  perigo?: boolean;
}

const icone = (I: typeof CalendarPlus) => <I className="size-5 shrink-0" aria-hidden />;

// Opções de cada data vencida (pedido do Mateus 04/11/2026). Remarcar não pede motivo; Perdido pede.
const OPCOES: Record<TipoDecisao, { pergunta: string; opcoes: Opcao[] }> = {
  medicao: {
    pergunta: "A medição já passou. Como ficou?",
    opcoes: [
      { titulo: "Medição concluída", detalhe: "Registra a medição como feita. Em seguida você pode marcar a apresentação, se quiser.", icone: icone(CheckCircle2), escolha: { concluirMedicao: true } },
      { titulo: "Não aconteceu: remarcar", detalhe: "Escolher outro dia para a medição.", icone: icone(CalendarSync), escolha: { agendar: "medicao" } },
      { titulo: "Cliente desistiu", detalhe: "Mover para Perdido informando o motivo.", icone: icone(XCircle), escolha: { mover: "perdido" }, perigo: true },
    ],
  },
  apresentacao: {
    pergunta: "A apresentação já passou. Como ficou?",
    opcoes: [
      { titulo: "Apresentação concluída: fechou", detalhe: "Informar o valor e mover para Fechado.", icone: icone(CircleDollarSign), escolha: { mover: "fechado" } },
      { titulo: "Apresentação concluída: cliente veio, segue negociando", detalhe: "Mover para Negociação com a data do próximo contato.", icone: icone(Handshake), escolha: { mover: "negociacao" } },
      { titulo: "Cliente não veio: remarcar", detalhe: "Escolher outro dia para a apresentação.", icone: icone(CalendarSync), escolha: { agendar: "apresentacao" } },
      { titulo: "Cliente desistiu", detalhe: "Mover para Perdido informando o motivo.", icone: icone(XCircle), escolha: { mover: "perdido" }, perigo: true },
    ],
  },
  negociacao: {
    pergunta: "A data de retorno venceu. Como ficou?",
    opcoes: [
      { titulo: "Fechou", detalhe: "Informar o valor e mover para Fechado.", icone: icone(CircleDollarSign), escolha: { mover: "fechado" } },
      { titulo: "Ainda negociando", detalhe: "Marcar a nova data do próximo contato.", icone: icone(CalendarClock), escolha: { novoRetorno: true } },
      { titulo: "Não fechou", detalhe: "Mover para Perdido informando o motivo.", icone: icone(XCircle), escolha: { mover: "perdido" }, perigo: true },
    ],
  },
};

/** Janela de decisão da data vencida: um clique leva para a ação certa, já com os dados obrigatórios. */
export function JanelaDecisao({ nome, tipo, venceuEm, aoFechar, aoEscolher }: { nome: string; tipo: TipoDecisao; venceuEm: string | Date; aoFechar: () => void; aoEscolher: (e: EscolhaDecisao) => void }) {
  const { pergunta, opcoes } = OPCOES[tipo];
  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Decisão pendente: ${nome}`} largura="max-w-lg">
      <p className="text-sm text-texto-suave">
        {pergunta} <span className="font-semibold text-alerta">Venceu em {formatarVisitaCurta(new Date(venceuEm))}.</span>
      </p>
      <div className="mt-4 grid gap-2">
        {opcoes.map((o) => (
          <button
            key={o.titulo}
            type="button"
            onClick={() => aoEscolher(o.escolha)}
            className={juntar(
              "flex min-h-toque items-center gap-3 rounded-controle border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-card",
              o.perigo ? "border-alerta/40 bg-alerta-suave hover:border-alerta" : "border-borda bg-superficie hover:border-marca",
            )}
          >
            <span className={o.perigo ? "text-alerta" : "text-marca-texto"}>{o.icone}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{o.titulo}</span>
              <span className="block text-xs text-texto-suave">{o.detalhe}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Botao variante="fantasma" onClick={aoFechar}>
          Decidir depois
        </Botao>
      </div>
    </Modal>
  );
}

/** Depois de concluir a medição: marcar a apresentação agora é opcional. Sem marcar, o lead fica pronto para marcar, com a faixa âmbar no card. */
export function JanelaMedicaoConcluida({ nome, aoMarcar, aoFechar }: { nome: string; aoMarcar: () => void; aoFechar: () => void }) {
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Medição concluída" largura="max-w-md">
      <p className="text-sm text-texto-suave">
        A medição de <span className="font-semibold text-texto">{nome}</span> foi registrada. Quer marcar a apresentação agora? Se deixar para depois, o card continua em Medição agendada com o aviso &quot;Marcar apresentação&quot;.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Botao variante="fantasma" onClick={aoFechar}>
          Marcar depois
        </Botao>
        <Botao variante="primario" icone={<CalendarPlus className="size-4" aria-hidden />} onClick={aoMarcar}>
          Marcar a apresentação
        </Botao>
      </div>
    </Modal>
  );
}
