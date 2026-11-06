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
