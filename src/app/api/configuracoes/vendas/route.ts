import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { criarMotivo, definirExigirContatoNegociacao, editarMotivo, excluirMotivo, reordenarMotivos } from "@/servicos/vendas";

// Configurações de vendas (só admin): interruptor do próximo contato e motivos de perda.
const esquema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("exigir_contato_negociacao"), exigir: z.boolean() }),
  z.object({ acao: z.literal("criar_motivo"), nome: z.string(), pergunta: z.string().nullable().optional(), naoELead: z.boolean().optional() }),
  z.object({ acao: z.literal("editar_motivo"), codigo: z.string().max(60), nome: z.string().optional(), pergunta: z.string().nullable().optional(), ativo: z.boolean().optional(), naoELead: z.boolean().optional() }),
  z.object({ acao: z.literal("reordenar_motivos"), codigos: z.array(z.string().max(60)).max(100) }),
  z.object({ acao: z.literal("excluir_motivo"), codigo: z.string().max(60) }),
]);

export const POST = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const corpo = esquema.parse(await req.json());
  switch (corpo.acao) {
    case "exigir_contato_negociacao":
      await definirExigirContatoNegociacao(corpo.exigir);
      break;
    case "criar_motivo":
      await criarMotivo(corpo);
      break;
    case "editar_motivo":
      await editarMotivo(corpo.codigo, corpo);
      break;
    case "reordenar_motivos":
      await reordenarMotivos(corpo.codigos);
      break;
    case "excluir_motivo":
      await excluirMotivo(corpo.codigo);
      break;
  }
  return { ok: true };
});
