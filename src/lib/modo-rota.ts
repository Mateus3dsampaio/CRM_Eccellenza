import { modoSimulador } from "./modo";
import { ErroHttp } from "./sessao";

/** Rotas de simulação não existem em produção: respondem 404, como se não estivessem lá. */
export function exigirModoSimulador(): void {
  if (!modoSimulador()) throw new ErroHttp(404, "Não encontrado.");
}
