// Presença dos vendedores e fila da loja fechada (tarefa 35). Só regra, sem banco.
// O horário de funcionamento vem da agenda (regras/agenda.ts): não existe um segundo cadastro de horário.
import { type RegrasAgenda, REGRAS_AGENDA_PADRAO } from "./agenda";
import { DIA, dataLocal, inicioDoDiaLocal, partesLocais } from "./tempo";

const MINUTO = 60 * 1000;

export type QuemRecebeAusencia = "admin" | "todos";

export interface RegrasPresenca {
  /** No fechamento da loja todos os vendedores ficam offline (e lead novo fora do horário vai para a fila). */
  desligarNoFechamento: boolean;
  /** Reparte a fila acumulada alguns minutos depois da abertura. Desligado = a fila vai para quem ficar online primeiro. */
  repartirFila: boolean;
  repartirMin: number;
  /** Avisa quando quem tem compromisso ou retorno hoje não ficou online. */
  verificarPresenca: boolean;
  verificarMin: number;
  /** Aviso de compromisso cedo (antes da verificação): minutos antes do horário. */
  avisoCedoMin: number;
  quemRecebe: QuemRecebeAusencia;
}

/** Padrões decididos com o Mateus em 06/11/2026. */
export const REGRAS_PRESENCA_PADRAO: RegrasPresenca = {
  desligarNoFechamento: true,
  repartirFila: true,
  repartirMin: 15,
  verificarPresenca: true,
  verificarMin: 30,
  avisoCedoMin: 15,
  quemRecebe: "todos",
};

/** Tudo desligado: o comportamento de antes da tarefa 35 (usado nos testes de outras áreas). */
export const REGRAS_PRESENCA_DESLIGADA: RegrasPresenca = { ...REGRAS_PRESENCA_PADRAO, desligarNoFechamento: false, repartirFila: false, verificarPresenca: false };

export function completarRegrasPresenca(r: Partial<RegrasPresenca>): RegrasPresenca {
  return { ...REGRAS_PRESENCA_PADRAO, ...r };
}

/** Devolve a mensagem do primeiro problema, ou null se as regras são válidas. */
export function validarRegrasPresenca(r: RegrasPresenca): string | null {
  const minutos = (v: number, nome: string) => (!Number.isInteger(v) || v < 0 || v > 240 ? `${nome}: de 0 a 240 minutos.` : null);
  if (r.quemRecebe !== "admin" && r.quemRecebe !== "todos") return "Escolha quem recebe o aviso de ausência.";
  if (typeof r.desligarNoFechamento !== "boolean" || typeof r.repartirFila !== "boolean" || typeof r.verificarPresenca !== "boolean") return "Opção inválida.";
  return minutos(r.repartirMin, "Quando repartir") ?? minutos(r.verificarMin, "Quando verificar") ?? minutos(r.avisoCedoMin, "Aviso de compromisso cedo");
}

/** Abertura e fechamento do dia local de `instante`, ou null se a loja não abre nesse dia. */
export function expedienteDoDia(instante: Date, agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): { abre: Date; fecha: Date } | null {
  const p = partesLocais(instante);
  const h = agenda.horario[p.diaSemana];
  if (!h) return null;
  return { abre: dataLocal(p.ano, p.mes, p.dia, h.abre), fecha: dataLocal(p.ano, p.mes, p.dia, h.fecha) };
}

export function lojaAberta(instante: Date, agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): boolean {
  const e = expedienteDoDia(instante, agenda);
  return !!e && instante.getTime() >= e.abre.getTime() && instante.getTime() < e.fecha.getTime();
}

/** O instante do último fechamento da loja até `instante` (inclusive). Serve de identificador do período fechado. */
export function ultimoFechamento(instante: Date, agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): Date | null {
  let dia = inicioDoDiaLocal(instante);
  for (let i = 0; i < 8; i++, dia = new Date(dia.getTime() - DIA)) {
    const e = expedienteDoDia(new Date(dia.getTime() + 12 * 60 * MINUTO), agenda);
    if (e && e.fecha.getTime() <= instante.getTime()) return e.fecha;
  }
  return null;
}

/** Abertura do expediente em andamento (a de hoje, se a loja já abriu e ainda não fechou). Null com a loja fechada. */
export function aberturaAtual(instante: Date, agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): Date | null {
  return lojaAberta(instante, agenda) ? (expedienteDoDia(instante, agenda) as { abre: Date }).abre : null;
}

export const horarioDeRepartir = (abertura: Date, r: RegrasPresenca) => new Date(abertura.getTime() + r.repartirMin * MINUTO);
export const horarioDeVerificar = (abertura: Date, r: RegrasPresenca) => new Date(abertura.getTime() + r.verificarMin * MINUTO);

/**
 * A fila acumulada já pode ser entregue a quem fica online?
 * - Desligar no fechamento ligado e loja fechada: não (lead fora do horário fica na fila).
 * - "Repartir" ligado: só depois do horário de repartir do expediente.
 */
export function filaPodeSerEntregue(instante: Date, r: RegrasPresenca, agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): boolean {
  if (r.desligarNoFechamento && !lojaAberta(instante, agenda)) return false;
  if (!r.repartirFila) return true;
  const abertura = aberturaAtual(instante, agenda);
  return !!abertura && instante.getTime() >= horarioDeRepartir(abertura, r).getTime();
}

/** Um lead novo pode ganhar dono agora? Fora do horário não (fica na fila); no começo do expediente sim. */
export function leadNovoPodeTerDono(instante: Date, r: RegrasPresenca, agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): boolean {
  return !r.desligarNoFechamento || lojaAberta(instante, agenda);
}

export interface ItemDoDia {
  tipo: "visita" | "medicao" | "apresentacao" | "retorno";
  inicio: Date;
}

const ROTULO: Record<ItemDoDia["tipo"], string> = { visita: "visita", medicao: "medição", apresentacao: "apresentação", retorno: "retorno" };

/** "visita 9h, medição 14h, 2 retornos" (compromissos por horário; retornos juntos no fim). */
export function resumirItensDoDia(itens: ItemDoDia[]): string {
  const hora = (d: Date) => {
    const p = partesLocais(d);
    return p.minuto ? `${p.hora}h${String(p.minuto).padStart(2, "0")}` : `${p.hora}h`;
  };
  const compromissos = itens.filter((i) => i.tipo !== "retorno").sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const retornos = itens.filter((i) => i.tipo === "retorno").length;
  const partes = compromissos.map((c) => `${ROTULO[c.tipo]} ${hora(c.inicio)}`);
  if (retornos) partes.push(`${retornos} ${retornos === 1 ? "retorno" : "retornos"}`);
  return partes.join(", ");
}

/** Próxima abertura da loja depois de `instante` (hoje, se ainda não abriu; senão o próximo dia aberto). */
export function proximaAbertura(instante: Date, agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): Date {
  let dia = inicioDoDiaLocal(instante);
  for (let i = 0; i < 9; i++, dia = new Date(dia.getTime() + DIA)) {
    const e = expedienteDoDia(new Date(dia.getTime() + 12 * 60 * MINUTO), agenda);
    if (e && e.abre.getTime() > instante.getTime()) return e.abre;
  }
  return instante;
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Data e hora de Fortaleza no formato do prompt do bot: "sábado 07/11 15:20". */
function dataHoraCurta(d: Date): string {
  const p = partesLocais(d);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${DIAS_SEMANA[p.diaSemana]} ${dois(p.dia)}/${dois(p.mes)} ${dois(p.hora)}:${dois(p.minuto)}`;
}

/** Frase que o bot lê (tarefa 36): "agora: sábado 07/11 15:20; loja fechada; reabre segunda 09/11 08:00". */
export function situacaoDaLoja(instante: Date, agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): string {
  const agora = `agora: ${dataHoraCurta(instante)}`;
  if (lojaAberta(instante, agenda)) {
    const e = expedienteDoDia(instante, agenda) as { fecha: Date };
    return `${agora}; loja aberta; fecha hoje às ${dataHoraCurta(e.fecha).slice(-5)}`;
  }
  return `${agora}; loja fechada; reabre ${dataHoraCurta(proximaAbertura(instante, agenda))}`;
}

/** Horário de funcionamento em frase, para o bot dizer ao cliente: "segunda a sexta das 8h às 18h; sábado das 8h às 12h". */
export function descreverHorarioDeFuncionamento(agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): string {
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  const grupos: { dias: number[]; faixa: string }[] = [];
  for (const dia of ordem) {
    const h = agenda.horario[dia];
    if (!h) continue;
    const faixa = `das ${h.abre}h às ${h.fecha}h`;
    const ultimo = grupos[grupos.length - 1];
    const anterior = ultimo ? ultimo.dias[ultimo.dias.length - 1] : null;
    if (ultimo && ultimo.faixa === faixa && anterior !== null && ordem.indexOf(dia) === ordem.indexOf(anterior) + 1) ultimo.dias.push(dia);
    else grupos.push({ dias: [dia], faixa });
  }
  const nome = (d: number) => DIAS_SEMANA[d];
  return grupos.map((g) => `${g.dias.length > 1 ? `${nome(g.dias[0])} a ${nome(g.dias[g.dias.length - 1])}` : nome(g.dias[0])} ${g.faixa}`).join("; ");
}
