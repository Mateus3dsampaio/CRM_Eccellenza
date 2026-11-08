import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { chaveVaga, sobrepoe } from "@/regras/agenda";
import { aberturaAtual, expedienteDoDia, horarioDeRepartir, horarioDeVerificar, lojaAberta, resumirItensDoDia, ultimoFechamento, type ItemDoDia } from "@/regras/presenca";
import { ETAPAS_COM_RETORNO } from "@/regras/vendas";
import { DIA, formatarHora, inicioDoDiaLocal } from "@/regras/tempo";
import { nomeExibicao } from "@/regras/telefone";
import { enviarPushDoAlerta } from "./push";
import { gravarConfig, lerConfig, regrasDaAgenda, regrasDePresenca } from "./configuracoes";
import { distribuirFila, transferirLead } from "./distribuicao";

// Presença dos vendedores e fila da loja fechada (tarefa 35). Todas as rotinas são seguras de repetir:
// cada uma grava uma marca (qual fechamento / qual abertura já tratou) antes de agir.
const MARCA_FECHAMENTO = "presenca_fechamento";
const MARCA_REPARTIU = "presenca_repartiu";
const MARCA_VERIFICOU = "presenca_verificou";

const NOMES_TIPO: Record<string, ItemDoDia["tipo"]> = { visita: "visita", medicao: "medicao", apresentacao: "apresentacao" };

/** Compromissos e retornos de hoje de um vendedor (do dia local de `quando`). */
async function itensDeHoje(consultorId: string, quando: Date) {
  const de = inicioDoDiaLocal(quando);
  const ate = new Date(de.getTime() + DIA);
  const visitas = await db.visita.findMany({
    where: { consultorId, status: "agendada", inicio: { gte: de, lt: ate } },
    select: { id: true, leadId: true, tipo: true, inicio: true, fim: true },
  });
  const retornos = await db.lead.findMany({
    where: { consultorId, arquivadoEm: null, etapa: { in: ETAPAS_COM_RETORNO }, proximoContatoEm: { gte: de, lt: ate } },
    select: { id: true, proximoContatoEm: true },
  });
  const itens: ItemDoDia[] = [
    ...visitas.map((v) => ({ tipo: NOMES_TIPO[v.tipo] ?? "visita", inicio: v.inicio })),
    ...retornos.map((r) => ({ tipo: "retorno" as const, inicio: r.proximoContatoEm as Date })),
  ];
  return { visitas, retornos, itens, resumo: resumirItensDoDia(itens) };
}

/** Resumo do que um vendedor tem hoje (a janela "Passar os de hoje para…" mostra antes de confirmar). */
export async function resumoDeHoje(consultorId: string) {
  const quando = await agora();
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id: consultorId }, select: { nome: true } });
  const { visitas, retornos, resumo } = await itensDeHoje(consultorId, quando);
  const leads = new Set([...visitas.map((v) => v.leadId), ...retornos.map((r) => r.id)]);
  return { nome: usuario.nome, resumo, leads: leads.size };
}

/**
 * Passa para outro vendedor os leads de hoje (os que têm compromisso ou retorno hoje) e os compromissos de hoje deles.
 * Só acontece quando uma pessoa escolhe (regra 7 da tarefa 35). Compromisso que bateria com um horário já ocupado do
 * destino não é passado: fica com o dono de antes e volta na lista de `conflitos`, para a pessoa resolver.
 */
export async function passarOsDeHoje(deId: string, paraId: string, autor: string): Promise<{ passados: number; conflitos: string[] }> {
  if (deId === paraId) throw new Error("Escolha um vendedor diferente.");
  const quando = await agora();
  const agenda = await regrasDaAgenda();
  const { visitas, retornos } = await itensDeHoje(deId, quando);
  const ocupados = [
    ...(await db.visita.findMany({ where: { consultorId: paraId, status: "agendada", fim: { gt: quando } }, select: { inicio: true, fim: true } })),
    ...(await db.bloqueio.findMany({ where: { consultorId: paraId, fim: { gt: quando } }, select: { inicio: true, fim: true } })),
  ];
  const conflitos = new Set<string>();
  const leadsComConflito = new Set<string>();
  const visitasLivres = visitas.filter((v) => {
    return !ocupados.some((o) => sobrepoe(o, v));
  });
  for (const v of visitas) if (!visitasLivres.includes(v)) leadsComConflito.add(v.leadId);
  for (const id of leadsComConflito) {
    const lead = await db.lead.findUnique({ where: { id } });
    if (lead) conflitos.add(nomeExibicao(lead));
  }
  for (const v of visitasLivres) {
    const nova = chaveVaga(paraId, v.inicio, agenda, v.tipo as "visita" | "medicao" | "apresentacao");
    await db.visita.update({ where: { id: v.id }, data: { consultorId: paraId, vagaChave: nova } });
  }
  const leadIds = new Set([...visitasLivres.map((v) => v.leadId), ...retornos.map((r) => r.id)]);
  for (const id of leadsComConflito) leadIds.delete(id);
  let passados = 0;
  for (const id of leadIds) {
    await transferirLead(id, paraId, autor);
    passados++;
  }
  if (passados || visitasLivres.length) await marcarMudanca();
  return { passados, conflitos: [...conflitos] };
}

/** No fechamento da loja todos os vendedores ficam offline (uma vez por fechamento: quem clicar "online" depois fica online). */
export async function desligarNoFechamento(quando: Date): Promise<number> {
  const regras = await regrasDePresenca();
  const agenda = await regrasDaAgenda();
  if (!regras.desligarNoFechamento || lojaAberta(quando, agenda)) return 0;
  const fechamento = ultimoFechamento(quando, agenda);
  if (!fechamento || (await lerConfig(MARCA_FECHAMENTO)) === fechamento.toISOString()) return 0;
  await gravarConfig(MARCA_FECHAMENTO, fechamento.toISOString());
  const r = await db.usuario.updateMany({ where: { perfil: "consultor", status: { not: "offline" } }, data: { status: "offline" } });
  if (r.count) await marcarMudanca();
  return r.count;
}

/** Cria o aviso de presença. `leadId` guarda o id do vendedor ausente quando não há lead (tipo "ausencia"). */
async function avisarPresenca(params: { tipo: "ausencia" | "compromisso_cedo"; leadId: string; leadNome: string; ausente: { id: string; nome: string }; texto: string; paraTodos: boolean }, quando: Date) {
  const criado = await db.alerta.create({
    data: {
      tipo: params.tipo,
      leadId: params.leadId,
      leadNome: params.leadNome,
      // No modo "só admin" o ausente não vê o próprio aviso (o dono do aviso é o filtro do consultor).
      consultorId: params.paraTodos ? params.ausente.id : null,
      consultorNome: params.ausente.nome,
      texto: params.texto,
      paraTodos: params.paraTodos,
      criadoEm: quando,
    },
  });
  void enviarPushDoAlerta(criado);
}

/** Quem não ficou online e tem compromisso ou retorno hoje gera um aviso (X min depois da abertura). */
export async function verificarPresenca(quando: Date): Promise<number> {
  const regras = await regrasDePresenca();
  const ausentes = await db.usuario.findMany({ where: { perfil: "consultor", ativo: true, status: "offline" }, select: { id: true, nome: true } });
  let avisos = 0;
  for (const ausente of ausentes) {
    const { resumo, itens } = await itensDeHoje(ausente.id, quando);
    if (!itens.length) continue;
    await avisarPresenca({ tipo: "ausencia", leadId: ausente.id, leadNome: ausente.nome, ausente, texto: resumo, paraTodos: regras.quemRecebe === "todos" }, quando);
    avisos++;
  }
  if (avisos) await marcarMudanca();
  return avisos;
}

/** Compromisso antes da verificação: se o dono não está online, avisa X min antes do horário (uma vez por compromisso). */
export async function avisarCompromissosCedo(quando: Date): Promise<number> {
  const regras = await regrasDePresenca();
  const agenda = await regrasDaAgenda();
  const expediente = expedienteDoDia(quando, agenda);
  if (!regras.verificarPresenca || !expediente) return 0;
  const limite = horarioDeVerificar(expediente.abre, regras);
  const visitas = await db.visita.findMany({
    where: {
      status: "agendada",
      inicio: { gte: inicioDoDiaLocal(quando), lt: limite, lte: new Date(quando.getTime() + regras.avisoCedoMin * 60_000) },
      fim: { gt: quando },
      consultor: { status: "offline", ativo: true },
    },
    include: { lead: true, consultor: { select: { id: true, nome: true } } },
  });
  let avisos = 0;
  for (const v of visitas) {
    const texto = `${NOMES_TIPO[v.tipo] === "medicao" ? "medição" : NOMES_TIPO[v.tipo] === "apresentacao" ? "apresentação" : "visita"} às ${formatarHora(v.inicio)}`;
    const leadNome = nomeExibicao(v.lead);
    if (await db.alerta.count({ where: { tipo: "compromisso_cedo", leadId: v.leadId, texto } })) continue;
    await avisarPresenca({ tipo: "compromisso_cedo", leadId: v.leadId, leadNome, ausente: v.consultor, texto, paraTodos: regras.quemRecebe === "todos" }, quando);
    avisos++;
  }
  if (avisos) await marcarMudanca();
  return avisos;
}

/** Roda as rotinas de presença (chamada por `rodarRotinas`, a cada minuto). */
export async function rodarPresenca(): Promise<void> {
  const quando = await agora();
  const regras = await regrasDePresenca();
  const agenda = await regrasDaAgenda();
  await desligarNoFechamento(quando);
  const abertura = aberturaAtual(quando, agenda);
  if (abertura && regras.repartirFila && quando.getTime() >= horarioDeRepartir(abertura, regras).getTime() && (await lerConfig(MARCA_REPARTIU)) !== abertura.toISOString()) {
    await gravarConfig(MARCA_REPARTIU, abertura.toISOString());
    await distribuirFila();
  }
  if (abertura && regras.verificarPresenca && quando.getTime() >= horarioDeVerificar(abertura, regras).getTime() && (await lerConfig(MARCA_VERIFICOU)) !== abertura.toISOString()) {
    await gravarConfig(MARCA_VERIFICOU, abertura.toISOString());
    await verificarPresenca(quando);
  }
  await avisarCompromissosCedo(quando);
}
