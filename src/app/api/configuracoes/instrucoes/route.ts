import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { criarInstrucao, listarInstrucoes } from "@/servicos/instrucoes";

export const dynamic = "force-dynamic";

const corpo = z.object({
  titulo: z.string().trim().min(1, "Dê um título à instrução.").max(120),
  texto: z.string().trim().min(1, "Escreva o texto da instrução.").max(20000),
});

// Instruções de atendimento do bot (só admin).
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  return { instrucoes: await listarInstrucoes() };
});

export const POST = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  return { instrucao: await criarInstrucao(corpo.parse(await req.json())) };
});
