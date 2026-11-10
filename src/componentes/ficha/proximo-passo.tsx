"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BellPlus, BellRing, CalendarDays, ChevronDown, CircleAlert, Clock, Hourglass } from "lucide-react";
import { itensDoProximoPasso, type ItemPasso, type TipoItemPasso, type Urgencia } from "@/regras/proximo-passo";
import { ETAPAS_COM_RETORNO, ETAPAS_QUE_PEDEM_DADOS, formatarReais, nomeMotivo } from "@/regras/vendas";
import type { FichaLead } from "@/servicos/consultas";
import { useAgoraDoServidor, useAguardando } from "../espera";
import { juntar } from "../estilos";
import { Botao } from "../ui";
import { useRegrasVendas } from "../vendas/regras";
import { MenuAgendar, type AcoesDoLead } from "./acoes-lead";

/** O que pede ação neste lead, do mais urgente ao menos (regra em `regras/proximo-passo.ts`). */
export function useItensDoPasso(ficha: FichaLead): ItemPasso[] {
  const agora = useAgoraDoServidor();
  const { prazos } = useAguardando();
  return useMemo(() => itensDoProximoPasso(ficha, agora, prazos), [ficha, agora, prazos]);
}

// A cor é só de urgência: vermelho = atrasado/vencido/esperando além do prazo; amarelo = hoje; neutro = futuro.
const CLASSE_CAIXA: Record<Urgencia, string> = {
  vermelho: "border-alerta/45 bg-alerta-suave",
  amarelo: "border-aviso/45 bg-aviso-suave",
  neutro: "border-borda bg-coluna",
};
const CLASSE_TITULO: Record<Urgencia, string> = { vermelho: "text-alerta", amarelo: "text-aviso", neutro: "text-texto" };
const CLASSE_ICONE: Record<Urgencia, string> = { vermelho: "text-alerta", amarelo: "text-aviso", neutro: "text-texto-suave" };
const ICONES: Record<TipoItemPasso, typeof Clock> = { espera: Clock, janela: Hourglass, decisao: CircleAlert, lembrete: BellRing, compromisso: CalendarDays };

const classeAcao = "min-h-9 px-2.5";

/** Uma linha do "Próximo passo": o que é, o detalhe e as ações daquele item. */
export function LinhaPasso({ item, acoes }: { item: ItemPasso; acoes: AcoesDoLead }) {
  const Icone = ICONES[item.tipo];
  const colorida = item.urgencia !== "neutro";
  const acao = juntar(classeAcao, colorida && "text-texto");
  return (
    <div className={juntar("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-controle border py-2 pl-3 pr-1.5", CLASSE_CAIXA[item.urgencia])}>
      <Icone className={juntar("size-[18px] shrink-0", CLASSE_ICONE[item.urgencia])} aria-hidden />
      {/* Largura mínima no texto: em coluna estreita os botões descem para a linha de baixo em vez de espremer o título. */}
      <div className="min-w-[11rem] flex-1 py-0.5">
        <p className={juntar("text-sm font-semibold leading-snug", CLASSE_TITULO[item.urgencia])}>{item.titulo}</p>
        {item.detalhe && <p className={juntar("mt-0.5 whitespace-pre-line break-words text-xs", colorida ? "text-texto" : "text-texto-suave")}>{item.detalhe}</p>}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {item.tipo === "decisao" && item.decisao && (
          <Botao className="min-h-10" onClick={() => acoes.decidir(item.decisao!)}>
            Decidir
          </Botao>
        )}
        {item.tipo === "lembrete" && acoes.podeEditar && (
          <>
            {!acoes.lembreteObrigatorio && (
              <Botao variante="fantasma" className={acao} onClick={acoes.concluirLembrete}>
                Concluir
              </Botao>
            )}
            <Botao variante="fantasma" className={acao} onClick={acoes.editarLembrete}>
              Editar
            </Botao>
          </>
        )}
        {item.tipo === "compromisso" && item.tipoCompromisso && item.visitaId && (
          <>
            <Botao variante="fantasma" className={acao} onClick={() => acoes.agendar(item.tipoCompromisso!)}>
              Remarcar
            </Botao>
            <Botao variante="fantasma" className={acao} onClick={() => acoes.cancelarCompromisso(item.visitaId!)}>
              Cancelar
            </Botao>
          </>
        )}
      </div>
    </div>
  );
}

const CLASSE_PILULA: Record<Urgencia, string> = {
  vermelho: "border-alerta/50 bg-alerta-suave text-alerta",
  amarelo: "border-aviso/50 bg-aviso-suave text-aviso",
  neutro: "border-borda-forte bg-superficie text-texto",
};

/** Faixa "Agora" da gaveta: uma pílula por item. As que têm ação (lembrete, compromisso, decisão) abrem a linha com os botões. */
export function PilulasAgora({ itens, acoes }: { itens: ItemPasso[]; acoes: AcoesDoLead }) {
  const [aberta, setAberta] = useState<string | null>(null);
  if (!itens.length) return null;
  const itemAberto = itens.find((i) => i.chave === aberta);
  return (
    <div className="flex shrink-0 flex-col gap-2 px-3 pt-3" aria-label="O que pede ação agora">
      <div className="flex flex-wrap items-center gap-2">
        {itens.map((item) => {
          const Icone = ICONES[item.tipo];
          const classe = juntar("inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-pilula border px-3 text-[13px] font-semibold", CLASSE_PILULA[item.urgencia]);
          const conteudo = (
            <>
              <Icone className={juntar("size-4 shrink-0", item.urgencia === "neutro" && "text-texto-suave")} aria-hidden />
              {item.curto}
            </>
          );
          const temAcao = item.tipo === "lembrete" || item.tipo === "compromisso" || item.tipo === "decisao";
          if (!temAcao) {
            return (
              <span key={item.chave} className={classe} title={item.detalhe ?? undefined}>
                {conteudo}
              </span>
            );
          }
          const estaAberta = aberta === item.chave;
          return (
            <button key={item.chave} type="button" onClick={() => setAberta(estaAberta ? null : item.chave)} aria-expanded={estaAberta} className={juntar(classe, "transition hover:brightness-110", estaAberta && "ring-2 ring-marca-texto/50")}>
              {conteudo}
              <ChevronDown className={juntar("size-3.5 shrink-0 transition-transform duration-200", estaAberta && "rotate-180")} aria-hidden />
            </button>
          );
        })}
      </div>
      {itemAberto && (
        <div className="animate-surgir">
          <LinhaPasso item={itemAberto} acoes={acoes} />
        </div>
      )}
    </div>
  );
}

/** Dado de venda da etapa (valor do orçamento, valor fechado ou motivo da perda), numa linha neutra com Editar. */
function LinhaDeVenda({ ficha, acoes }: { ficha: FichaLead; acoes: AcoesDoLead }) {
  const { motivos } = useRegrasVendas();
  if (!(ETAPAS_QUE_PEDEM_DADOS as string[]).includes(ficha.etapa)) return null;
  const [titulo, detalhe] =
    ficha.etapa === "negociacao"
      ? [ficha.valorOrcamento ? `Orçamento de ${formatarReais(ficha.valorOrcamento)}` : "Valor do orçamento não informado", "em negociação"]
      : ficha.etapa === "fechado"
        ? [ficha.valorFechado ? `Fechado por ${formatarReais(ficha.valorFechado)}` : "Valor fechado não informado", null]
        : [`Motivo da perda: ${nomeMotivo(ficha.motivoPerda, motivos)}`, ficha.concorrente];
  return (
    <div className={juntar("flex items-center gap-3 rounded-controle border py-2 pl-3 pr-1.5", CLASSE_CAIXA.neutro)}>
      <span className="w-[18px] shrink-0 text-center text-xs font-bold text-texto-suave" aria-hidden>
        R$
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold leading-snug">{titulo}</p>
        {detalhe && <p className="mt-0.5 break-words text-xs text-texto-suave">{detalhe}</p>}
      </div>
      {acoes.podeEditar && (
        <Botao variante="fantasma" className={classeAcao} onClick={acoes.editarVenda}>
          Editar
        </Botao>
      )}
    </div>
  );
}

/** Bloco "Próximo passo" da ficha completa: o único com cor. Vazio, convida a marcar um retorno ou compromisso. */
export function BlocoProximoPasso({ ficha, itens, acoes, extra }: { ficha: FichaLead; itens: ItemPasso[]; acoes: AcoesDoLead; extra?: ReactNode }) {
  const aberto = (ETAPAS_COM_RETORNO as string[]).includes(ficha.etapa) && !ficha.arquivado;
  const podeLembrar = aberto && acoes.podeEditar && !ficha.proximoContatoEm;
  const temVenda = (ETAPAS_QUE_PEDEM_DADOS as string[]).includes(ficha.etapa);
  const vazio = itens.length === 0 && !temVenda;
  return (
    <section className={juntar("shrink-0 rounded-painel border bg-superficie p-3.5 shadow-painel", vazio && aberto ? "border-dashed border-borda-forte" : "border-borda-forte")}>
      <div className="mb-2 flex min-h-10 flex-wrap items-center gap-1">
        <h2 className="flex-1 whitespace-nowrap font-semibold">Próximo passo</h2>
        {!vazio && aberto && <MenuAgendar aoEscolher={acoes.agendar} />}
        {!vazio && podeLembrar && (
          <Botao variante="fantasma" className="min-h-10 px-3" icone={<BellPlus className="size-4" aria-hidden />} onClick={acoes.editarLembrete}>
            Lembrete
          </Botao>
        )}
        {extra}
      </div>
      {vazio ? (
        aberto ? (
          <>
            <p className="text-sm text-texto-suave">Nada marcado. Combine um retorno ou um compromisso para este cliente não esfriar.</p>
            <div className="mt-3 flex flex-wrap gap-2.5 pb-1.5">
              <MenuAgendar aoEscolher={acoes.agendar} destaque alinhar="esquerda" />
              {podeLembrar && (
                <Botao icone={<BellPlus className="size-4" aria-hidden />} onClick={acoes.editarLembrete}>
                  Lembrete
                </Botao>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-texto-suave">Nada pendente.</p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {itens.map((item) => (
            <LinhaPasso key={item.chave} item={item} acoes={acoes} />
          ))}
          <LinhaDeVenda ficha={ficha} acoes={acoes} />
        </div>
      )}
    </section>
  );
}

/** Ficha recolhida: as urgências continuam à vista como ícones coloridos. */
export function IconesDoPasso({ itens }: { itens: ItemPasso[] }) {
  return (
    <>
      {itens.map((item) => {
        const Icone = ICONES[item.tipo];
        return (
          <span key={item.chave} role="img" aria-label={item.titulo} title={item.titulo} className={juntar("inline-flex size-10 items-center justify-center rounded-controle border", CLASSE_PILULA[item.urgencia])}>
            <Icone className={juntar("size-[18px]", item.urgencia === "neutro" && "text-texto-suave")} aria-hidden />
          </span>
        );
      })}
    </>
  );
}
