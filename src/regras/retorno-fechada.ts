// Retorno do lead que chega com a loja fechada (tarefa 36). Só regra, sem banco.
import { type RegrasAgenda, REGRAS_AGENDA_PADRAO } from "./agenda";
import { buscarModelo } from "./modelos";
import { lojaAberta, proximaAbertura } from "./presenca";

const MINUTO = 60 * 1000;

export interface RegrasRetorno {
  /** Enviar o modelo de retorno sozinho no horário do retorno. Desligado: o vendedor recebe o aviso e clica para enviar. */
  automatico: boolean;
  /** Código do modelo (regras/modelos.ts). */
  modelo: string;
  /** Sem horário escolhido pelo cliente: minutos depois da abertura (depois da repartição e da verificação da tarefa 35). */
  semHorarioMin: number;
}

/** Padrões decididos com o Mateus em 06/11/2026. */
export const REGRAS_RETORNO_PADRAO: RegrasRetorno = { automatico: true, modelo: "retorno_atendimento", semHorarioMin: 30 };

export function completarRegrasRetorno(r: Partial<RegrasRetorno>): RegrasRetorno {
  return { ...REGRAS_RETORNO_PADRAO, ...r };
}

export function validarRegrasRetorno(r: RegrasRetorno): string | null {
  if (typeof r.automatico !== "boolean") return "Opção inválida.";
  const modelo = buscarModelo(r.modelo);
  if (!modelo) return "Escolha um dos modelos cadastrados.";
  if (modelo.compromisso) return "Lembrete de compromisso não serve para o retorno automático.";
  if (!Number.isInteger(r.semHorarioMin) || r.semHorarioMin < 0 || r.semHorarioMin > 240) return "Minutos depois da abertura: de 0 a 240.";
  return null;
}

/**
 * Quando o vendedor deve retornar. O horário pedido só vale se estiver no futuro e com a loja aberta; senão usa a
 * abertura seguinte mais X minutos (`usouPadrao` = true, e o bot só guarda a nota do que o cliente disse).
 */
export function horarioDoRetorno(pedido: Date | null, agora: Date, regras: RegrasRetorno, agenda: RegrasAgenda = REGRAS_AGENDA_PADRAO): { quando: Date; usouPadrao: boolean } {
  if (pedido && !Number.isNaN(pedido.getTime()) && pedido.getTime() > agora.getTime() && lojaAberta(pedido, agenda)) return { quando: pedido, usouPadrao: false };
  const base = pedido && pedido.getTime() > agora.getTime() ? pedido : agora;
  return { quando: new Date(proximaAbertura(base, agenda).getTime() + regras.semHorarioMin * MINUTO), usouPadrao: true };
}
