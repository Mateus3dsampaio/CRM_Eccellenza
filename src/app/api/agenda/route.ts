import { z } from "zod";
import { rota } from "@/lib/api";
import { agora } from "@/lib/relogio";
import { db } from "@/lib/db";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { TIPOS_COMPROMISSO, type TipoCompromisso } from "@/regras/agenda";
import { podeEditarAgendaDe } from "@/regras/permissoes";
import { HORA, chaveDia, dataLocal, inicioDaSemanaLocal, inicioDoDiaLocal, lerChaveDia, somarDias } from "@/regras/tempo";
import { agendarVisita, cancelarVisita, criarBloqueio, ErroAgenda, horariosLivresEmTorno, removerBloqueio } from "@/servicos/agenda";
import { regrasDaAgenda } from "@/servicos/configuracoes";
import { exigirPreparoDaApresentacao, preparoDaApresentacao } from "@/servicos/apresentacoes";
import { dadosDaAgenda } from "@/servicos/consultas";

export const dynamic = "force-dynamic";

// GET ?visao=dia|semana&data=AAAA-MM-DD (AGENDA-01). Com livresPara=<lead>&tipo=visita|medicao|apresentacao[&diaLivre=AAAA-MM-DD]:
// horários livres do compromisso no dia escolhido, na véspera e no dia seguinte (sem diaLivre, em torno do primeiro dia livre).
export const GET = rota(async (req: Request) => {
  await exigirUsuario();
  const params = new URL(req.url).searchParams;
  const visao = params.get("visao") === "dia" ? "dia" : "semana";
  const base = lerChaveDia(params.get("data") ?? "") ?? (await agora());
  const de = visao === "dia" ? inicioDoDiaLocal(base) : inicioDaSemanaLocal(base);
  const ate = somarDias(de, visao === "dia" ? 1 : 7);
  const livresPara = params.get("livresPara");
  const tipo = (TIPOS_COMPROMISSO as readonly string[]).includes(params.get("tipo") ?? "") ? (params.get("tipo") as TipoCompromisso) : "visita";
  return {
    visao,
    de: de.toISOString(),
    ate: ate.toISOString(),
    agora: (await agora()).toISOString(),
    regras: await regrasDaAgenda(),
    ...(await dadosDaAgenda(de, ate)),
    ...(livresPara ? await livresDoCalendario(livresPara, tipo, lerChaveDia(params.get("diaLivre") ?? "")) : {}),
  };
});

async function livresDoCalendario(leadId: string, tipo: TipoCompromisso, dia: Date | null) {
  const r = await horariosLivresEmTorno(leadId, tipo, dia);
  return {
    centroLivres: chaveDia(r.centro),
    primeiroDia: chaveDia(r.primeiroDia),
    livres: r.livres.map((v) => ({ inicio: v.inicio.toISOString(), consultorId: v.consultorId })),
    // Só vale para a apresentação: a tela avisa da medição pendente ou pergunta da estimativa antes de mostrar o calendário.
    ...(tipo === "apresentacao" ? await preparoDaApresentacao(leadId) : { medicaoPendente: false, estimativaPendente: false }),
  };
}

const dataHora = z.object({ dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hora: z.number().int().min(0).max(23) });
function paraData({ dia, hora }: z.infer<typeof dataHora>): Date {
  const [a, m, d] = dia.split("-").map(Number);
  return dataLocal(a, m, d, hora);
}

const esquema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("agendar"), leadId: z.string(), quando: dataHora, consultorId: z.string().optional(), tipo: z.enum(TIPOS_COMPROMISSO).optional() }),
  z.object({ acao: z.literal("cancelar"), visitaId: z.string() }),
  z.object({ acao: z.literal("bloquear"), consultorId: z.string(), quando: dataHora, horas: z.number().int().min(1).max(12), motivo: z.string().max(200).optional() }),
  z.object({ acao: z.literal("desbloquear"), bloqueioId: z.string() }),
]);

// Consultor cria bloqueios, agenda, remarca e cancela (AGENDA-03).
export const POST = rota(async (req: Request) => {
  const usuario = await exigirUsuario("gerir_agenda");
  const corpo = esquema.parse(await req.json());
  const exigirDono = (consultorId: string | null | undefined) => {
    if (consultorId && !podeEditarAgendaDe(usuario, consultorId)) throw new ErroHttp(403, "Você só pode alterar a sua própria agenda.");
  };
  try {
    switch (corpo.acao) {
      case "agendar": {
        exigirDono(corpo.consultorId);
        // Sem consultor escolhido, o consultor logado só agenda leads dele ou sem responsável.
        const lead = await db.lead.findUnique({ where: { id: corpo.leadId }, select: { consultorId: true } });
        if (usuario.perfil !== "admin" && lead?.consultorId && lead.consultorId !== usuario.id) throw new ErroHttp(403, "Esse lead é de outro consultor. Só o dono do lead ou o admin marca compromissos para ele.");
        // Apresentação de quem pulou a medição: a estimativa de valores precisa estar confirmada (regra da loja).
        if (corpo.tipo === "apresentacao") await exigirPreparoDaApresentacao(corpo.leadId);
        await agendarVisita({ leadId: corpo.leadId, inicio: paraData(corpo.quando), consultorId: corpo.consultorId ?? (usuario.perfil === "admin" ? undefined : usuario.id), autor: usuario.nome, tipo: corpo.tipo });
        break;
      }
      case "cancelar":
        exigirDono((await db.visita.findUnique({ where: { id: corpo.visitaId }, select: { consultorId: true } }))?.consultorId);
        await cancelarVisita(corpo.visitaId, usuario.nome);
        break;
      case "bloquear": {
        exigirDono(corpo.consultorId);
        const inicio = paraData(corpo.quando);
        await criarBloqueio({ consultorId: corpo.consultorId, inicio, fim: new Date(inicio.getTime() + corpo.horas * HORA), motivo: corpo.motivo, autor: usuario.nome });
        break;
      }
      case "desbloquear":
        exigirDono((await db.bloqueio.findUnique({ where: { id: corpo.bloqueioId }, select: { consultorId: true } }))?.consultorId);
        await removerBloqueio(corpo.bloqueioId);
        break;
    }
  } catch (erro) {
    if (erro instanceof ErroAgenda) throw new ErroHttp(409, erro.message);
    throw erro;
  }
  return { ok: true };
});
