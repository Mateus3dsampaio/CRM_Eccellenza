import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { DIAS_ALERTA_GUARDADO, type TipoAlerta } from "@/regras/alertas";
import { ETAPAS_COM_RETORNO } from "@/regras/vendas";
import { formatarHora, formatarVisitaCurta, inicioDoDiaLocal } from "@/regras/tempo";
import { decisaoPendente, ETIQUETA_DECISAO } from "@/regras/decisao";
import { esperaDoLead, faixaDeEspera, minutosEsperando, textoDeEspera } from "@/regras/espera";
import { nomeExibicao } from "@/regras/telefone";
import { DIA } from "@/regras/tempo";
import { prazosDeEspera } from "./configuracoes";
import { marcarMudanca } from "@/lib/versao";
import { enviarPushDoAlerta } from "./push";

const LIMITE_POR_CONSULTA = 50;

/**
 * Guarda um aviso para quem atende. O dono é o consultor do lead nesta hora; sem dono, só o admin recebe.
 * Quem chama já vai marcar a mudança (as telas então buscam os avisos novos).
 */
export async function registrarAlerta(params: { tipo: TipoAlerta; leadId: string; texto?: string | null; paraTodos?: boolean }): Promise<void> {
  const lead = await db.lead.findUnique({ where: { id: params.leadId }, include: { consultor: { select: { id: true, nome: true } } } });
  if (!lead) return;
  const quando = await agora();
  const criado = await db.alerta.create({
    data: {
      tipo: params.tipo,
      leadId: lead.id,
      leadNome: nomeExibicao(lead),
      consultorId: lead.consultor?.id ?? null,
      consultorNome: lead.consultor?.nome ?? null,
      texto: params.texto ?? null,
      paraTodos: params.paraTodos ?? false,
      criadoEm: quando,
    },
  });
  // Avisos com o CRM fechado ou minimizado (quem ligou no sino). Não espera: o aviso do sistema não pode atrasar a resposta.
  void enviarPushDoAlerta(criado);
  // Aviso velho não serve para nada: limpa junto.
  await db.alerta.deleteMany({ where: { criadoEm: { lt: new Date(quando.getTime() - DIAS_ALERTA_GUARDADO * DIA) } } });
}

/**
 * Avisos novos para o usuário. Sem `depois` (primeira consulta da tela) não devolve aviso nenhum, só o ponto de partida:
 * quem abre o CRM não recebe de uma vez o que aconteceu antes. O consultor recebe só os dos seus leads; o admin, todos.
 */
export async function alertasDesde(usuario: { id: string; perfil: string }, depois?: number) {
  const ultimo = (await db.alerta.aggregate({ _max: { id: true } }))._max.id ?? 0;
  if (depois === undefined) return { eventos: [], ultimoId: ultimo };
  const linhas = await db.alerta.findMany({
    // Prazo vencido é aviso para o admin; o consultor só recebe os avisos dos seus leads.
    where: {
      id: { gt: depois },
      ...(usuario.perfil === "admin" ? {} : { OR: [{ consultorId: usuario.id, tipo: { not: "prazo_vermelho" } }, { paraTodos: true }] }),
    },
    orderBy: { id: "asc" },
    take: LIMITE_POR_CONSULTA,
  });
  const cheio = linhas.length === LIMITE_POR_CONSULTA;
  return {
    eventos: linhas.map((a) => ({
      id: a.id,
      tipo: a.tipo as TipoAlerta,
      leadId: a.leadId,
      leadNome: a.leadNome,
      consultorId: a.consultorId,
      consultorNome: a.consultorNome,
      texto: a.texto,
      paraTodos: a.paraTodos,
    })),
    // Se veio muita coisa de uma vez, a próxima consulta continua de onde esta parou.
    ultimoId: cheio ? linhas[linhas.length - 1].id : ultimo,
  };
}

/**
 * Avisa o admin dos leads que passaram do prazo vermelho sem resposta (ESP-09). Um aviso só por espera:
 * a espera é identificada pelo valor de `esperandoDesde`, então uma espera nova (depois de o consultor responder) avisa de novo.
 * Barato o bastante para rodar a cada consulta de versão; a marca é gravada antes do aviso, então duas telas ao mesmo tempo não duplicam.
 */
export async function avisarPrazosVermelhos(): Promise<number> {
  const quando = await agora();
  const prazos = await prazosDeEspera();
  const leads = await db.lead.findMany({ where: { arquivadoEm: null, aguardandoHumano: true }, select: { id: true, aguardandoHumano: true, esperandoDesde: true, repassadoEm: true, ultimaMsgClienteEm: true, alertaPrazoPara: true } });
  let avisados = 0;
  for (const lead of leads) {
    const desde = esperaDoLead(lead);
    if (!desde || faixaDeEspera(desde, quando, prazos) !== "vermelho") continue;
    if (lead.alertaPrazoPara?.getTime() === desde.getTime()) continue;
    // Reserva o aviso: só quem conseguir atualizar a linha cria o aviso.
    const reservado = await db.lead.updateMany({
      where: { id: lead.id, OR: [{ alertaPrazoPara: null }, { alertaPrazoPara: { not: desde } }] },
      data: { alertaPrazoPara: desde },
    });
    if (!reservado.count) continue;
    await registrarAlerta({ tipo: "prazo_vermelho", leadId: lead.id, texto: textoDeEspera(minutosEsperando(desde, quando)) });
    avisados++;
  }
  if (avisados) await marcarMudanca();
  return avisados;
}

/**
 * Avisa o vendedor na hora do próximo contato (RET-01): som, notificação e aviso na tela, uma vez por data marcada.
 * Quem chega depois do horário (ex.: o relógio andou) também é avisado. Trocar a data marca um novo aviso.
 */
export async function avisarRetornos(): Promise<number> {
  const quando = await agora();
  const leads = await db.lead.findMany({
    where: { arquivadoEm: null, etapa: { in: ETAPAS_COM_RETORNO }, proximoContatoEm: { not: null, lte: quando } },
    select: { id: true, proximoContatoEm: true, alertaContatoPara: true },
  });
  let avisados = 0;
  for (const lead of leads) {
    const marcado = lead.proximoContatoEm as Date;
    if (lead.alertaContatoPara?.getTime() === marcado.getTime()) continue;
    // Reserva o aviso: só quem conseguir atualizar a linha cria o aviso (duas telas ao mesmo tempo não duplicam).
    const reservado = await db.lead.updateMany({
      where: { id: lead.id, proximoContatoEm: marcado, OR: [{ alertaContatoPara: null }, { alertaContatoPara: { not: marcado } }] },
      data: { alertaContatoPara: marcado },
    });
    if (!reservado.count) continue;
    await registrarAlerta({ tipo: "retorno", leadId: lead.id, texto: formatarHora(marcado) });
    avisados++;
  }
  if (avisados) await marcarMudanca();
  return avisados;
}

/**
 * Data vencida sem decisão do vendedor (medição ou apresentação que passou, retorno da Negociação vencido): avisa o dono do
 * lead e o admin na virada do dia, e de novo a cada dia enquanto ninguém decidir. A marca do dia é gravada antes do aviso
 * (duas telas ao mesmo tempo não duplicam).
 */
export async function avisarDecisoesVencidas(): Promise<number> {
  const quando = await agora();
  const hoje = inicioDoDiaLocal(quando);
  const leads = await db.lead.findMany({
    where: {
      arquivadoEm: null,
      etapa: { in: ["medicao", "apresentacao", "negociacao"] },
      OR: [{ alertaDecisaoEm: null }, { alertaDecisaoEm: { lt: hoje } }],
    },
    select: { id: true, etapa: true, proximoContatoEm: true, alertaDecisaoEm: true, visitas: { where: { status: "agendada" }, select: { tipo: true, inicio: true, concluidaEm: true } } },
  });
  let avisados = 0;
  for (const lead of leads) {
    const decisao = decisaoPendente(lead, lead.visitas, quando);
    if (!decisao) continue;
    const reservado = await db.lead.updateMany({
      where: { id: lead.id, OR: [{ alertaDecisaoEm: null }, { alertaDecisaoEm: { lt: hoje } }] },
      data: { alertaDecisaoEm: quando },
    });
    if (!reservado.count) continue;
    await registrarAlerta({ tipo: "decisao_vencida", leadId: lead.id, texto: `${ETIQUETA_DECISAO[decisao.tipo]} (${formatarVisitaCurta(decisao.venceuEm)}).` });
    avisados++;
  }
  if (avisados) await marcarMudanca();
  return avisados;
}
