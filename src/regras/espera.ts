const MINUTO = 60_000;

// Espera do cliente por um humano (Bloco 1, tarefa 1): faixa de cor, prazos e ordem das colunas do kanban.

/** PROVISÓRIO: o Mateus ainda vai decidir os prazos. O admin ajusta em Configurações. */
export const PRAZOS_ESPERA_PADRAO = { amarelo: 10, vermelho: 30 }; // minutos
export const LIMITE_PRAZO_MINUTOS = 24 * 60;

export interface PrazosEspera {
  amarelo: number;
  vermelho: number;
}

export type FaixaEspera = "normal" | "amarelo" | "vermelho";

type Instante = Date | string | null | undefined;

function emMs(valor: Instante): number | null {
  if (!valor) return null;
  const ms = (valor instanceof Date ? valor : new Date(valor)).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Desde quando o cliente espera um humano. Lead antigo, de antes do campo existir: conta do repasse (ou da última mensagem do cliente). */
export function esperaDoLead(l: { aguardandoHumano: boolean; esperandoDesde: Date | null; repassadoEm: Date | null; ultimaMsgClienteEm: Date | null }): Date | null {
  return l.esperandoDesde ?? (l.aguardandoHumano ? (l.repassadoEm ?? l.ultimaMsgClienteEm) : null);
}

/** Devolve o motivo do erro, ou null se os prazos servem: inteiros, de 1 minuto a 24 h, amarelo menor que vermelho. */
export function validarPrazos(amarelo: unknown, vermelho: unknown): string | null {
  const inteiro = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
  if (!inteiro(amarelo) || !inteiro(vermelho)) return "Digite os prazos em minutos, só com números inteiros.";
  if (amarelo < 1 || vermelho < 1 || amarelo > LIMITE_PRAZO_MINUTOS || vermelho > LIMITE_PRAZO_MINUTOS) return "Os prazos vão de 1 minuto a 24 horas (1440 minutos).";
  if (amarelo >= vermelho) return "O prazo amarelo precisa ser menor que o vermelho.";
  return null;
}

/** Quanto o cliente espera, em minutos inteiros (0 se não espera). */
export function minutosEsperando(esperandoDesde: Instante, agora: Date): number {
  const desde = emMs(esperandoDesde);
  return desde === null ? 0 : Math.max(0, Math.floor((agora.getTime() - desde) / MINUTO));
}

/** Cor do card: normal até o prazo amarelo, amarelo até o vermelho, vermelho depois. */
export function faixaDeEspera(esperandoDesde: Instante, agora: Date, prazos: PrazosEspera): FaixaEspera {
  if (emMs(esperandoDesde) === null) return "normal";
  const minutos = minutosEsperando(esperandoDesde, agora);
  if (minutos >= prazos.vermelho) return "vermelho";
  if (minutos >= prazos.amarelo) return "amarelo";
  return "normal";
}

/** "12 min", "1 h 05 min", "2 h", "1 d 2 h". Para o "esperando há ..." do card. */
export function textoDeEspera(minutos: number): string {
  if (minutos < 1) return "menos de 1 min";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas >= 24) {
    const dias = Math.floor(horas / 24);
    return horas % 24 ? `${dias} d ${horas % 24} h` : `${dias} d`;
  }
  const resto = minutos % 60;
  return resto ? `${horas} h ${String(resto).padStart(2, "0")} min` : `${horas} h`;
}

interface ComEspera {
  id: string;
  esperandoDesde: Instante;
  ultimaMensagemEm: Instante;
}

/**
 * Ordem das colunas: primeiro quem espera resposta (quem espera há mais tempo no topo),
 * depois o resto pela última mensagem (a mais recente no topo). Sem mensagem vai para o fim.
 */
export function compararParaColuna(a: ComEspera, b: ComEspera): number {
  const esperaA = emMs(a.esperandoDesde);
  const esperaB = emMs(b.esperandoDesde);
  if (esperaA !== null && esperaB !== null && esperaA !== esperaB) return esperaA - esperaB;
  if (esperaA !== null && esperaB === null) return -1;
  if (esperaA === null && esperaB !== null) return 1;
  const msgA = emMs(a.ultimaMensagemEm) ?? -Infinity;
  const msgB = emMs(b.ultimaMensagemEm) ?? -Infinity;
  if (msgA !== msgB) return msgB > msgA ? 1 : -1;
  return a.id.localeCompare(b.id);
}

export function ordenarParaColuna<T extends ComEspera>(cards: T[]): T[] {
  return [...cards].sort(compararParaColuna);
}
