import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { avaliarLimiteDoBot, LIMITE_POR_DIA, LIMITE_POR_MINUTO } from "@/regras/limite-bot";
import { registrarUso, resumoDeUso } from "@/servicos/uso-api";
import { GET as saude } from "@/app/api/saude/route";
import { limparBanco } from "./ajuda";

const cada = (n: number, deslocMs: number, base: Date) => Array.from({ length: n }, (_, i) => new Date(base.getTime() - deslocMs - i));

describe("limite de mensagens por cliente", () => {
  const base = new Date("2026-11-03T15:00:00Z");
  it("não bloqueia conversa normal", () => {
    expect(avaliarLimiteDoBot(cada(5, 1000, base), base).excedeu).toBe(false);
  });
  it("bloqueia rajada em 1 minuto", () => {
    const r = avaliarLimiteDoBot(cada(LIMITE_POR_MINUTO + 1, 1000, base), base);
    expect(r.excedeu).toBe(true);
    expect(r.motivo).toMatch(/minuto/);
  });
  it("mensagens antigas (fora do minuto) não contam para o limite por minuto", () => {
    expect(avaliarLimiteDoBot(cada(LIMITE_POR_MINUTO + 5, 5 * 60_000, base), base).excedeu).toBe(false);
  });
  it("bloqueia excesso em 24 horas", () => {
    const horas = Array.from({ length: LIMITE_POR_DIA + 1 }, (_, i) => new Date(base.getTime() - (i + 2) * 60_000));
    const r = avaliarLimiteDoBot(horas, base);
    expect(r.excedeu).toBe(true);
    expect(r.motivo).toMatch(/24 horas/);
  });
});

describe("uso da API e saúde", () => {
  beforeEach(limparBanco);
  it("soma o uso dos últimos 30 dias e ignora o mais antigo", async () => {
    await db.usoApi.deleteMany();
    await registrarUso({ input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 500, cache_creation_input_tokens: 0 });
    await registrarUso({ input_tokens: 50, output_tokens: 10 });
    await db.usoApi.create({ data: { criadoEm: new Date((await agora()).getTime() - 40 * 86_400_000), entrada: 999, saida: 999 } });
    const r = await resumoDeUso(30);
    expect(r).toMatchObject({ chamadas: 2, entrada: 150, saida: 30, cacheLeitura: 500 });
  });
  it("rota de saúde responde ok sem expor dados", async () => {
    const resposta = await saude();
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
  });
});

describe("bot pausa quando o cliente abusa", () => {
  beforeEach(limparBanco);
  it("não chama a API, passa para um humano e avisa o motivo", async () => {
    const { responderCliente } = await import("@/bot/atendimento");
    const { obterOuCriarLead } = await import("@/servicos/leads");
    const { registrarMensagemCliente } = await import("@/servicos/mensagens");
    const lead = await obterOuCriarLead("+5588900007777", "Spam");
    for (let i = 0; i < LIMITE_POR_MINUTO + 2; i++) await registrarMensagemCliente(lead.id, `oi ${i}`);
    const r = await responderCliente(lead.id);
    expect(r.erro).toMatch(/pausou/);
    const depois = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(depois.aguardandoHumano).toBe(true);
    expect(await db.usoApi.count()).toBe(0);
  });
  it("cliente que pediu para parar não recebe resposta do bot", async () => {
    const { responderCliente } = await import("@/bot/atendimento");
    const { obterOuCriarLead } = await import("@/servicos/leads");
    const lead = await obterOuCriarLead("+5588900008888", "Fulano");
    await db.lead.update({ where: { id: lead.id }, data: { naoReceberEm: new Date() } });
    const r = await responderCliente(lead.id);
    expect(r.respostas).toEqual([]);
    expect(r.erro).toBeUndefined();
  });
});
