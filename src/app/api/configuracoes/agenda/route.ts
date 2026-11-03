import { z } from "zod";
import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { definirRegrasDaAgenda } from "@/servicos/configuracoes";

const faixa = z.object({ abre: z.number(), fecha: z.number() }).nullable();

// Só o admin define as regras da agenda: horário da loja por dia, duração da visita, visitas por horário e dias à frente.
export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const regras = z
    .object({ horario: z.array(faixa).length(7), duracaoMin: z.number(), visitasPorHorario: z.number(), diasAFrente: z.number() })
    .parse(await req.json());
  try {
    await definirRegrasDaAgenda(regras);
  } catch (erro) {
    throw new ErroHttp(400, erro instanceof Error ? erro.message : "Regras inválidas.");
  }
  return { ok: true };
});
