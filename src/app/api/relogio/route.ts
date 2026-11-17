import { z } from "zod";
import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { agora, avancarRelogio, deslocamentoMs } from "@/lib/relogio";
import { exigirUsuario } from "@/lib/sessao";
import { exigirModoSimulador } from "@/lib/modo-rota";
import { marcarMudanca } from "@/lib/versao";
import { HORA, formatarDataHora } from "@/regras/tempo";
import { registrarAvanco, rodarRotinas } from "@/servicos/rotinas";

export const dynamic = "force-dynamic";

// Relógio simulado (RET-04).
export const GET = rota(async () => {
  exigirModoSimulador();
  await exigirUsuario();
  const registros = await db.registroRotina.findMany({ orderBy: { criadoEm: "desc" }, take: 30 });
  return {
    agora: (await agora()).toISOString(),
    deslocamentoHoras: Math.round((await deslocamentoMs()) / HORA),
    registros: registros.map((r) => ({ id: r.id, texto: r.texto })),
  };
});

// O relógio só anda para a frente (voltar o tempo bagunçaria janelas de 24h e as rotinas).
// Horas, ou minutos (de 5 em 5 a 59) para testar o horário de repartir a fila e de verificar a presença.
const esquema = z.union([z.object({ horas: z.number().int().min(1).max(24 * 60) }), z.object({ minutos: z.number().int().min(5).max(59) })]);

export const POST = rota(async (req: Request) => {
  exigirModoSimulador();
  await exigirUsuario();
  const corpo = esquema.parse(await req.json());
  const ms = "minutos" in corpo ? corpo.minutos * 60_000 : corpo.horas * HORA;
  const novo = await avancarRelogio(ms);
  const texto = "minutos" in corpo ? `${corpo.minutos} minuto(s)` : corpo.horas % 24 === 0 ? `${corpo.horas / 24} dia(s)` : `${corpo.horas} hora(s)`;
  await registrarAvanco(`Relógio avançado ${texto}: agora é ${formatarDataHora(novo)}.`);
  const resultado = await rodarRotinas();
  await marcarMudanca();
  return { ok: true, agora: (await agora()).toISOString(), resultado };
});
