import { z } from "zod";
import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { CODIGOS_ETAPA, ETAPAS_LIMPAVEIS, etiquetaValida } from "@/regras/etapas";
import { dadosDeVenda, esquemaDadosDeVenda } from "@/lib/esquema-venda";
import { bloquearContato } from "@/servicos/bloqueio";
import { alterarEtiqueta, arquivarLeads, conferirMudanca, moverEtapa } from "@/servicos/leads";
import { excluirComRegistro } from "@/servicos/lgpd";

const ids = z.array(z.string().min(1).max(40)).min(1).max(500);

const esquema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("mover"), ids, etapa: z.enum(CODIGOS_ETAPA as [string, ...string[]]), dados: esquemaDadosDeVenda.optional(), cancelarCompromissos: z.boolean().optional() }),
  z.object({ acao: z.literal("arquivar"), ids }),
  z.object({ acao: z.literal("excluir"), ids }),
  z.object({ acao: z.literal("bloquear"), ids }),
  z.object({ acao: z.literal("etiqueta"), ids, etiqueta: z.string(), ativa: z.boolean() }),
  z.object({ acao: z.literal("limpar_coluna"), etapa: z.enum(ETAPAS_LIMPAVEIS as [string, ...string[]]), modo: z.enum(["arquivar", "excluir"]) }),
]);

// Ações sobre um ou vários cards (KAN-03, LIMP-01, LIMP-02). Permissões checadas aqui no servidor (LIMP-05).
export const POST = rota(async (req: Request) => {
  const usuario = await exigirUsuario("editar_lead");
  const corpo = esquema.parse(await req.json());

  switch (corpo.acao) {
    case "mover":
      // Confere todos antes de mexer em qualquer um: lote com um card sem os dados não move metade.
      for (const id of corpo.ids) await conferirMudanca(id, corpo.etapa as never, dadosDeVenda(corpo.dados), corpo.cancelarCompromissos);
      for (const id of corpo.ids) await moverEtapa(id, corpo.etapa as never, usuario.nome, { dados: dadosDeVenda(corpo.dados), cancelarCompromissos: corpo.cancelarCompromissos });
      return { ok: true };
    case "arquivar":
      await exigirUsuario("arquivar_lead");
      return { ok: true, total: await arquivarLeads(corpo.ids, usuario.nome) };
    case "bloquear": {
      // Bloquear tira do quadro para o arquivo: mesma permissão de arquivar.
      await exigirUsuario("arquivar_lead");
      let total = 0;
      for (const id of corpo.ids) if (await bloquearContato(id, usuario.nome)) total++;
      return { ok: true, total };
    }
    case "excluir":
      await exigirUsuario("excluir_lead");
      return { ok: true, total: await excluirComRegistro(corpo.ids, usuario.nome) };
    case "etiqueta":
      if (!etiquetaValida(corpo.etiqueta)) throw new ErroHttp(400, "Etiqueta inválida.");
      for (const id of corpo.ids) await alterarEtiqueta(id, corpo.etiqueta, corpo.ativa, usuario.nome);
      return { ok: true };
    case "limpar_coluna": {
      await exigirUsuario(corpo.modo === "excluir" ? "excluir_lead" : "arquivar_lead");
      const alvo = await db.lead.findMany({ where: { etapa: corpo.etapa, arquivadoEm: null }, select: { id: true } });
      const lista = alvo.map((l) => l.id);
      const total = corpo.modo === "excluir" ? await excluirComRegistro(lista, usuario.nome) : await arquivarLeads(lista, usuario.nome);
      return { ok: true, total };
    }
  }
});
