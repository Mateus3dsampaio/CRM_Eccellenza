import { z } from "zod";
import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { agora, avancarRelogio, deslocamentoMs } from "@/lib/relogio";
import { exigirUsuario } from "@/lib/sessao";
import { marcarMudanca } from "@/lib/versao";
import { HORA, formatarDataHora } from "@/regras/tempo";
import { registrarAvanco, rodarRotinas } from "@/servicos/rotinas";

export const dynamic = "force-dynamic";

// Relógio simulado (RET-04).
export const GET = rota(async () => {
  await exigirUsuario();
  const registros = await db.registroRotina.findMany({ orderBy: { criadoEm: "desc" }, take: 30 });
  return {
    agora: (await agora()).toISOString(),
    deslocamentoHoras: Math.round((await deslocamentoMs()) / HORA),
    registros: registros.map((r) => ({ id: r.id, texto: r.texto })),
  };
});

// O relógio só anda para a frente (voltar o tempo bagunçaria janelas de 24h e retomadas).
const esquema = z.object({ horas: z.number().int().min(1).max(24 * 60) });

export const POST = rota(async (req: Request) => {
  await exigirUsuario();
  const { horas } = esquema.parse(await req.json());
  const novo = await avancarRelogio(horas * HORA);
  const texto = horas % 24 === 0 ? `${horas / 24} dia(s)` : `${horas} hora(s)`;
  await registrarAvanco(`Relógio avançado ${texto}: agora é ${formatarDataHora(novo)}.`);
  const resultado = await rodarRotinas();
  await marcarMudanca();
  return { ok: true, agora: (await agora()).toISOString(), resultado };
});
