import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { REGRAS_AGENDA_PADRAO } from "@/regras/agenda";
import { REGRAS_PRESENCA_PADRAO, aberturaAtual, filaPodeSerEntregue, leadNovoPodeTerDono, lojaAberta, resumirItensDoDia, ultimoFechamento, validarRegrasPresenca } from "@/regras/presenca";
import { dataLocal } from "@/regras/tempo";
import { alertasDesde } from "@/servicos/alertas";
import { definirRegrasDePresenca } from "@/servicos/configuracoes";
import { definirStatusConsultor, escolherProximoConsultor } from "@/servicos/distribuicao";
import { obterOuCriarLead } from "@/servicos/leads";
import { passarOsDeHoje, rodarPresenca } from "@/servicos/presenca";
import { criarUsuario } from "@/servicos/usuarios";
import { limparBanco } from "./ajuda";

// Datas de teste: segunda 09/11/2026 (loja 8h–18h), sábado 14/11 (8h–12h), domingo 15/11 (fechado). Horário de Fortaleza.
const seg = (h: number, m = 0) => dataLocal(2026, 11, 9, h, m);
const sab = (h: number, m = 0) => dataLocal(2026, 11, 14, h, m);
const dom = (h: number) => dataLocal(2026, 11, 15, h);
const A = REGRAS_AGENDA_PADRAO;
const R = REGRAS_PRESENCA_PADRAO;

describe("presença: regras puras", () => {
  it("loja aberta só no expediente da agenda (sábado até meio-dia, domingo fechado)", () => {
    expect(lojaAberta(seg(7, 59), A)).toBe(false);
    expect(lojaAberta(seg(8), A)).toBe(true);
    expect(lojaAberta(seg(17, 59), A)).toBe(true);
    expect(lojaAberta(seg(18), A)).toBe(false);
    expect(lojaAberta(sab(11, 59), A)).toBe(true);
    expect(lojaAberta(sab(12), A)).toBe(false);
    expect(lojaAberta(dom(10), A)).toBe(false);
  });

  it("último fechamento: dia de semana 18h; fim de semana, sábado ao meio-dia", () => {
    expect(ultimoFechamento(seg(19), A)?.getTime()).toBe(seg(18).getTime());
    expect(ultimoFechamento(seg(3), A)?.getTime()).toBe(dataLocal(2026, 11, 7, 12).getTime()); // madrugada de segunda → sábado 12h
    expect(ultimoFechamento(dom(15), A)?.getTime()).toBe(sab(12).getTime());
    expect(aberturaAtual(seg(10), A)?.getTime()).toBe(seg(8).getTime());
    expect(aberturaAtual(seg(19), A)).toBeNull();
  });

  it("a fila só é entregue depois do horário de repartir; fechada, nunca; sem repartir, assim que a loja abre", () => {
    expect(filaPodeSerEntregue(seg(8, 14), R, A)).toBe(false);
    expect(filaPodeSerEntregue(seg(8, 15), R, A)).toBe(true);
    expect(filaPodeSerEntregue(seg(19), R, A)).toBe(false);
    expect(filaPodeSerEntregue(seg(8, 1), { ...R, repartirFila: false }, A)).toBe(true);
    expect(filaPodeSerEntregue(seg(19), { ...R, desligarNoFechamento: false, repartirFila: false }, A)).toBe(true);
  });

  it("lead novo fora do horário fica sem dono; com a opção desligada, vale como antes", () => {
    expect(leadNovoPodeTerDono(seg(20), R, A)).toBe(false);
    expect(leadNovoPodeTerDono(seg(8, 5), R, A)).toBe(true);
    expect(leadNovoPodeTerDono(seg(20), { ...R, desligarNoFechamento: false }, A)).toBe(true);
  });

  it("resume os itens do dia e valida os minutos", () => {
    expect(resumirItensDoDia([{ tipo: "retorno", inicio: seg(10) }, { tipo: "medicao", inicio: seg(14) }, { tipo: "visita", inicio: seg(9) }, { tipo: "retorno", inicio: seg(11) }])).toBe("visita 9h, medição 14h, 2 retornos");
    expect(validarRegrasPresenca(R)).toBeNull();
    expect(validarRegrasPresenca({ ...R, repartirMin: -1 })).not.toBeNull();
    expect(validarRegrasPresenca({ ...R, quemRecebe: "ninguem" as never })).not.toBeNull();
  });
});

async function montar() {
  const admin = await criarUsuario({ nome: "Mateus", login: "mateus", senha: "Mateus123", perfil: "admin" });
  const ana = await criarUsuario({ nome: "Ana", login: "ana", senha: "Ana12345", perfil: "consultor" });
  const rui = await criarUsuario({ nome: "Rui", login: "rui", senha: "Rui12345", perfil: "consultor" });
  return { admin, ana, rui };
}

async function leadNaFila(telefone: string) {
  const lead = await obterOuCriarLead(telefone);
  return db.lead.update({ where: { id: lead.id }, data: { consultorId: null, modoAtendimento: "humano", aguardandoHumano: true } });
}

async function visita(leadId: string, consultorId: string, inicio: Date, tipo = "visita") {
  return db.visita.create({ data: { leadId, consultorId, inicio, fim: new Date(inicio.getTime() + 3_600_000), tipo, vagaChave: `${tipo}|${consultorId}|${inicio.toISOString()}`, criadoPor: "teste", criadoEm: inicio } });
}

const statusDe = async (id: string) => (await db.usuario.findUniqueOrThrow({ where: { id } })).status;

describe("presença: fechamento, fila e verificação", () => {
  beforeEach(async () => {
    await limparBanco();
    await definirRegrasDePresenca(R); // liga tudo (o limparBanco deixa desligado)
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("no fechamento todos ficam offline uma vez; quem clica online depois continua online até o próximo fechamento", async () => {
    const { ana, rui } = await montar();
    vi.setSystemTime(seg(17, 59));
    await rodarPresenca();
    expect(await statusDe(ana.id)).toBe("online");
    vi.setSystemTime(seg(18, 1));
    await rodarPresenca();
    expect(await statusDe(ana.id)).toBe("offline");
    expect(await statusDe(rui.id)).toBe("offline");
    await definirStatusConsultor(ana.id, "online");
    vi.setSystemTime(seg(19));
    await rodarPresenca();
    expect(await statusDe(ana.id)).toBe("online");
    vi.setSystemTime(dataLocal(2026, 11, 10, 18, 1));
    await rodarPresenca();
    expect(await statusDe(ana.id)).toBe("offline");
  });

  it("lead que chega com a loja fechada fica sem dono, mesmo com vendedor online", async () => {
    const { ana } = await montar();
    vi.setSystemTime(seg(20));
    expect(await escolherProximoConsultor()).toBeNull();
    vi.setSystemTime(seg(9));
    expect(await escolherProximoConsultor()).toBe(ana.id);
  });

  it("ficar online antes do horário de repartir não puxa a fila; no horário a fila é repartida entre quem está online", async () => {
    const { ana, rui } = await montar();
    await db.usuario.updateMany({ data: { status: "offline" } });
    const leads = [await leadNaFila("+5588900000001"), await leadNaFila("+5588900000002"), await leadNaFila("+5588900000003")];
    vi.setSystemTime(seg(8, 5));
    await definirStatusConsultor(ana.id, "online");
    await definirStatusConsultor(rui.id, "online");
    expect(await db.lead.count({ where: { id: { in: leads.map((l) => l.id) }, consultorId: null } })).toBe(3);
    vi.setSystemTime(seg(8, 16));
    await rodarPresenca();
    const donos = await db.lead.findMany({ where: { id: { in: leads.map((l) => l.id) } }, select: { consultorId: true } });
    expect(donos.every((l) => l.consultorId)).toBe(true);
    expect(new Set(donos.map((l) => l.consultorId))).toEqual(new Set([ana.id, rui.id]));
  });

  it("com 'repartir' desligado, a fila vai para quem ficar online primeiro", async () => {
    const { ana } = await montar();
    await definirRegrasDePresenca({ ...R, repartirFila: false });
    await db.usuario.updateMany({ data: { status: "offline" } });
    const lead = await leadNaFila("+5588900000001");
    vi.setSystemTime(seg(8, 1));
    await definirStatusConsultor(ana.id, "online");
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).consultorId).toBe(ana.id);
  });

  it("verifica a presença: quem não ficou online e tem compromisso ou retorno hoje gera um aviso para todos, uma vez", async () => {
    const { admin, ana, rui } = await montar();
    const lead = await obterOuCriarLead("+5588900000010");
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: ana.id, etapa: "qualificacao", proximoContatoEm: seg(15) } });
    await visita(lead.id, ana.id, seg(9));
    await db.usuario.update({ where: { id: ana.id }, data: { status: "offline" } });
    vi.setSystemTime(seg(8, 29));
    await rodarPresenca();
    expect(await db.alerta.count({ where: { tipo: "ausencia" } })).toBe(0);
    vi.setSystemTime(seg(8, 31));
    await rodarPresenca();
    await rodarPresenca();
    const avisos = await db.alerta.findMany({ where: { tipo: "ausencia" } });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ leadNome: "Ana", leadId: ana.id, texto: "visita 9h, 1 retorno", paraTodos: true });
    expect((await alertasDesde(rui, 0)).eventos.map((e) => e.tipo)).toContain("ausencia");
    expect((await alertasDesde(admin, 0)).eventos.map((e) => e.tipo)).toContain("ausencia");
  });

  it("'só o administrador': o consultor não recebe o aviso de ausência", async () => {
    const { admin, ana, rui } = await montar();
    await definirRegrasDePresenca({ ...R, quemRecebe: "admin" });
    const lead = await obterOuCriarLead("+5588900000011");
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: ana.id } });
    await visita(lead.id, ana.id, seg(14));
    await db.usuario.update({ where: { id: ana.id }, data: { status: "offline" } });
    vi.setSystemTime(seg(8, 31));
    await rodarPresenca();
    expect((await alertasDesde(rui, 0)).eventos).toHaveLength(0);
    expect((await alertasDesde(ana, 0)).eventos).toHaveLength(0);
    expect((await alertasDesde(admin, 0)).eventos.map((e) => e.tipo)).toEqual(["ausencia"]);
  });

  it("vendedor offline sem nada para hoje não gera aviso; online com compromisso também não", async () => {
    const { ana, rui } = await montar();
    const lead = await obterOuCriarLead("+5588900000012");
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: rui.id } });
    await visita(lead.id, rui.id, seg(10));
    await db.usuario.update({ where: { id: ana.id }, data: { status: "offline" } });
    vi.setSystemTime(seg(8, 31));
    await rodarPresenca();
    expect(await db.alerta.count()).toBe(0);
  });

  it("compromisso cedo: avisa X min antes se o dono não está online, uma vez só", async () => {
    const { ana } = await montar();
    const lead = await obterOuCriarLead("+5588900000013");
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: ana.id } });
    await visita(lead.id, ana.id, seg(8));
    await db.usuario.update({ where: { id: ana.id }, data: { status: "offline" } });
    vi.setSystemTime(seg(7, 40));
    await rodarPresenca();
    expect(await db.alerta.count({ where: { tipo: "compromisso_cedo" } })).toBe(0);
    vi.setSystemTime(seg(7, 46));
    await rodarPresenca();
    await rodarPresenca();
    const avisos = await db.alerta.findMany({ where: { tipo: "compromisso_cedo" } });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].texto).toBe("visita às 08:00");
  });

  it("passar os de hoje: muda o dono dos leads e dos compromissos de hoje; o resto fica; horário ocupado do destino não é passado", async () => {
    const { ana, rui } = await montar();
    vi.setSystemTime(seg(9));
    const hoje = await obterOuCriarLead("+5588900000020");
    const amanha = await obterOuCriarLead("+5588900000021");
    const batida = await obterOuCriarLead("+5588900000022");
    const outro = await obterOuCriarLead("+5588900000023");
    for (const l of [hoje, amanha, batida, outro]) await db.lead.update({ where: { id: l.id }, data: { consultorId: ana.id, etapa: "qualificacao" } });
    await db.lead.update({ where: { id: outro.id }, data: { proximoContatoEm: seg(16) } });
    const vHoje = await visita(hoje.id, ana.id, seg(11));
    const vAmanha = await visita(amanha.id, ana.id, dataLocal(2026, 11, 10, 11));
    await visita(batida.id, ana.id, seg(14));
    await visita(outro.id, rui.id, seg(14)); // Rui já ocupado às 14h
    const r = await passarOsDeHoje(ana.id, rui.id, "Mateus");
    expect(r.passados).toBe(2); // hoje + outro (retorno de hoje)
    expect(r.conflitos).toHaveLength(1);
    const dono = async (id: string) => (await db.lead.findUniqueOrThrow({ where: { id } })).consultorId;
    expect(await dono(hoje.id)).toBe(rui.id);
    expect(await dono(outro.id)).toBe(rui.id);
    expect(await dono(amanha.id)).toBe(ana.id);
    expect(await dono(batida.id)).toBe(ana.id);
    expect((await db.visita.findUniqueOrThrow({ where: { id: vHoje.id } })).consultorId).toBe(rui.id);
    expect((await db.visita.findUniqueOrThrow({ where: { id: vAmanha.id } })).consultorId).toBe(ana.id);
    await expect(passarOsDeHoje(ana.id, ana.id, "Mateus")).rejects.toThrow(/diferente/);
  });
});
