import { z } from "zod";
import { rota } from "@/lib/api";
import { agora } from "@/lib/relogio";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { HORA, dataLocal, inicioDaSemanaLocal, inicioDoDiaLocal, lerChaveDia, somarDias } from "@/regras/tempo";
import { agendarVisita, cancelarVisita, criarBloqueio, ErroAgenda, horariosLivresParaLead, removerBloqueio } from "@/servicos/agenda";
import { dadosDaAgenda } from "@/servicos/consultas";

export const dynamic = "force-dynamic";

// GET ?visao=dia|semana&data=AAAA-MM-DD (AGENDA-01)
export const GET = rota(async (req: Request) => {
  await exigirUsuario();
  const params = new URL(req.url).searchParams;
  const visao = params.get("visao") === "dia" ? "dia" : "semana";
  const base = lerChaveDia(params.get("data") ?? "") ?? (await agora());
  const de = visao === "dia" ? inicioDoDiaLocal(base) : inicioDaSemanaLocal(base);
  const ate = somarDias(de, visao === "dia" ? 1 : 7);
  const livresPara = params.get("livresPara");
  return {
    visao,
    de: de.toISOString(),
    ate: ate.toISOString(),
    agora: (await agora()).toISOString(),
    ...(await dadosDaAgenda(de, ate)),
    livres: livresPara ? (await horariosLivresParaLead(livresPara, 30)).map((v) => ({ inicio: v.inicio.toISOString(), consultorId: v.consultorId })) : undefined,
  };
});

const dataHora = z.object({ dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hora: z.number().int().min(0).max(23) });
function paraData({ dia, hora }: z.infer<typeof dataHora>): Date {
  const [a, m, d] = dia.split("-").map(Number);
  return dataLocal(a, m, d, hora);
}

const esquema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("agendar"), leadId: z.string(), quando: dataHora, consultorId: z.string().optional() }),
  z.object({ acao: z.literal("cancelar"), visitaId: z.string() }),
  z.object({ acao: z.literal("bloquear"), consultorId: z.string(), quando: dataHora, horas: z.number().int().min(1).max(12), motivo: z.string().max(200).optional() }),
  z.object({ acao: z.literal("desbloquear"), bloqueioId: z.string() }),
]);

// Consultor cria bloqueios, agenda, remarca e cancela (AGENDA-03).
export const POST = rota(async (req: Request) => {
  const usuario = await exigirUsuario("gerir_agenda");
  const corpo = esquema.parse(await req.json());
  try {
    switch (corpo.acao) {
      case "agendar":
        await agendarVisita({ leadId: corpo.leadId, inicio: paraData(corpo.quando), consultorId: corpo.consultorId, autor: usuario.nome });
        break;
      case "cancelar":
        await cancelarVisita(corpo.visitaId, usuario.nome);
        break;
      case "bloquear": {
        const inicio = paraData(corpo.quando);
        await criarBloqueio({ consultorId: corpo.consultorId, inicio, fim: new Date(inicio.getTime() + corpo.horas * HORA), motivo: corpo.motivo, autor: usuario.nome });
        break;
      }
      case "desbloquear":
        await removerBloqueio(corpo.bloqueioId);
        break;
    }
  } catch (erro) {
    if (erro instanceof ErroAgenda) throw new ErroHttp(409, erro.message);
    throw erro;
  }
  return { ok: true };
});
