// Limite de tentativas de login (tarefa 12): 5 erros em 15 minutos bloqueiam aquele usuário+origem por 15 minutos.
// Guardado na memória do servidor: serve para uma instância só (o caso do Railway com 1 réplica).
export const MAX_TENTATIVAS = 5;
export const JANELA_BLOQUEIO_MS = 15 * 60_000;

export class LimiteDeTentativas {
  private erros = new Map<string, number[]>();
  constructor(private readonly max = MAX_TENTATIVAS) {}

  private recentes(chave: string, agora: number): number[] {
    const lista = (this.erros.get(chave) ?? []).filter((t) => agora - t < JANELA_BLOQUEIO_MS);
    if (lista.length) this.erros.set(chave, lista);
    else this.erros.delete(chave);
    return lista;
  }

  /** Minutos que faltam para poder tentar de novo, ou 0 se pode tentar. */
  bloqueadoPorMin(chave: string, agora = Date.now()): number {
    const lista = this.recentes(chave, agora);
    if (lista.length < this.max) return 0;
    return Math.max(1, Math.ceil((lista[0] + JANELA_BLOQUEIO_MS - agora) / 60_000));
  }

  registrarErro(chave: string, agora = Date.now()) {
    this.erros.set(chave, [...this.recentes(chave, agora), agora]);
    // Não deixa o mapa crescer sem limite.
    if (this.erros.size > 5000) this.erros.delete(this.erros.keys().next().value as string);
  }

  limpar(chave: string) {
    this.erros.delete(chave);
  }
}
