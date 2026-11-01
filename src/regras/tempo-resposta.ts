// Tempo de resposta da loja ao cliente. Usado pelo Painel e pela exportação de desempenho.
export interface MensagemSimples {
  autor: string; // cliente | bot | consultor | sistema
  enviadaEm: Date;
}

export interface TurnoCliente {
  inicio: Date;
  /** Quem respondeu primeiro depois do cliente; vazio se ninguém respondeu. */
  respondidoPor: "bot" | "consultor" | null;
  respondeuEm: Date | null;
  segundos: number | null;
}

/**
 * Um turno começa quando o cliente escreve depois de a loja (ou ninguém) ter falado; vários recados seguidos do cliente
 * são um turno só. A resposta é a primeira mensagem do bot ou do consultor depois disso (mensagens do sistema não contam).
 * Só entram os turnos que começam dentro do período. As mensagens devem estar em ordem de horário.
 */
export function turnosDoCliente(mensagens: MensagemSimples[], inicio: Date, fim: Date): TurnoCliente[] {
  const turnos: TurnoCliente[] = [];
  for (let i = 0; i < mensagens.length; i++) {
    const m = mensagens[i];
    if (m.autor !== "cliente" || (i > 0 && mensagens[i - 1].autor === "cliente")) continue;
    if (m.enviadaEm < inicio || m.enviadaEm >= fim) continue;
    const resposta = mensagens.slice(i + 1).find((x) => x.autor === "bot" || x.autor === "consultor");
    turnos.push({
      inicio: m.enviadaEm,
      respondidoPor: resposta ? (resposta.autor as "bot" | "consultor") : null,
      respondeuEm: resposta?.enviadaEm ?? null,
      segundos: resposta ? Math.max(0, Math.round((resposta.enviadaEm.getTime() - m.enviadaEm.getTime()) / 1000)) : null,
    });
  }
  return turnos;
}

export interface RespostaConsultor {
  clienteEm: Date;
  consultorEm: Date;
  segundos: number;
}

/**
 * Tempo do consultor, em toda resposta dele (não só na primeira). A espera do cliente começa na primeira mensagem dele
 * depois da última mensagem do bot ou do consultor (mensagens do sistema não contam) e termina na mensagem do consultor.
 * Se o bot respondeu no meio, a espera recomeça. Contato iniciado pelo consultor e mensagens seguidas dele não entram.
 * Vale a data da mensagem do consultor. As mensagens devem estar em ordem de horário.
 */
export function temposDoConsultor(mensagens: MensagemSimples[], inicio: Date, fim: Date): RespostaConsultor[] {
  const respostas: RespostaConsultor[] = [];
  let esperaDesde: Date | null = null;
  for (const m of mensagens) {
    if (m.autor === "cliente") esperaDesde ??= m.enviadaEm;
    else if (m.autor === "bot") esperaDesde = null;
    else if (m.autor === "consultor") {
      if (esperaDesde && m.enviadaEm >= inicio && m.enviadaEm < fim) {
        respostas.push({ clienteEm: esperaDesde, consultorEm: m.enviadaEm, segundos: Math.max(0, Math.round((m.enviadaEm.getTime() - esperaDesde.getTime()) / 1000)) });
      }
      esperaDesde = null;
    }
  }
  return respostas;
}

export interface PrimeiraResposta {
  consultorEm: Date;
  segundos: number;
}

/** Da hora em que o bot passou o lead até a primeira mensagem do consultor depois disso; vazio se ele ainda não respondeu. */
export function primeiraRespostaDoConsultor(repassadoEm: Date, mensagens: MensagemSimples[]): PrimeiraResposta | null {
  const resposta = mensagens.find((m) => m.autor === "consultor" && m.enviadaEm >= repassadoEm);
  return resposta ? { consultorEm: resposta.enviadaEm, segundos: Math.max(0, Math.round((resposta.enviadaEm.getTime() - repassadoEm.getTime()) / 1000)) } : null;
}

export interface EstatisticaTempo {
  quantidade: number;
  mediaSegundos: number | null;
  medianaSegundos: number | null;
  maximoSegundos: number | null;
}

export function estatisticaDeTempos(segundos: number[]): EstatisticaTempo {
  if (!segundos.length) return { quantidade: 0, mediaSegundos: null, medianaSegundos: null, maximoSegundos: null };
  const ordenado = [...segundos].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  const mediana = ordenado.length % 2 ? ordenado[meio] : Math.round((ordenado[meio - 1] + ordenado[meio]) / 2);
  return {
    quantidade: ordenado.length,
    mediaSegundos: Math.round(ordenado.reduce((s, n) => s + n, 0) / ordenado.length),
    medianaSegundos: mediana,
    maximoSegundos: ordenado[ordenado.length - 1],
  };
}

/** Ex.: 45 s, 12 min, 1 h 05 min, 2 d 3 h. Sem dado: "–". */
export function formatarDuracao(segundos: number | null): string {
  if (segundos === null) return "–";
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h ${String(minutos % 60).padStart(2, "0")} min`;
  return `${Math.floor(horas / 24)} d ${horas % 24} h`;
}
