import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ErroHttp } from "./sessao";

/** Envolve uma rota de API: converte erros em respostas JSON em português, sem vazar detalhes internos. */
export function rota<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const resultado = await fn(...args);
      if (resultado instanceof Response) return resultado;
      return NextResponse.json(resultado ?? { ok: true });
    } catch (erro) {
      if (erro instanceof ErroHttp) return NextResponse.json({ erro: erro.message }, { status: erro.status });
      if (erro instanceof ZodError) {
        return NextResponse.json({ erro: "Dados inválidos.", detalhes: erro.issues.map((i) => i.message) }, { status: 400 });
      }
      console.error("[api] erro inesperado:", erro instanceof Error ? erro.message : "desconhecido");
      return NextResponse.json({ erro: "Algo deu errado. Tente de novo." }, { status: 500 });
    }
  };
}

export function naoEncontrado(): never {
  throw new ErroHttp(404, "Não encontrado.");
}
