import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { acoesDoCard, type LeadParaAcao } from "@/regras/acao-card";
import { lerMetas, periodoDoPlacar, placarVisto, precisaConfirmarEstimativa, progressoDaMeta, prontoParaMarcar, ritmoDaMeta, TEXTO_ESTIMATIVA } from "@/regras/apresentacao";
import { decisaoPendente } from "@/regras/decisao";
import { PRAZOS_ESPERA_PADRAO } from "@/regras/espera";
import { dataLocal, inicioDoMesLocal, partesLocais, somarDias } from "@/regras/tempo";
import { agendarVisita, horariosLivresParaLead } from "@/servicos/agenda";
import { concluirMedicao, confirmarEstimativa, converterApresentacoesAntigas, definirMetasDeApresentacao, exigirEstimativa, placarDoMes, pularMedicao } from "@/servicos/apresentacoes";
import { cardsDoKanban } from "@/servicos/consultas";
import { moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { transferirLead } from "@/servicos/distribuicao";
import { criarConsultores, limparBanco } from "./ajuda";

beforeEach(async () => {
  await limparBanco();
});

describe("pronto para marcar a apresentação (regra)", () => {
  const medicao = { tipo: "medicao", concluidaEm: new Date() };
  it("medição concluída sem apresentação marcada, na coluna Medição", () => {
    expect(prontoParaMarcar({ etapa: "medicao", compromissos: [medicao] })).toBe("medicao");
    expect(prontoParaMarcar({ etapa: "medicao", compromissos: [{ tipo: "medicao", concluidaEm: null }] })).toBeNull();
  });
  it("medição concluída e outra medição marcada depois: não é pronto (reagendar não conta)", () => {
    expect(prontoParaMarcar({ etapa: "medicao", compromissos: [medicao, { tipo: "medicao", concluidaEm: null }] })).toBeNull();
  });
  it("cliente que já tem projeto (pulou a medição) em Em qualificação", () => {
    expect(prontoParaMarcar({ etapa: "qualificacao", pulouMedicaoEm: new Date(), compromissos: [] })).toBe("projeto");
    expect(prontoParaMarcar({ etapa: "qualificacao", compromissos: [] })).toBeNull();
    // Agendou a medição depois de pular: deixa de ser pronto.
    expect(prontoParaMarcar({ etapa: "qualificacao", pulouMedicaoEm: new Date(), compromissos: [{ tipo: "medicao" }] })).toBeNull();
  });
  it("sai da lista quando a apresentação é marcada, ou com Perdido/arquivado", () => {
    expect(prontoParaMarcar({ etapa: "medicao", compromissos: [medicao, { tipo: "apresentacao", concluidaEm: null }] })).toBeNull();
    expect(prontoParaMarcar({ etapa: "perdido", pulouMedicaoEm: new Date(), compromissos: [] })).toBeNull();
    expect(prontoParaMarcar({ etapa: "medicao", arquivado: true, compromissos: [medicao] })).toBeNull();
    expect(prontoParaMarcar({ etapa: "negociacao", compromissos: [medicao] })).toBeNull();
  });
});

describe("aviso da estimativa de valores (regra)", () => {
  it("só pergunta a quem pulou a medição e ainda não confirmou", () => {
    expect(precisaConfirmarEstimativa({ pulouMedicaoEm: new Date(), estimativaAlinhadaEm: null })).toBe(true);
    expect(precisaConfirmarEstimativa({ pulouMedicaoEm: new Date(), estimativaAlinhadaEm: new Date() })).toBe(false);
    expect(precisaConfirmarEstimativa({ pulouMedicaoEm: null })).toBe(false);
  });
  it("o texto não traz valor nem faixa de preço (política da loja)", () => {
    const tudo = Object.values(TEXTO_ESTIMATIVA).join(" ");
    expect(tudo).not.toMatch(/R\$|\d/);
  });
});

describe("placar e ritmo (regra)", () => {
  it("o mês é o de Fortaleza e os dias contam hoje", () => {
    const p = periodoDoPlacar(dataLocal(2026, 11, 10, 9));
    expect(p.nomeDoMes).toBe("novembro");
    expect(p.diasRestantes).toBe(21);
    expect(periodoDoPlacar(dataLocal(2026, 11, 30, 18)).diasRestantes).toBe(1);
    expect(periodoDoPlacar(dataLocal(2026, 12, 31, 8)).fim.getTime()).toBe(dataLocal(2027, 1, 1).getTime());
    // 00:30 de 1º/12 em Fortaleza ainda é UTC de 30/11 às 03:30: vale dezembro.
    expect(periodoDoPlacar(dataLocal(2026, 12, 1, 0, 30)).nomeDoMes).toBe("dezembro");
  });
  it("faltam 8, precisa de 3 por semana", () => {
    expect(ritmoDaMeta(12, 20, 21)).toMatchObject({ faltam: 8, porSemana: 3, batida: false, texto: "faltam 8, precisa de 3 por semana" });
  });
  it("na última semana do mês fala em dias; meta batida mostra isso", () => {
    expect(ritmoDaMeta(18, 20, 3).texto).toBe("faltam 2, restam 3 dias");
    expect(ritmoDaMeta(18, 20, 1).texto).toBe("faltam 2, restam 1 dia");
    expect(ritmoDaMeta(20, 20, 5)).toMatchObject({ batida: true, faltam: 0, texto: "Meta batida" });
    expect(ritmoDaMeta(23, 20, 5).texto).toBe("Meta batida (+3)");
  });
  it("progresso nunca passa de 100% e sem meta é zero", () => {
    expect(progressoDaMeta(12, 20)).toBeCloseTo(0.6);
    expect(progressoDaMeta(30, 20)).toBe(1);
    expect(progressoDaMeta(5, 0)).toBe(0);
  });
  it("o admin vê a soma ou um vendedor; sem meta definida não há meta", () => {
    const contagens = { a: { realizadas: 5, agendadas: 2 }, b: { realizadas: 7, agendadas: 2 } };
    expect(placarVisto(contagens, { a: 10, b: 10 }, ["a", "b"])).toEqual({ realizadas: 12, agendadas: 4, meta: 20 });
    expect(placarVisto(contagens, { a: 10, b: 10 }, ["a", "b"], "b")).toEqual({ realizadas: 7, agendadas: 2, meta: 10 });
    expect(placarVisto(contagens, {}, ["a", "b"]).meta).toBeNull();
    expect(placarVisto(contagens, { a: 10 }, ["a", "b"], "b").meta).toBeNull();
  });
  it("lê as metas guardadas ignorando lixo", () => {
    expect(lerMetas('{"a":8,"b":0,"c":-2,"d":"x","e":2.5,"f":1000}')).toEqual({ a: 8 });
    expect(lerMetas("não é json")).toEqual({});
    expect(lerMetas(null)).toEqual({});
  });
});

describe("faixa de ação e decisão com o pronto (regra)", () => {
  const base: LeadParaAcao = { etapa: "medicao", modo: "humano", consultor: { id: "x" }, esperandoDesde: null, ultimaMsgClienteEm: null, erroBot: null, decisao: null, semData: false, proximoContatoEm: null, lembreteNota: null, visita: "Medição seg 09/11 8h", pronto: "medicao" };
  const ctx = { agora: dataLocal(2026, 11, 10, 9), prazos: PRAZOS_ESPERA_PADRAO, retornoObrigatorio: () => false };
  it("pronto vira a faixa âmbar 'Marcar apresentação' e é pendência do vendedor", () => {
    const [primeira] = acoesDoCard(base, ctx);
    expect(primeira).toMatchObject({ codigo: "marcar_apresentacao", cor: "ambar", texto: "Marcar apresentação", precisaDeVoce: true });
  });
  it("em Em qualificação (pulou a medição) é a mesma faixa", () => {
    expect(acoesDoCard({ ...base, etapa: "qualificacao", visita: null, pronto: "projeto" }, ctx)[0].codigo).toBe("marcar_apresentacao");
  });
  it("sem pronto não aparece", () => {
    expect(acoesDoCard({ ...base, pronto: null }, ctx).some((a) => a.codigo === "marcar_apresentacao")).toBe(false);
  });
  it("compromisso concluído não pede decisão", () => {
    const ontem = dataLocal(2026, 11, 9, 17);
    expect(decisaoPendente({ etapa: "medicao" }, [{ tipo: "medicao", inicio: ontem, concluidaEm: ontem }], ctx.agora)).toBeNull();
    expect(decisaoPendente({ etapa: "medicao" }, [{ tipo: "medicao", inicio: ontem }], ctx.agora)).toMatchObject({ tipo: "medicao" });
  });
});

// ---------- Fluxos com banco ----------

const card = async (id: string) => (await cardsDoKanban()).find((c) => c.id === id)!;

/** Apresentação direto no banco, na data pedida (a agenda real só marca daqui para frente). */
async function apresentacaoEm(leadId: string, consultorId: string, inicio: Date, extra: { concluidaEm?: Date | null } = {}) {
  return db.visita.create({
    data: { leadId, consultorId, tipo: "apresentacao", inicio, fim: new Date(inicio.getTime() + 3_600_000), vagaChave: `${consultorId}|${inicio.toISOString()}`, criadoPor: "teste", criadoEm: new Date(inicio.getTime() - 5 * 86_400_000), ...extra },
  });
}
async function leadNaEtapa(tel: string, etapa: string, consultorId: string) {
  const lead = await obterOuCriarLead(tel);
  return db.lead.update({ where: { id: lead.id }, data: { etapa, consultorId } });
}
async function diaDoMes(dia: number, hora = 10) {
  const p = partesLocais(await agora());
  return dataLocal(p.ano, p.mes, dia, hora);
}

describe("placar do mês (banco)", () => {
  it("apresentação arrastada de Apresentação para Negociação ou Fechado conta como realizada, sem passar pela janela", async () => {
    const [a] = await criarConsultores();
    const l1 = await leadNaEtapa("+5588900009001", "apresentacao", a.id);
    const l2 = await leadNaEtapa("+5588900009002", "apresentacao", a.id);
    const v1 = await apresentacaoEm(l1.id, a.id, await diaDoMes(1));
    const v2 = await apresentacaoEm(l2.id, a.id, await diaDoMes(1, 14));
    await moverEtapa(l1.id, "negociacao", "Rafael", { dados: { proximoContatoEm: somarDias(await agora(), 3) } });
    await moverEtapa(l2.id, "fechado", "Rafael", { dados: { valorFechado: 100 } });
    expect((await db.visita.findUniqueOrThrow({ where: { id: v1.id } })).concluidaEm).not.toBeNull();
    expect((await db.visita.findUniqueOrThrow({ where: { id: v2.id } })).concluidaEm).not.toBeNull();
    const placar = await placarDoMes({ id: a.id, perfil: "consultor" });
    expect(placar.contagens[a.id].realizadas).toBe(2);
    expect(await db.alteracao.count({ where: { leadId: l1.id, descricao: { contains: "Concluiu a apresentação" } } })).toBe(1);
  });

  it("conta no mês da data da apresentação, não no mês do clique", async () => {
    const [a] = await criarConsultores();
    const lead = await leadNaEtapa("+5588900009003", "apresentacao", a.id);
    // Apresentação do último dia do mês passado, decidida hoje.
    const fimDoMesPassado = somarDias(inicioDoMesLocal(await agora()), -1);
    const p = partesLocais(fimDoMesPassado);
    await apresentacaoEm(lead.id, a.id, dataLocal(p.ano, p.mes, p.dia, 17));
    await moverEtapa(lead.id, "negociacao", "Rafael", { dados: { proximoContatoEm: somarDias(await agora(), 2) } });
    expect((await placarDoMes({ id: a.id, perfil: "consultor" })).contagens[a.id].realizadas).toBe(0);
  });

  it("agendadas = do mês de hoje em diante + vencidas sem decisão; Perdido não entra; reagendar não é realizada", async () => {
    const [a] = await criarConsultores();
    const hoje = await agora();
    const futura = await leadNaEtapa("+5588900009004", "apresentacao", a.id);
    await apresentacaoEm(futura.id, a.id, new Date(hoje.getTime() + 3_600_000));
    const vencida = await leadNaEtapa("+5588900009005", "apresentacao", a.id);
    await apresentacaoEm(vencida.id, a.id, new Date(hoje.getTime() - 3 * 86_400_000));
    const perdida = await leadNaEtapa("+5588900009006", "perdido", a.id);
    await apresentacaoEm(perdida.id, a.id, new Date(hoje.getTime() + 7_200_000));
    const placar = await placarDoMes({ id: a.id, perfil: "consultor" });
    // A futura só vale se ainda cair no mês (última hora do último dia: borda).
    const caiNoMes = periodoDoPlacar(hoje).fim.getTime() > hoje.getTime() + 3_600_000;
    expect(placar.contagens[a.id]).toEqual({ realizadas: 0, agendadas: caiNoMes ? 2 : 1 });
  });

  it("consultor vê só o dele; admin vê todos; a meta de um não aparece para o outro", async () => {
    const [a, b] = await criarConsultores();
    const la = await leadNaEtapa("+5588900009007", "negociacao", a.id);
    await apresentacaoEm(la.id, a.id, await diaDoMes(1), { concluidaEm: await diaDoMes(1, 12) });
    const lb = await leadNaEtapa("+5588900009008", "negociacao", b.id);
    await apresentacaoEm(lb.id, b.id, await diaDoMes(1, 15), { concluidaEm: await diaDoMes(1, 17) });
    await definirMetasDeApresentacao({ [a.id]: 20, [b.id]: 12 });

    const doA = await placarDoMes({ id: a.id, perfil: "consultor" });
    expect(Object.keys(doA.contagens)).toEqual([a.id]);
    expect(doA.metas).toEqual({ [a.id]: 20 });
    expect(doA.vendedores).toHaveLength(1);

    const admin = await placarDoMes({ id: "qualquer", perfil: "admin" });
    expect(admin.contagens[a.id].realizadas).toBe(1);
    expect(admin.contagens[b.id].realizadas).toBe(1);
    expect(admin.metas).toEqual({ [a.id]: 20, [b.id]: 12 });
    expect(placarVisto(admin.contagens, admin.metas, admin.vendedores.map((v) => v.id))).toMatchObject({ realizadas: 2, meta: 32 });
  });

  it("lead transferido: a realizada fica com quem era o responsável pela apresentação", async () => {
    const [a, b] = await criarConsultores();
    const lead = await leadNaEtapa("+5588900009009", "apresentacao", a.id);
    await apresentacaoEm(lead.id, a.id, await diaDoMes(1));
    await moverEtapa(lead.id, "negociacao", "Rafael", { dados: { proximoContatoEm: somarDias(await agora(), 2) } });
    await transferirLead(lead.id, b.id, "Admin");
    const placar = await placarDoMes({ id: "adm", perfil: "admin" });
    expect(placar.contagens[a.id].realizadas).toBe(1);
    expect(placar.contagens[b.id].realizadas).toBe(0);
  });

  it("meta: só o admin grava (rota), valor inválido é recusado e vazio tira a meta", async () => {
    const [a] = await criarConsultores();
    await definirMetasDeApresentacao({ [a.id]: 15 });
    expect((await placarDoMes({ id: "adm", perfil: "admin" })).metas).toEqual({ [a.id]: 15 });
    await expect(definirMetasDeApresentacao({ [a.id]: 1000 })).rejects.toThrow();
    await expect(definirMetasDeApresentacao({ [a.id]: 2.5 })).rejects.toThrow();
    await definirMetasDeApresentacao({ [a.id]: null });
    expect((await placarDoMes({ id: "adm", perfil: "admin" })).metas).toEqual({});
    // Sem meta nenhuma o placar existe só com a contagem.
    expect(placarVisto((await placarDoMes({ id: "adm", perfil: "admin" })).contagens, {}, [a.id]).meta).toBeNull();
  });
});

describe("caminho até a apresentação (banco)", () => {
  async function leadComMedicao() {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900009100");
    const [m] = await horariosLivresParaLead(lead.id, 1, undefined, "medicao");
    await agendarVisita({ leadId: lead.id, inicio: m.inicio, autor: "teste", tipo: "medicao" });
    return lead;
  }

  it("medição concluída não obriga a marcar a apresentação: o card fica em Medição agendada, pronto para marcar", async () => {
    const lead = await leadComMedicao();
    expect((await card(lead.id)).pronto).toBeNull();
    await concluirMedicao(lead.id, "Rafael");
    const c = await card(lead.id);
    expect(c.etapa).toBe("medicao");
    expect(c.pronto).toBe("medicao");
    expect(c.semData).toBe(false);
    expect(await db.alteracao.count({ where: { leadId: lead.id, descricao: { contains: "Concluiu a medição" } } })).toBe(1);
    // Marcar a apresentação tira o pronto e leva o card para Apresentação.
    const [ap] = await horariosLivresParaLead(lead.id, 1, undefined, "apresentacao");
    await agendarVisita({ leadId: lead.id, inicio: ap.inicio, autor: "teste", tipo: "apresentacao" });
    const depois = await card(lead.id);
    expect(depois.etapa).toBe("apresentacao");
    expect(depois.pronto).toBeNull();
  });

  it("medição concluída não pede decisão no dia seguinte", async () => {
    const lead = await leadComMedicao();
    await concluirMedicao(lead.id, "Rafael");
    const dias = await db.visita.findFirstOrThrow({ where: { leadId: lead.id, tipo: "medicao" } });
    expect(decisaoPendente({ etapa: "medicao" }, [dias], new Date(dias.inicio.getTime() + 2 * 86_400_000))).toBeNull();
  });

  it("só conclui medição de quem tem medição marcada", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900009101");
    await expect(concluirMedicao(lead.id, "Rafael")).rejects.toThrow(/medição/);
  });

  it("cliente que já tem projeto: pular a medição deixa pronto em Em qualificação; medir depois desfaz", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900009102");
    await db.lead.update({ where: { id: lead.id }, data: { etapa: "qualificacao" } });
    await pularMedicao(lead.id, true, "Rafael");
    expect((await card(lead.id)).pronto).toBe("projeto");
    expect(await db.alteracao.count({ where: { leadId: lead.id, descricao: { contains: "pulou a medição" } } })).toBe(1);

    const [m] = await horariosLivresParaLead(lead.id, 1, undefined, "medicao");
    await agendarVisita({ leadId: lead.id, inicio: m.inicio, autor: "teste", tipo: "medicao" });
    const c = await card(lead.id);
    expect(c.pronto).toBeNull();
    expect(c.pulouMedicao).toBe(false);
  });

  it("só pula a medição quem está em Em qualificação e dá para desfazer", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900009103");
    await expect(pularMedicao(lead.id, true, "Rafael")).rejects.toThrow(/Em qualificação/);
    await db.lead.update({ where: { id: lead.id }, data: { etapa: "qualificacao" } });
    await pularMedicao(lead.id, true, "Rafael");
    await pularMedicao(lead.id, false, "Rafael");
    expect((await card(lead.id)).pronto).toBeNull();
  });

  it("vai para Perdido ou é arquivado: sai dos prontos", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900009104");
    await db.lead.update({ where: { id: lead.id }, data: { etapa: "qualificacao" } });
    await pularMedicao(lead.id, true, "Rafael");
    await moverEtapa(lead.id, "perdido", "Rafael", { dados: { motivoPerda: "desistiu" } });
    expect((await card(lead.id)).pronto).toBeNull();
  });

  it("estimativa de valores: quem pulou a medição só marca depois do 'sim', gravado no histórico com quem fez", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900009105");
    await db.lead.update({ where: { id: lead.id }, data: { etapa: "qualificacao" } });
    // Quem não pulou a medição não é perguntado.
    await expect(exigirEstimativa(lead.id)).resolves.toBeUndefined();
    await pularMedicao(lead.id, true, "Rafael");
    await expect(exigirEstimativa(lead.id)).rejects.toThrow(/estimativa/);
    await confirmarEstimativa(lead.id, "Rafael Lima");
    await expect(exigirEstimativa(lead.id)).resolves.toBeUndefined();
    const registro = await db.alteracao.findFirstOrThrow({ where: { leadId: lead.id, descricao: TEXTO_ESTIMATIVA.historico } });
    expect(registro.autor).toBe("Rafael Lima");
  });

  it("apresentação já realizada não é cancelada ao marcar outra para o mesmo lead", async () => {
    const [a] = await criarConsultores();
    const lead = await leadNaEtapa("+5588900009106", "negociacao", a.id);
    const antiga = await apresentacaoEm(lead.id, a.id, await diaDoMes(1), { concluidaEm: await diaDoMes(1, 12) });
    const [nova] = await horariosLivresParaLead(lead.id, 1, undefined, "apresentacao");
    await agendarVisita({ leadId: lead.id, inicio: nova.inicio, autor: "teste", tipo: "apresentacao", consultorId: a.id });
    const reg = await db.visita.findUniqueOrThrow({ where: { id: antiga.id } });
    expect(reg.status).toBe("agendada");
    expect(reg.concluidaEm).not.toBeNull();
    expect(await db.eventoMetrica.count({ where: { tipo: "nao_compareceu" } })).toBe(0);
  });
});

describe("apresentações de antes da mudança (conversão pelo histórico)", () => {
  it("preenche a conclusão de quem passou de Apresentação para Negociação/Fechado, uma vez só", async () => {
    const [a] = await criarConsultores();
    const feita = await leadNaEtapa("+5588900009200", "fechado", a.id);
    const vFeita = await apresentacaoEm(feita.id, a.id, await diaDoMes(1));
    const quando = new Date(vFeita.inicio.getTime() + 3_600_000);
    await db.mudancaEtapa.create({ data: { leadId: feita.id, de: "apresentacao", para: "fechado", autor: "Rafael", criadoEm: quando } });
    // Está em Negociação mas nunca passou pela Apresentação no histórico (entrou direto): não converte.
    const direto = await leadNaEtapa("+5588900009201", "negociacao", a.id);
    await apresentacaoEm(direto.id, a.id, await diaDoMes(1, 15));
    // Ainda na Apresentação: não converte.
    const aindaLa = await leadNaEtapa("+5588900009202", "apresentacao", a.id);
    await apresentacaoEm(aindaLa.id, a.id, await diaDoMes(1, 16));

    expect(await converterApresentacoesAntigas()).toBe(1);
    expect((await db.visita.findUniqueOrThrow({ where: { id: vFeita.id } })).concluidaEm?.getTime()).toBe(quando.getTime());
    expect(await converterApresentacoesAntigas()).toBe(0);
  });
});
