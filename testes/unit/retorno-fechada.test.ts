import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executarFerramenta } from "@/bot/executor";
import { db } from "@/lib/db";
import { REGRAS_AGENDA_PADRAO } from "@/regras/agenda";
import { BOTAO_CONTINUAR, BOTAO_SEM_INTERESSE, MODELOS, buscarModelo } from "@/regras/modelos";
import { recusouPeloBotao } from "@/regras/optout";
import { proximaAbertura, situacaoDaLoja } from "@/regras/presenca";
import { REGRAS_RETORNO_PADRAO, horarioDoRetorno, validarRegrasRetorno } from "@/regras/retorno-fechada";
import { dataLocal } from "@/regras/tempo";
import { extrairEventos } from "@/regras/whatsapp";
import { definirRegrasDeRetorno } from "@/servicos/configuracoes";
import { receberMensagemCliente } from "@/servicos/conversa";
import { obterOuCriarLead } from "@/servicos/leads";
import { registrarMensagemCliente } from "@/servicos/mensagens";
import { rodarRotinas } from "@/servicos/rotinas";
import { criarUsuario } from "@/servicos/usuarios";
import { limparBanco } from "./ajuda";

// Sábado 07/11/2026 (loja 8h–12h), domingo fechado, segunda 09/11 (8h–18h). Horário de Fortaleza.
const sab = (h: number, m = 0) => dataLocal(2026, 11, 7, h, m);
const seg = (h: number, m = 0) => dataLocal(2026, 11, 9, h, m);
const A = REGRAS_AGENDA_PADRAO;
const R = REGRAS_RETORNO_PADRAO;

describe("retorno com a loja fechada: regras puras", () => {
  it("próxima abertura: sábado à tarde e domingo vão para segunda 8h; madrugada vai para as 8h do mesmo dia", () => {
    expect(proximaAbertura(sab(15), A).getTime()).toBe(seg(8).getTime());
    expect(proximaAbertura(dataLocal(2026, 11, 8, 10), A).getTime()).toBe(seg(8).getTime());
    expect(proximaAbertura(seg(3), A).getTime()).toBe(seg(8).getTime());
    expect(proximaAbertura(seg(10), A).getTime()).toBe(dataLocal(2026, 11, 10, 8).getTime());
  });

  it("o bot lê a data, a hora e a situação da loja", () => {
    expect(situacaoDaLoja(sab(15, 20), A)).toBe("agora: sábado 07/11 15:20; loja fechada; reabre segunda 09/11 08:00");
    expect(situacaoDaLoja(seg(10, 5), A)).toBe("agora: segunda 09/11 10:05; loja aberta; fecha hoje às 18:00");
  });

  it("horário pedido vale só no futuro e com a loja aberta; senão a reabertura mais X min", () => {
    expect(horarioDoRetorno(seg(9), sab(15), R, A)).toEqual({ quando: seg(9), usouPadrao: false });
    expect(horarioDoRetorno(dataLocal(2026, 11, 8, 10), sab(15), R, A).quando.getTime()).toBe(seg(8, 30).getTime()); // domingo
    expect(horarioDoRetorno(sab(14), sab(15), R, A).quando.getTime()).toBe(seg(8, 30).getTime()); // passado
    expect(horarioDoRetorno(null, sab(15), R, A)).toEqual({ quando: seg(8, 30), usouPadrao: true });
    expect(horarioDoRetorno(null, sab(15), { ...R, semHorarioMin: 0 }, A).quando.getTime()).toBe(seg(8).getTime());
  });

  it("valida as regras", () => {
    expect(validarRegrasRetorno(R)).toBeNull();
    expect(validarRegrasRetorno({ ...R, modelo: "nao_existe" })).not.toBeNull();
    expect(validarRegrasRetorno({ ...R, semHorarioMin: 999 })).not.toBeNull();
  });

  it("o modelo novo tem o texto aprovado e os dois botões; o botão 'não tenho interesse' vale como parar", () => {
    const m = buscarModelo("retorno_atendimento");
    expect(m?.botoes).toEqual([BOTAO_CONTINUAR, BOTAO_SEM_INTERESSE]);
    expect(m?.texto).toContain("Responda PARAR para não receber mais mensagens.");
    expect(MODELOS.filter((x) => x.botoes).length).toBe(1);
    expect(recusouPeloBotao("Não tenho interesse")).toBe(true);
    expect(recusouPeloBotao("quero continuar")).toBe(false);
  });

  it("o toque no botão do modelo chega do webhook como mensagem de texto do cliente", () => {
    const evento = extrairEventos({ entry: [{ changes: [{ value: { messages: [{ id: "w1", from: "5588900000001", type: "button", button: { text: "Não tenho interesse", payload: "x" } }] } }] }] });
    expect(evento.mensagens[0]).toMatchObject({ texto: "Não tenho interesse", tipo: "button" });
  });
});

async function montar() {
  const ana = await criarUsuario({ nome: "Ana", login: "ana", senha: "Ana12345", perfil: "consultor" });
  const rui = await criarUsuario({ nome: "Rui", login: "rui", senha: "Rui12345", perfil: "consultor" });
  return { ana, rui };
}

/** Lead que escreveu no sábado 15h (janela de 24h fecha no domingo 15h). */
async function leadDoSabado(telefone: string, consultorId: string | null) {
  vi.setSystemTime(sab(15));
  const lead = await obterOuCriarLead(telefone);
  await registrarMensagemCliente(lead.id, "Oi, quero uma cozinha");
  return db.lead.update({ where: { id: lead.id }, data: { consultorId, etapa: "qualificacao", modoAtendimento: "pausado" } });
}

const lerLead = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });
const modelosEnviados = (id: string) => db.mensagem.count({ where: { leadId: id, modelo: "retorno_atendimento" } });

describe("retorno com a loja fechada: ferramenta e rotina", () => {
  beforeEach(async () => {
    await limparBanco();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("registrar_retorno grava o retorno e a nota; horário com a loja fechada vira reabertura mais 30 min", async () => {
    const lead = await leadDoSabado("+5588900000031", null);
    const ok = await executarFerramenta(lead.id, "registrar_retorno", { quando: "2026-11-09 09:00", nota: "Pediu contato segunda de manhã" });
    expect(ok.erro).toBeUndefined();
    let l = await lerLead(lead.id);
    expect(l.proximoContatoEm?.getTime()).toBe(seg(9).getTime());
    expect(l.lembreteNota).toBe("Pediu contato segunda de manhã");
    expect(l.retornoModeloEm?.getTime()).toBe(seg(9).getTime());

    const outro = await leadDoSabado("+5588900000032", null);
    await executarFerramenta(outro.id, "registrar_retorno", { quando: "2026-11-08 10:00", nota: "Disse domingo" });
    l = await lerLead(outro.id);
    expect(l.proximoContatoEm?.getTime()).toBe(seg(8, 30).getTime());
    expect(l.lembreteNota).toBe("Disse domingo");
  });

  it("registrar_retorno não sobrescreve retorno já marcado, nem aceita formato inválido", async () => {
    const lead = await leadDoSabado("+5588900000033", null);
    await db.lead.update({ where: { id: lead.id }, data: { proximoContatoEm: seg(15) } });
    await executarFerramenta(lead.id, "registrar_retorno", { quando: "2026-11-09 09:00", nota: "Prefere de manhã" });
    const l = await lerLead(lead.id);
    expect(l.proximoContatoEm?.getTime()).toBe(seg(15).getTime());
    expect(l.lembreteNota).toBe("Prefere de manhã");
    expect(l.retornoModeloEm).toBeNull();
    const ruim = await executarFerramenta(lead.id, "registrar_retorno", { quando: "segunda cedo", nota: "x" });
    expect(ruim.erro).toBe(true);
  });

  it("na segunda o modelo sai sozinho, só com dono online (passa para quem está online), uma vez só", async () => {
    const { ana, rui } = await montar();
    const lead = await leadDoSabado("+5588900000034", ana.id);
    await executarFerramenta(lead.id, "registrar_retorno", { nota: "Sem horário" }); // reabertura + 30 min = segunda 8h30
    await db.usuario.update({ where: { id: ana.id }, data: { status: "offline" } });
    await db.usuario.update({ where: { id: rui.id }, data: { status: "online" } });
    vi.setSystemTime(seg(8, 29));
    await rodarRotinas();
    expect(await modelosEnviados(lead.id)).toBe(0);
    vi.setSystemTime(seg(8, 31));
    await rodarRotinas();
    await rodarRotinas();
    expect(await modelosEnviados(lead.id)).toBe(1);
    const l = await lerLead(lead.id);
    expect(l.consultorId).toBe(rui.id);
    expect(l.retornoModeloEm).toBeNull();
  });

  it("dono online recebe o envio sem trocar de dono", async () => {
    const { ana } = await montar();
    const lead = await leadDoSabado("+5588900000035", ana.id);
    await executarFerramenta(lead.id, "registrar_retorno", { nota: "x" });
    await db.usuario.updateMany({ data: { status: "online" } });
    vi.setSystemTime(seg(8, 31));
    await rodarRotinas();
    expect(await modelosEnviados(lead.id)).toBe(1);
    expect((await lerLead(lead.id)).consultorId).toBe(ana.id);
  });

  it("ninguém online: o modelo espera, todos recebem um aviso, e sai quando alguém fica online", async () => {
    const { ana } = await montar();
    const lead = await leadDoSabado("+5588900000036", ana.id);
    await executarFerramenta(lead.id, "registrar_retorno", { nota: "x" });
    await db.usuario.updateMany({ data: { status: "offline" } });
    vi.setSystemTime(seg(8, 40));
    await rodarRotinas();
    await rodarRotinas();
    expect(await modelosEnviados(lead.id)).toBe(0);
    const avisos = await db.alerta.findMany({ where: { tipo: "retorno_sem_online" } });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].paraTodos).toBe(true);
    await db.usuario.update({ where: { id: ana.id }, data: { status: "online" } });
    vi.setSystemTime(seg(8, 45));
    await rodarRotinas();
    expect(await modelosEnviados(lead.id)).toBe(1);
  });

  it("nunca envia a quem pediu para parar, nem com a janela aberta, nem com o envio automático desligado, nem se a data foi trocada", async () => {
    const { ana } = await montar();
    await db.usuario.updateMany({ data: { status: "online" } });
    const parou = await leadDoSabado("+5588900000037", ana.id);
    await executarFerramenta(parou.id, "registrar_retorno", { nota: "x" });
    await db.lead.update({ where: { id: parou.id }, data: { naoReceberEm: sab(16) } });
    const trocou = await leadDoSabado("+5588900000038", ana.id);
    await executarFerramenta(trocou.id, "registrar_retorno", { nota: "x" });
    await db.lead.update({ where: { id: trocou.id }, data: { proximoContatoEm: seg(10) } });
    vi.setSystemTime(seg(10, 5));
    await rodarRotinas();
    expect(await modelosEnviados(parou.id)).toBe(0);
    expect(await modelosEnviados(trocou.id)).toBe(0);

    await definirRegrasDeRetorno({ ...R, automatico: false });
    const manual = await leadDoSabado("+5588900000039", ana.id);
    await executarFerramenta(manual.id, "registrar_retorno", { nota: "x" });
    vi.setSystemTime(dataLocal(2026, 11, 10, 9));
    await rodarRotinas();
    expect(await modelosEnviados(manual.id)).toBe(0);

    await definirRegrasDeRetorno(R);
    const aberta = await leadDoSabado("+5588900000040", ana.id);
    await executarFerramenta(aberta.id, "registrar_retorno", { nota: "x" });
    await db.lead.update({ where: { id: aberta.id }, data: { ultimaMsgClienteEm: dataLocal(2026, 11, 10, 8, 50) } }); // cliente escreveu agora há pouco
    vi.setSystemTime(dataLocal(2026, 11, 10, 9, 10));
    await rodarRotinas();
    expect(await modelosEnviados(aberta.id)).toBe(0);
  });

  it("'Não tenho interesse' (botão) vale como parar", async () => {
    const pelo = await receberMensagemCliente({ telefone: "+5588900000041", texto: "Não tenho interesse", botao: true });
    expect(pelo.respostas).toEqual([]);
    expect((await db.lead.findUniqueOrThrow({ where: { id: pelo.leadId } })).naoReceberEm).not.toBeNull();
  });
});
