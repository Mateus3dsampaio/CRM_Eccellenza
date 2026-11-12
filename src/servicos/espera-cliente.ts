import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { MENSAGENS_PARA_ANALISE, montarConversa, podeAnalisar } from "@/regras/espera-ia";
import { esperaDoLead } from "@/regras/espera";
import { obterChave } from "./chaves-api";
import { classificarEspera } from "./espera-ia";
import { registrarAlteracao } from "./historico";

// "O cliente espera resposta?" (tarefa: cronômetro só quando o cliente realmente espera). Com o consultor no comando, a mensagem
// do cliente liga a espera como sempre; depois a IA (ou o vendedor, pelo botão) pode dispensá-la. Como fica guardado:
// - Mensagem.dispensadaEm/dispensadaPor: qual mensagem foi dispensada e por quem (o painel tira essas da conta);
// - Lead.respondeuSemEsperaEm: o card está em "Cliente respondeu" (cinza, sem prazo). A espera em si (aguardandoHumano e
//   esperandoDesde) volta ao estado de "o consultor já respondeu", então nada que lê esses campos muda de comportamento.
// Rede de segurança: tudo que for incerto deixa o lead esperando, como era antes.

export const AUTOR_IA = "ia";

/** Respostas da loja (bot ou consultor) contam como "respondeu" (o sistema não conta), como no tempo de resposta do painel. */
async function horaDaUltimaResposta(leadId: string): Promise<Date | null> {
  const ultima = await db.mensagem.findFirst({ where: { leadId, autor: { in: ["bot", "consultor"] } }, orderBy: { enviadaEm: "desc" }, select: { enviadaEm: true } });
  return ultima?.enviadaEm ?? null;
}

/** Mensagens do cliente que ninguém respondeu ainda (depois da última resposta do bot ou do consultor). */
async function mensagensSemResposta(leadId: string) {
  const depoisDe = await horaDaUltimaResposta(leadId);
  return db.mensagem.findMany({ where: { leadId, autor: "cliente", ...(depoisDe ? { enviadaEm: { gt: depoisDe } } : {}) }, orderBy: { enviadaEm: "asc" }, select: { id: true, enviadaEm: true, dispensadaEm: true } });
}

/** Botão "Não precisa responder": o vendedor dispensa a espera de agora. Devolve false se o lead não estava esperando. */
export async function dispensarEspera(leadId: string, autorNome: string): Promise<boolean> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.etapa === "perdido") return false;
  const desde = esperaDoLead(lead);
  if (!desde) return false;
  const quando = await agora();
  const pendentes = (await mensagensSemResposta(leadId)).filter((m) => !m.dispensadaEm);
  if (pendentes.length) await db.mensagem.updateMany({ where: { id: { in: pendentes.map((m) => m.id) } }, data: { dispensadaEm: quando, dispensadaPor: autorNome } });
  await db.lead.update({ where: { id: leadId }, data: { aguardandoHumano: false, esperandoDesde: null, respondeuSemEsperaEm: lead.ultimaMsgClienteEm ?? desde } });
  await registrarAlteracao(leadId, autorNome, "Marcou \"Não precisa responder\": o cliente não está esperando resposta");
  await marcarMudanca();
  return true;
}

/** Caminho de volta ("Precisa de resposta"): corrige a IA ou o próprio clique. A espera volta a contar desde a mensagem dispensada mais antiga. */
export async function restaurarEspera(leadId: string, autorNome: string): Promise<boolean> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.etapa === "perdido" || esperaDoLead(lead)) return false;
  if (!lead.respondeuSemEsperaEm) return false;
  const dispensadas = (await mensagensSemResposta(leadId)).filter((m) => m.dispensadaEm);
  if (dispensadas.length) await db.mensagem.updateMany({ where: { id: { in: dispensadas.map((m) => m.id) } }, data: { dispensadaEm: null, dispensadaPor: null } });
  const desde = dispensadas[0]?.enviadaEm ?? lead.respondeuSemEsperaEm;
  await db.lead.update({ where: { id: leadId }, data: { aguardandoHumano: true, esperandoDesde: desde, respondeuSemEsperaEm: null } });
  await registrarAlteracao(leadId, autorNome, "Marcou \"Precisa de resposta\": o cliente está esperando resposta");
  await marcarMudanca();
  return true;
}

/**
 * Roda a IA para a mensagem que acabou de abrir a espera. Só dispensa se, no fim, ainda for a última mensagem do cliente,
 * o consultor não tiver respondido nem devolvido ao bot e a espera for exatamente a que esta mensagem abriu.
 * Nunca lança.
 */
export async function checarEsperaDoCliente(params: { leadId: string; mensagemId: string; chegouEm: Date }): Promise<void> {
  const { leadId, mensagemId, chegouEm } = params;
  try {
    if (!(await obterChave("anthropic"))) return;
    const recentes = await db.mensagem.findMany({ where: { leadId }, orderBy: [{ enviadaEm: "desc" }, { id: "desc" }], take: MENSAGENS_PARA_ANALISE });
    const analisada = recentes[0];
    if (!analisada || analisada.id !== mensagemId || !podeAnalisar({ texto: analisada.texto, temMidia: !!analisada.midiaArquivo })) return;
    const conversa = montarConversa(recentes.reverse().map((m) => ({ autor: m.autor, texto: m.texto, temMidia: !!m.midiaArquivo })));
    if ((await classificarEspera(conversa)) !== "nao_espera") return;

    // A chamada demora: confere de novo se nada mudou antes de gravar.
    const ultimaDoCliente = await db.mensagem.findFirst({ where: { leadId, autor: "cliente" }, orderBy: [{ enviadaEm: "desc" }, { id: "desc" }], select: { id: true } });
    if (ultimaDoCliente?.id !== mensagemId) return;
    const dispensou = await db.lead.updateMany({
      // esperandoDesde igual à hora desta mensagem: a espera é a que ela abriu (consultor respondeu ou devolveu ao bot = campo limpo = não casa).
      where: { id: leadId, esperandoDesde: chegouEm, ultimaMsgClienteEm: chegouEm, aguardandoHumano: true, modoAtendimento: { not: "bot" }, etapa: { not: "perdido" }, arquivadoEm: null },
      data: { aguardandoHumano: false, esperandoDesde: null, respondeuSemEsperaEm: chegouEm },
    });
    if (!dispensou.count) return;
    await db.mensagem.update({ where: { id: mensagemId }, data: { dispensadaEm: await agora(), dispensadaPor: AUTOR_IA } });
    await registrarAlteracao(leadId, "IA", "A IA avaliou a mensagem do cliente e concluiu que ela não pede resposta (\"Cliente respondeu\"). Se pedir, use \"Precisa de resposta\"");
    await marcarMudanca();
  } catch (erro) {
    console.error("[espera-cliente] falhou:", erro instanceof Error ? erro.name : "erro");
  }
}

// A chegada da mensagem não espera pela IA: a checagem roda solta e o resultado só entra depois. A lista serve para os testes esperarem.
const emAndamento = new Set<Promise<void>>();

export function agendarChecagemDaEspera(params: { leadId: string; mensagemId: string; chegouEm: Date }): void {
  const tarefa: Promise<void> = checarEsperaDoCliente(params).finally(() => emAndamento.delete(tarefa));
  emAndamento.add(tarefa);
}

export async function aguardarChecagensDaEspera(): Promise<void> {
  while (emAndamento.size) await Promise.all([...emAndamento]);
}
