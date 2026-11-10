import { NOMES_COMPROMISSO, type TipoCompromisso } from "./agenda";
import { decisaoPendente, ETIQUETA_DECISAO, type TipoDecisao } from "./decisao";
import { faixaDeEspera, minutosEsperando, textoDeEspera, type PrazosEspera } from "./espera";
import { situacaoDaJanela } from "./janela24h";
import { DIA, formatarVisitaCurta, inicioDoDiaLocal, partesLocais } from "./tempo";
import { ETAPAS_COM_RETORNO, situacaoDoRetorno } from "./vendas";

/**
 * "Próximo passo" da gaveta e da ficha (09/11/2026): o que pede ação neste lead, do mais urgente ao menos.
 * A cor é só de urgência: vermelho = atrasado, vencido ou cliente esperando além do prazo; amarelo = hoje ou atenção;
 * neutro = no futuro. Só regra, sem banco.
 */
export type Urgencia = "vermelho" | "amarelo" | "neutro";
export type TipoItemPasso = "espera" | "janela" | "decisao" | "lembrete" | "compromisso";

export interface ItemPasso {
  /** Identidade estável do item na lista. */
  chave: string;
  tipo: TipoItemPasso;
  urgencia: Urgencia;
  /** Linha principal (ficha completa). */
  titulo: string;
  /** Linha de apoio: nota do lembrete, consultor do compromisso, quanto falta. */
  detalhe: string | null;
  /** Texto da pílula da gaveta. */
  curto: string;
  /** Compromisso: qual é, para remarcar e cancelar. */
  visitaId?: string;
  tipoCompromisso?: TipoCompromisso;
  /** Decisão pendente: qual janela de decisão abrir. */
  decisao?: { tipo: TipoDecisao; venceuEm: string };
}

export interface LeadDoPasso {
  etapa: string;
  arquivado?: boolean;
  esperandoDesde: string | null;
  ultimaMsgClienteEm: string | null;
  proximoContatoEm: string | null;
  lembreteNota: string | null;
  visitas: { id: string; tipo: string; status: string; inicio: string; consultor: string }[];
}

const ORDEM: Record<Urgencia, number> = { vermelho: 0, amarelo: 1, neutro: 2 };
const ETAPAS_ENCERRADAS = ["fechado", "perdido"];

function hora(d: Date): string {
  const p = partesLocais(d);
  return `${p.hora}h${p.minuto ? String(p.minuto).padStart(2, "0") : ""}`;
}

/** Dias de calendário (Fortaleza) entre hoje e a data: 0 = hoje, 1 = amanhã, -1 = ontem. */
export function diasAte(data: Date, agora: Date): number {
  return Math.round((inicioDoDiaLocal(data).getTime() - inicioDoDiaLocal(agora).getTime()) / DIA);
}

/** "hoje, 16h", "amanhã, 9h", "ontem, 15h" ou "sex 13/11 10h". */
export function quandoRelativo(data: Date, agora: Date): string {
  const dias = diasAte(data, agora);
  if (dias === 0) return `hoje, ${hora(data)}`;
  if (dias === 1) return `amanhã, ${hora(data)}`;
  if (dias === -1) return `ontem, ${hora(data)}`;
  return formatarVisitaCurta(data);
}

function faltam(data: Date, agora: Date): string | null {
  const dias = diasAte(data, agora);
  return dias > 1 ? `em ${dias} dias` : null;
}

const juntarDetalhe = (...partes: (string | null | undefined)[]) => partes.filter(Boolean).join(" · ") || null;

export function itensDoProximoPasso(lead: LeadDoPasso, agora: Date, prazos: PrazosEspera): ItemPasso[] {
  const itens: (ItemPasso & { ordem: number })[] = [];
  const encerrado = ETAPAS_ENCERRADAS.includes(lead.etapa) || !!lead.arquivado;
  const ativos = lead.visitas.filter((v) => v.status === "agendada");

  // 1. Cliente esperando um humano.
  if (lead.esperandoDesde) {
    const faixa = faixaDeEspera(lead.esperandoDesde, agora, prazos);
    const texto = textoDeEspera(minutosEsperando(lead.esperandoDesde, agora));
    itens.push({
      chave: "espera",
      tipo: "espera",
      urgencia: faixa === "normal" ? "neutro" : faixa,
      titulo: `Esperando resposta há ${texto}`,
      detalhe: null,
      curto: `Esperando há ${texto}`,
      ordem: new Date(lead.esperandoDesde).getTime(),
    });
  }

  // 2. Janela de 24h perto de fechar (só enquanto o lead está em andamento).
  if (!encerrado) {
    const janela = situacaoDaJanela(lead.ultimaMsgClienteEm, agora);
    if (janela.faixa === "vermelho" || janela.faixa === "amarelo") {
      itens.push({
        chave: "janela",
        tipo: "janela",
        urgencia: janela.faixa,
        titulo: `Janela de 24h fecha em ${janela.texto}`,
        detalhe: "Depois disso, só modelo aprovado. Só a resposta do cliente renova.",
        curto: `Janela fecha em ${janela.texto}`,
        ordem: agora.getTime() + janela.restanteMs,
      });
    }
  }

  // 3. Data vencida sem decisão (medição, apresentação ou retorno da Negociação): toma o lugar do item que venceu.
  const decisao = encerrado ? null : decisaoPendente(lead, ativos, agora);
  if (decisao) {
    itens.push({
      chave: "decisao",
      tipo: "decisao",
      urgencia: "vermelho",
      titulo: ETIQUETA_DECISAO[decisao.tipo],
      detalhe: `Venceu ${quandoRelativo(decisao.venceuEm, agora)}`,
      curto: "Decisão pendente",
      decisao: { tipo: decisao.tipo, venceuEm: decisao.venceuEm.toISOString() },
      ordem: decisao.venceuEm.getTime(),
    });
  }

  // 4. Lembrete (em Negociação é o próximo contato).
  if (lead.proximoContatoEm && (ETAPAS_COM_RETORNO as string[]).includes(lead.etapa) && decisao?.tipo !== "negociacao") {
    const quando = new Date(lead.proximoContatoEm);
    const situacao = situacaoDoRetorno(quando, agora);
    const nome = lead.etapa === "negociacao" ? "Próximo contato" : "Lembrete";
    const atrasado = situacao === "atrasado";
    itens.push({
      chave: "lembrete",
      tipo: "lembrete",
      urgencia: atrasado ? "vermelho" : situacao === "hoje" ? "amarelo" : "neutro",
      titulo: atrasado ? `${nome} atrasado · era ${quandoRelativo(quando, agora)}` : `${nome} ${quandoRelativo(quando, agora)}`,
      detalhe: juntarDetalhe(atrasado ? null : faltam(quando, agora), lead.lembreteNota),
      curto: atrasado ? `${nome} atrasado` : `${nome} ${quandoRelativo(quando, agora).replace(",", "")}`,
      ordem: quando.getTime(),
    });
  }

  // 5. Compromissos marcados na agenda.
  for (const v of ativos) {
    if (decisao && decisao.tipo === v.tipo) continue;
    const quando = new Date(v.inicio);
    const dias = diasAte(quando, agora);
    const nome = NOMES_COMPROMISSO[v.tipo as TipoCompromisso] ?? "Compromisso";
    itens.push({
      chave: `compromisso-${v.id}`,
      tipo: "compromisso",
      urgencia: dias === 0 ? "amarelo" : "neutro",
      titulo: dias < 0 ? `${nome} foi ${quandoRelativo(quando, agora)}` : `${nome} ${quandoRelativo(quando, agora)}`,
      detalhe: juntarDetalhe(faltam(quando, agora), `com ${v.consultor}`),
      curto: `${nome} ${quandoRelativo(quando, agora).replace(",", "")}`,
      visitaId: v.id,
      tipoCompromisso: v.tipo as TipoCompromisso,
      ordem: quando.getTime(),
    });
  }

  return itens.sort((a, b) => ORDEM[a.urgencia] - ORDEM[b.urgencia] || a.ordem - b.ordem).map((completo) => {
    const { ordem, ...item } = completo;
    void ordem;
    return item;
  });
}
