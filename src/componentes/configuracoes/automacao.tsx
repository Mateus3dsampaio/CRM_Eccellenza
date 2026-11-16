"use client";

import { Archive, ShieldCheck, UserX } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { RegrasArquivarPerdido } from "@/regras/arquivar-perdido";
import type { RegrasDesclassificados } from "@/regras/desclassificados";
import type { RegrasRedeDeSeguranca } from "@/regras/rede-seguranca";
import { juntar } from "../estilos";
import { classeEntrada } from "../ui";
import { useBlocoSalvavel } from "./barra-salvar";

export interface DadosAutomacao {
  desclassificados: RegrasDesclassificados;
  rede: RegrasRedeDeSeguranca;
  arquivar: RegrasArquivarPerdido;
  /** Quantos cards cada regra pegaria agora, com os prazos salvos. */
  previa: { desclassificados: number; redePerdido: number; redeArquivar: number; arquivarAutomatico: number; arquivarVendedor: number };
}

type Salvar = (corpo: Partial<Pick<DadosAutomacao, "desclassificados" | "rede" | "arquivar">>, sucesso: string) => Promise<void>;

const cards = (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? "card" : "cards"}`;

/** Bloco de uma regra: rascunho próprio, ligado à barra "Salvar" da tela. */
function useRascunho<T>(chave: string, salvo: T, salvar: (r: T) => Promise<void>) {
  const [rascunho, setRascunho] = useState<T>(salvo);
  const mudou = JSON.stringify(rascunho) !== JSON.stringify(salvo);
  useBlocoSalvavel(chave, { mudou, salvar: () => salvar(rascunho), descartar: () => setRascunho(salvo) });
  return [rascunho, setRascunho] as const;
}

function Cartao({ icone, titulo, texto, children }: { icone: ReactNode; titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 luz-marca-fio">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        {icone} {titulo}
      </h2>
      <p className="mb-3 text-sm text-texto-suave">{texto}</p>
      {children}
    </section>
  );
}

function Interruptor({ rotulo, ligado, aoMudar, desabilitado }: { rotulo: string; ligado: boolean; aoMudar: (v: boolean) => void; desabilitado?: boolean }) {
  return (
    <label className="flex min-h-toque cursor-pointer items-center gap-3 text-sm font-medium">
      <input type="checkbox" className="interruptor" checked={ligado} disabled={desabilitado} onChange={(e) => aoMudar(e.target.checked)} />
      {rotulo}
    </label>
  );
}

function Numero({ rotulo, valor, min, max, desabilitado, aoMudar }: { rotulo: string; valor: number; min: number; max: number; desabilitado: boolean; aoMudar: (v: number) => void }) {
  return <input type="number" inputMode="numeric" min={min} max={max} disabled={desabilitado} aria-label={rotulo} value={valor} onChange={(e) => aoMudar(Number(e.target.value))} className={juntar(classeEntrada, "w-24!")} />;
}

/** Aviso do que acontece na hora em que a regra for ligada (só aparece com a regra salva como desligada). */
function Previa({ mostrar, children }: { mostrar: boolean; children: ReactNode }) {
  if (!mostrar) return null;
  return <p className="mt-3 rounded-controle border border-borda bg-fundo px-3 py-2 text-xs text-texto-suave">{children}</p>;
}

/**
 * Configurações > Automação de leads, abaixo da recuperação: as três regras que tiram cards do quadro sozinhas
 * (tarefas 40 a 42). Todas nascem desligadas; cada uma mostra quantos cards pegaria agora, antes de o admin ligar.
 */
export function AutomacaoDeLeads({ dados, aoSalvar }: { dados: DadosAutomacao; aoSalvar: Salvar }) {
  const [desc, setDesc] = useRascunho("automacao-desclassificados", dados.desclassificados, (r) => aoSalvar({ desclassificados: r }, "Desclassificados: regra salva."));
  const [rede, setRede] = useRascunho("automacao-rede", dados.rede, (r) => aoSalvar({ rede: r }, "Rede de segurança salva."));
  const [arq, setArq] = useRascunho("automacao-arquivar", dados.arquivar, (r) => aoSalvar({ arquivar: r }, "Arquivamento de perdidos salvo."));
  const p = dados.previa;

  return (
    <>
      <Cartao
        icone={<UserX className="size-4 text-texto-suave" aria-hidden />}
        titulo="Desclassificados"
        texto="Cliente que a IA classificou como outra cidade ou curioso / sem perfil não recebe as mensagens de recuperação e sai sozinho do quadro. Só vale para quem ainda está com a IA; lead passado ao consultor não é tocado. Se o cliente escrever depois, o card volta para a coluna em que estava."
      >
        <Interruptor rotulo="Mover desclassificados para Perdido" ligado={desc.ligado} aoMudar={(v) => setDesc((r) => ({ ...r, ligado: v }))} />
        <label className={juntar("mt-2 flex flex-wrap items-center gap-2 text-sm", !desc.ligado && "opacity-60")}>
          <span>Mover após</span>
          <Numero rotulo="Horas até mover o desclassificado para Perdido" valor={desc.horas} min={1} max={168} desabilitado={!desc.ligado} aoMudar={(v) => setDesc((r) => ({ ...r, horas: v }))} />
          <span>horas sem o cliente escrever</span>
        </label>
        <p className="mt-1 text-xs text-texto-fraco">Motivos gravados: &quot;Outra cidade (automático)&quot; e &quot;Curioso / sem perfil (automático)&quot;. Desligada, esses clientes seguem a recuperação de leads normal.</p>
        <Previa mostrar={!dados.desclassificados.ligado}>Ao ligar com o prazo salvo, {cards(p.desclassificados)} {p.desclassificados === 1 ? "vai" : "vão"} para Perdido na hora.</Previa>
      </Cartao>

      <Cartao
        icone={<ShieldCheck className="size-4 text-texto-suave" aria-hidden />}
        titulo="Rede de segurança"
        texto="Nenhum card fica para sempre na coluna da IA. Depois do prazo sem mensagem do cliente, não importa quem falou por último, o card vai para Perdido com o motivo &quot;Sem resposta (automático)&quot;. Pós-venda não é venda perdida: vai direto para o arquivo. Não vale para lead com o consultor, com visita marcada ou com retorno marcado para a frente."
      >
        <Interruptor rotulo="Rede de segurança ligada" ligado={rede.ligado} aoMudar={(v) => setRede((r) => ({ ...r, ligado: v }))} />
        <label className={juntar("mt-2 flex flex-wrap items-center gap-2 text-sm", !rede.ligado && "opacity-60")}>
          <span>Tirar do quadro após</span>
          <Numero rotulo="Dias sem mensagem do cliente até sair do quadro" valor={rede.dias} min={1} max={60} desabilitado={!rede.ligado} aoMudar={(v) => setRede((r) => ({ ...r, dias: v }))} />
          <span>dias sem mensagem do cliente</span>
        </label>
        <p className="mt-1 text-xs text-texto-fraco">Com a rede ligada, a retomada antiga (modelo enviado após 3 dias) deixa de ser enviada.</p>
        <Previa mostrar={!dados.rede.ligado}>
          Ao ligar com o prazo salvo, {cards(p.redePerdido)} {p.redePerdido === 1 ? "vai" : "vão"} para Perdido e {cards(p.redeArquivar)} de pós-venda {p.redeArquivar === 1 ? "vai" : "vão"} para o arquivo na hora.
        </Previa>
      </Cartao>

      <Cartao
        icone={<Archive className="size-4 text-texto-suave" aria-hidden />}
        titulo="Arquivar perdidos"
        texto="A coluna Perdido se esvazia sozinha. O prazo conta do dia em que o card entrou em Perdido. Atenção: card arquivado é excluído de vez 30 dias depois, com a conversa e os arquivos; os números do Painel ficam. Se o cliente escrever antes disso, o card sai do arquivo e volta para a coluna em que estava."
      >
        <Interruptor rotulo="Arquivar perdidos automaticamente" ligado={arq.ligado} aoMudar={(v) => setArq((r) => ({ ...r, ligado: v }))} />
        <div className={juntar("mt-2 space-y-2", !arq.ligado && "opacity-60")}>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span>Perdido automático: arquivar após</span>
            <Numero rotulo="Dias em Perdido até arquivar o perdido automático" valor={arq.diasAutomatico} min={1} max={365} desabilitado={!arq.ligado} aoMudar={(v) => setArq((r) => ({ ...r, diasAutomatico: v }))} />
            <span>dias</span>
          </label>
          <p className="text-xs text-texto-fraco">É o card que o sistema moveu: sem resposta, outra cidade, curioso / sem perfil.</p>
          <Interruptor rotulo="Arquivar também o perdido marcado pelo vendedor" ligado={arq.vendedorLigado} desabilitado={!arq.ligado} aoMudar={(v) => setArq((r) => ({ ...r, vendedorLigado: v }))} />
          <label className={juntar("flex flex-wrap items-center gap-2 text-sm", !arq.vendedorLigado && "opacity-60")}>
            <span>Perdido marcado pelo vendedor: arquivar após</span>
            <Numero rotulo="Dias em Perdido até arquivar o perdido marcado pelo vendedor" valor={arq.diasVendedor} min={1} max={365} desabilitado={!arq.ligado || !arq.vendedorLigado} aoMudar={(v) => setArq((r) => ({ ...r, diasVendedor: v }))} />
            <span>dias</span>
          </label>
          <p className="text-xs text-texto-fraco">Preço, prazo, concorrente, desistiu e os outros motivos escolhidos por uma pessoa. Desligado, esses cards só saem de Perdido à mão.</p>
        </div>
        <Previa mostrar={!dados.arquivar.ligado}>
          Ao ligar com os prazos salvos, {cards(p.arquivarAutomatico)} de perdido automático{dados.arquivar.vendedorLigado ? ` e ${cards(p.arquivarVendedor)} de perdido marcado pelo vendedor` : ""} {p.arquivarAutomatico + (dados.arquivar.vendedorLigado ? p.arquivarVendedor : 0) === 1 ? "vai" : "vão"} para o arquivo na hora.
        </Previa>
      </Cartao>
    </>
  );
}
