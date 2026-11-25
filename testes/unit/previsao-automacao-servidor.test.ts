import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A rota do kanban confere o login; aqui o perfil de quem pede é escolhido em cada teste.
vi.mock("@/lib/sessao", async (original) => ({ ...(await original<typeof import("@/lib/sessao")>()), exigirUsuario: vi.fn() }));

import { GET } from "@/app/api/kanban/route";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { REGRAS_ARQUIVAR_PADRAO } from "@/regras/arquivar-perdido";
import { previsaoDeJson, type PrevisaoCard } from "@/regras/previsao-automacao";
import { REGRAS_RECUPERACAO_PADRAO } from "@/regras/recuperacao";
import { dataLocal } from "@/regras/tempo";
import { definirRegrasDaRedeDeSeguranca, definirRegrasDeArquivarPerdido, definirRegrasDeRecuperacao } from "@/servicos/configuracoes";
import { moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { previsoesDoKanban } from "@/servicos/previsao-automacao";
import { rodarRotinas } from "@/servicos/rotinas";
import { limparBanco } from "./ajuda";

const dia = (d: number, h: number, m = 0) => dataLocal(2026, 11, d, h, m);

async function em(quando: Date) {
  vi.setSystemTime(quando);
  await rodarRotinas();
}
const ler = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });
const previsao = async (id: string, quando: Date): Promise<PrevisaoCard> => previsaoDeJson((await previsoesDoKanban(quando))[id]);

/** Lead que escreveu segunda 9h e foi respondido pelo bot às 9h01. */
async function montarLead(telefone: string) {
  vi.setSystemTime(dia(9, 9, 0));
  const lead = await obterOuCriarLead(telefone);
  await db.lead.update({ where: { id: lead.id }, data: { nome: "Maria da Silva" } });
  await registrarMensagemCliente(lead.id, "Oi, quero uma cozinha");
  vi.setSystemTime(dia(9, 9, 1));
  await enviarMensagemLoja({ leadId: lead.id, autor: "bot", texto: "Olá! Qual ambiente você quer fazer?" });
  return lead.id;
}

async function ligarTudo() {
  await definirRegrasDeRecuperacao({ ...REGRAS_RECUPERACAO_PADRAO, ligado: true, segundaModo: "horas", segundaHoras: 4 });
  await definirRegrasDaRedeDeSeguranca({ ligado: true, dias: 5 });
  await definirRegrasDeArquivarPerdido({ ...REGRAS_ARQUIVAR_PADRAO, ligado: true });
}

describe("acompanhamento da automação: servidor (tarefa 48)", () => {
  beforeEach(async () => {
    await limparBanco();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(exigirUsuario).mockReset();
  });

  it("só o admin recebe 'automacao' na rota do kanban; para o consultor o campo nem existe", async () => {
    await ligarTudo();
    const id = await montarLead("+5588900000201");
    vi.setSystemTime(dia(9, 9, 10));
    vi.mocked(exigirUsuario).mockResolvedValue({ id: "u1", nome: "Admin", perfil: "admin" });
    const admin = await (await GET()).json();
    expect(Object.keys(admin.automacao)).toContain(id);
    expect(admin.automacao[id]).toMatchObject({ coluna: "novo", tipo: "primeira" });

    vi.mocked(exigirUsuario).mockResolvedValue({ id: "u2", nome: "Rafael", perfil: "consultor" });
    const consultor = await (await GET()).json();
    expect(consultor).not.toHaveProperty("automacao");
    expect(JSON.stringify(consultor)).not.toMatch(/Vai para Perdido|travado|automacao/);
    expect(consultor.cards.length).toBe(admin.cards.length); // o resto da resposta continua igual
  });

  it("os dados do card só trazem as colunas IA atendendo e Perdido, e nunca leads arquivados", async () => {
    await ligarTudo();
    const novo = await montarLead("+5588900000202");
    const medicao = await montarLead("+5588900000203");
    await db.lead.update({ where: { id: medicao }, data: { etapa: "medicao" } });
    const arquivado = await montarLead("+5588900000204");
    await db.lead.update({ where: { id: arquivado }, data: { arquivadoEm: dia(9, 9, 5) } });
    const previsoes = await previsoesDoKanban(dia(9, 9, 10));
    expect(Object.keys(previsoes)).toEqual([novo]);
  });

  it("o card realmente se move na hora que a linha mostrava: 1ª, 2ª, Perdido e arquivo", async () => {
    await ligarTudo();
    const id = await montarLead("+5588900000205");
    const mensagens = () => db.mensagem.count({ where: { leadId: id, autorNome: "Recuperação automática" } });

    // 1ª mensagem: 9h31.
    let p = await previsao(id, dia(9, 9, 10));
    expect(p).toMatchObject({ tipo: "primeira", quando: dia(9, 9, 31) });
    await em(new Date(p.quando!.getTime() - 60_000));
    expect(await mensagens()).toBe(0);
    await em(p.quando!);
    expect(await mensagens()).toBe(1);

    // 2ª mensagem: 4 h depois.
    p = await previsao(id, dia(9, 9, 40));
    expect(p).toMatchObject({ tipo: "segunda", quando: dia(9, 13, 31) });
    await em(new Date(p.quando!.getTime() - 60_000));
    expect(await mensagens()).toBe(1);
    await em(p.quando!);
    expect(await mensagens()).toBe(2);

    // Perdido: 5 h depois da 2ª.
    p = await previsao(id, dia(9, 14, 0));
    expect(p).toMatchObject({ tipo: "perdido", quando: dia(9, 18, 31) });
    await em(new Date(p.quando!.getTime() - 60_000));
    expect((await ler(id)).etapa).toBe("novo");
    await em(p.quando!);
    const perdido = await ler(id);
    expect(perdido.etapa).toBe("perdido");

    // Na coluna Perdido: arquivo 7 dias depois (movido pelo sistema).
    p = await previsao(id, dia(9, 19, 0));
    expect(p).toMatchObject({ coluna: "perdido", tipo: "arquivo", quando: new Date(dia(9, 18, 31).getTime() + 7 * 24 * 3600_000) });
    await em(new Date(p.quando!.getTime() - 60_000));
    expect((await ler(id)).arquivadoEm).toBeNull();
    await em(p.quando!);
    expect((await ler(id)).arquivadoEm).not.toBeNull();
  });

  it("Perdido marcado por uma pessoa espera 60 dias; a previsão sabe quem moveu", async () => {
    await ligarTudo();
    const id = await montarLead("+5588900000206");
    vi.setSystemTime(dia(10, 8, 0));
    await moverEtapa(id, "perdido", "Ana", { guardarAnterior: true, semExigencias: true, dados: { motivoPerda: "preco" } });
    const p = await previsao(id, dia(10, 9, 0));
    expect(p).toMatchObject({ coluna: "perdido", tipo: "arquivo", quando: new Date(dia(10, 8, 0).getTime() + 60 * 24 * 3600_000) });
    await em(new Date(p.quando!.getTime() - 60_000));
    expect((await ler(id)).arquivadoEm).toBeNull();
    await em(p.quando!);
    expect((await ler(id)).arquivadoEm).not.toBeNull();
  });

  it("automação desligada: o servidor devolve 'desligada' e a rotina de fato não mexe", async () => {
    const id = await montarLead("+5588900000207");
    expect((await previsao(id, dia(9, 10, 0))).tipo).toBe("desligada");
    await em(dia(20, 8, 0));
    expect((await ler(id)).etapa).toBe("novo");
  });
});
