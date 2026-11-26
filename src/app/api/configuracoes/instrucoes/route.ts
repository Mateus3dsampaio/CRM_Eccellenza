import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { atendimentoDaIaLigado, definirAtendimentoDaIa } from "@/servicos/configuracoes";
import { criarInstrucao, listarInstrucoes, obterManual, situacaoDoManualNoBanco } from "@/servicos/instrucoes";

export const dynamic = "force-dynamic";

const corpo = z.object({
  titulo: z.string().trim().min(1, "Dê um título à instrução.").max(120),
  texto: z.string().trim().min(1, "Escreva o texto da instrução.").max(20000),
});

// Instruções de atendimento do bot (só admin): as numeradas e o Manual do CRM (fixo, editado pela rota [id]).
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  return { instrucoes: await listarInstrucoes(), manual: await obterManual(), manualSituacao: await situacaoDoManualNoBanco(), iaLigada: await atendimentoDaIaLigado() };
});

// Liga ou desliga o atendimento da IA para todos os clientes (desligada: toda mensagem nova vai ao consultor).
export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const { ligada } = z.object({ ligada: z.boolean() }).parse(await req.json());
  await definirAtendimentoDaIa(ligada);
  return { ok: true };
});

export const POST = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  return { instrucao: await criarInstrucao(corpo.parse(await req.json())) };
});
