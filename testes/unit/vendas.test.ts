import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { avancarRelogio, agora } from "@/lib/relogio";
import { DIA } from "@/regras/tempo";
import { faltaParaMover, formatarReais, lerDataHoraLocal, lerReais, partirDataHoraLocal, situacaoDoRetorno } from "@/regras/vendas";
import { alertasDesde, avisarRetornos } from "@/servicos/alertas";
import { retornosDeHoje } from "@/servicos/consultas";
import { dadosDoPainel } from "@/servicos/painel";
import { criarMotivo, definirExigirContatoNegociacao, editarMotivo, excluirMotivo, motivosDePerda, reordenarMotivos } from "@/servicos/vendas";
import { conferirMudanca, moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { criarConsultores, limparBanco } from "./ajuda";

const retorno = new Date("2026-11-10T14:00:00Z");

describe("dinheiro (Bloco 2)", () => {
  it("formata em reais", () => {
    expect(formatarReais(162100)).toBe("R$ 1.621,00");
    expect(formatarReais(5)).toBe("R$ 0,05");
    expect(formatarReais(123456789)).toBe("R$ 1.234.567,89");
    expect(formatarReais(null)).toBe("");
  });
  it("lê o que o vendedor digita", () => {
    expect(lerReais("1621")).toBe(162100);
    expect(lerReais("1.621,00")).toBe(162100);
    expect(lerReais("R$ 1.621,5")).toBe(162150);
    expect(lerReais("1.621")).toBe(162100);
    expect(lerReais("abc")).toBeNull();
    expect(lerReais("")).toBeNull();
    expect(lerReais("1,234")).toBeNull();
  });
  it("data e hora no horário de Fortaleza (UTC-3)", () => {
    expect(lerDataHoraLocal("2026-11-10", "14:30")?.toISOString()).toBe("2026-11-10T17:30:00.000Z");
    expect(lerDataHoraLocal("2026-02-31", "10:00")).toBeNull();
    expect(lerDataHoraLocal("", "10:00")).toBeNull();
    expect(partirDataHoraLocal("2026-11-10T17:30:00.000Z")).toEqual({ data: "2026-11-10", hora: "14:30" });
  });
  it("o que cada etapa exige", () => {
    expect(faltaParaMover("orcamento", {})).toMatch(/próximo contato/);
    expect(faltaParaMover("negociacao", { proximoContatoEm: retorno })).toBeNull();
    expect(faltaParaMover("fechado", {})).toMatch(/valor fechado/);
    expect(faltaParaMover("perdido", {})).toMatch(/motivo/);
    expect(faltaParaMover("perdido", { motivoPerda: "concorrente" })).toMatch(/concorrente/);
    expect(faltaParaMover("perdido", { motivoPerda: "concorrente", concorrente: "Todeschini" })).toBeNull();
    expect(faltaParaMover("perdido", { motivoPerda: "preco" })).toBeNull();
    expect(faltaParaMover("visita", {})).toBeNull();
  });
});

describe("mover etapa com dados de venda (Bloco 2)", () => {
  beforeEach(limparBanco);

  it("recusa Orçamento sem data e aceita com data", async () => {
    const lead = await obterOuCriarLead("+5588900000101");
    await expect(moverEtapa(lead.id, "orcamento", "Ana")).rejects.toThrow(/próximo contato/);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("novo");
    await moverEtapa(lead.id, "orcamento", "Ana", { dados: { proximoContatoEm: retorno, valorOrcamento: 162100 } });
    const a = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(a.etapa).toBe("orcamento");
    expect(a.proximoContatoEm?.toISOString()).toBe(retorno.toISOString());
    expect(a.valorOrcamento).toBe(162100);
  });

  it("de Orçamento para Negociação mantém a data; para Fechado exige o valor e limpa a data", async () => {
    const lead = await obterOuCriarLead("+5588900000102");
    await moverEtapa(lead.id, "orcamento", "Ana", { dados: { proximoContatoEm: retorno, valorOrcamento: 100000 } });
    await moverEtapa(lead.id, "negociacao", "Ana");
    await expect(moverEtapa(lead.id, "fechado", "Ana")).rejects.toThrow(/valor fechado/);
    await moverEtapa(lead.id, "fechado", "Ana", { dados: { valorFechado: 95000 } });
    const f = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(f.etapa).toBe("fechado");
    expect(f.proximoContatoEm).toBeNull();
    expect(f.valorFechado).toBe(95000);
    expect(f.valorOrcamento).toBe(100000);
  });

  it("Perdido exige motivo; concorrente exige nome; sair de Perdido limpa o motivo", async () => {
    const lead = await obterOuCriarLead("+5588900000103");
    await expect(moverEtapa(lead.id, "perdido", "Ana")).rejects.toThrow(/motivo/);
    await expect(moverEtapa(lead.id, "perdido", "Ana", { dados: { motivoPerda: "concorrente" } })).rejects.toThrow(/concorrente/);
    await moverEtapa(lead.id, "perdido", "Ana", { dados: { motivoPerda: "concorrente", concorrente: " Todeschini " } });
    const p = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect([p.motivoPerda, p.concorrente]).toEqual(["concorrente", "Todeschini"]);
    await moverEtapa(lead.id, "pronto", "Ana");
    const v = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect([v.motivoPerda, v.concorrente]).toEqual([null, null]);
  });

  it("conferirMudanca não grava nada; o retorno automático da retomada não exige dados", async () => {
    const lead = await obterOuCriarLead("+5588900000104");
    await expect(conferirMudanca(lead.id, "perdido", {})).rejects.toThrow(/motivo/);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("novo");
    await db.lead.update({ where: { id: lead.id }, data: { etapa: "sem_resposta", etapaAnterior: "orcamento" } });
    await moverEtapa(lead.id, "orcamento", "sistema", { semExigencias: true });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("orcamento");
  });

  it("troca a data e o valor sem mudar de etapa", async () => {
    const lead = await obterOuCriarLead("+5588900000105");
    await moverEtapa(lead.id, "orcamento", "Ana", { dados: { proximoContatoEm: retorno } });
    const nova = new Date("2026-11-12T13:00:00Z");
    await moverEtapa(lead.id, "orcamento", "Ana", { dados: { proximoContatoEm: nova, valorOrcamento: 250000 } });
    const a = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(a.proximoContatoEm?.toISOString()).toBe(nova.toISOString());
    expect(a.valorOrcamento).toBe(250000);
  });
});

describe("retornos e avisos (Bloco 2, tarefa 7)", () => {
  beforeEach(limparBanco);
  const admin = { id: "admin", perfil: "admin" };
  const MIN = 60_000;

  it("situação do retorno em relação a hoje", () => {
    const hoje = new Date("2026-11-10T15:00:00Z"); // 12h em Fortaleza
    expect(situacaoDoRetorno(null, hoje)).toBe("sem_data");
    expect(situacaoDoRetorno(new Date("2026-11-10T03:00:00Z"), hoje)).toBe("hoje"); // 00h local
    expect(situacaoDoRetorno(new Date("2026-11-10T02:59:00Z"), hoje)).toBe("atrasado"); // 23h59 de ontem
    expect(situacaoDoRetorno(new Date("2026-11-10T20:00:00Z"), hoje)).toBe("hoje"); // hora ainda não chegou, mas é hoje
    expect(situacaoDoRetorno(new Date("2026-11-11T03:00:00Z"), hoje)).toBe("futuro");
  });

  async function leadComRetorno(telefone: string, dono: string | null, emMin: number) {
    const lead = await obterOuCriarLead(telefone, "Cliente " + telefone.slice(-2));
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: dono } });
    const quando = new Date((await agora()).getTime() + emMin * MIN);
    await moverEtapa(lead.id, "orcamento", "teste", { dados: { proximoContatoEm: quando } });
    return lead.id;
  }

  it("avisa só na hora marcada, uma vez por data, o dono e o admin; trocar a data avisa de novo", async () => {
    const [a, b] = await criarConsultores();
    const id = await leadComRetorno("+5588900000201", a.id, 30);
    const { ultimoId } = await alertasDesde(admin);

    expect(await avisarRetornos()).toBe(0); // ainda falta
    await avancarRelogio(31 * MIN);
    expect(await avisarRetornos()).toBe(1);
    expect(await avisarRetornos()).toBe(0); // não repete

    const doAdmin = await alertasDesde(admin, ultimoId);
    expect(doAdmin.eventos).toHaveLength(1);
    expect(doAdmin.eventos[0]).toMatchObject({ tipo: "retorno", leadId: id });
    expect((await alertasDesde({ id: a.id, perfil: "consultor" }, ultimoId)).eventos).toHaveLength(1);
    expect((await alertasDesde({ id: b.id, perfil: "consultor" }, ultimoId)).eventos).toHaveLength(0);

    // Marcou outra data: novo aviso quando chegar.
    const nova = new Date((await agora()).getTime() + 10 * MIN);
    await moverEtapa(id, "orcamento", "teste", { dados: { proximoContatoEm: nova } });
    expect(await avisarRetornos()).toBe(0);
    await avancarRelogio(11 * MIN);
    expect(await avisarRetornos()).toBe(1);
  });

  it("não avisa lead arquivado nem fora de Orçamento/Negociação", async () => {
    const [a] = await criarConsultores();
    const id = await leadComRetorno("+5588900000202", a.id, -5);
    await db.lead.update({ where: { id }, data: { arquivadoEm: await agora() } });
    expect(await avisarRetornos()).toBe(0);
    await db.lead.update({ where: { id }, data: { arquivadoEm: null } });
    await moverEtapa(id, "perdido", "teste", { dados: { motivoPerda: "preco" } });
    expect(await avisarRetornos()).toBe(0);
  });

  it("lista Retornos de hoje: atrasados primeiro, sem data por último, consultor vê só os seus", async () => {
    const [a, b] = await criarConsultores();
    const hoje = await leadComRetorno("+5588900000203", a.id, 0);
    const atrasado = await leadComRetorno("+5588900000204", a.id, 0);
    await db.lead.update({ where: { id: atrasado }, data: { proximoContatoEm: new Date((await agora()).getTime() - 2 * DIA) } });
    const futuro = await leadComRetorno("+5588900000205", a.id, 3 * 24 * 60);
    const semData = await obterOuCriarLead("+5588900000206");
    await db.lead.update({ where: { id: semData.id }, data: { etapa: "negociacao", consultorId: a.id } });
    const doOutro = await leadComRetorno("+5588900000207", b.id, 0);

    const lista = await retornosDeHoje({ id: a.id, perfil: "consultor" });
    expect(lista.map((l) => l.id)).toEqual([atrasado, hoje, semData.id]);
    expect(lista.map((l) => l.situacao)).toEqual(["atrasado", "hoje", "sem_data"]);
    expect(lista.map((l) => l.id)).not.toContain(futuro);
    expect((await retornosDeHoje(admin)).map((l) => l.id)).toContain(doOutro);
  });
});

describe("painel de vendas (Bloco 2, tarefa 8)", () => {
  beforeEach(limparBanco);
  const amanha = () => new Date(Date.now() + DIA);

  it("soma em negociação (agora) e vendido (no período), por vendedor, e conta os motivos de perda", async () => {
    const [a, b] = await criarConsultores();
    const novo = async (tel: string, dono: string) => {
      const l = await obterOuCriarLead(tel, "X");
      await db.lead.update({ where: { id: l.id }, data: { consultorId: dono } });
      return l.id;
    };
    const o1 = await novo("+5588900000301", a.id);
    await moverEtapa(o1, "orcamento", "t", { dados: { proximoContatoEm: amanha(), valorOrcamento: 162100 } });
    const o2 = await novo("+5588900000302", a.id);
    await moverEtapa(o2, "negociacao", "t", { dados: { proximoContatoEm: amanha(), valorOrcamento: 100000 } });
    const o3 = await novo("+5588900000303", b.id);
    await moverEtapa(o3, "orcamento", "t", { dados: { proximoContatoEm: amanha() } }); // sem valor
    const f1 = await novo("+5588900000304", a.id);
    await moverEtapa(f1, "fechado", "t", { dados: { valorFechado: 250000 } });
    const f2 = await novo("+5588900000305", b.id);
    await moverEtapa(f2, "fechado", "t", { dados: { valorFechado: 50000 } });
    const p1 = await novo("+5588900000306", a.id);
    await moverEtapa(p1, "perdido", "t", { dados: { motivoPerda: "concorrente", concorrente: "Todeschini" } });
    const p2 = await novo("+5588900000307", a.id);
    await moverEtapa(p2, "perdido", "t", { dados: { motivoPerda: "preco" } });

    const geral = (await dadosDoPainel({ atalho: "hoje" })).vendas;
    expect(geral.emNegociacao).toEqual({ quantidade: 3, total: 262100, semValor: 1 });
    expect(geral.vendido).toEqual({ quantidade: 2, total: 300000 });
    expect(geral.perdidos.quantidade).toBe(2);
    expect(geral.perdidos.motivos.map((m) => [m.codigo, m.total])).toEqual([["preco", 1], ["concorrente", 1]]);
    expect(geral.perdidos.motivos.find((m) => m.codigo === "concorrente")?.detalhes).toEqual(["Todeschini"]);

    const doA = (await dadosDoPainel({ atalho: "hoje", vendedorId: a.id })).vendas;
    expect(doA.emNegociacao.total).toBe(262100);
    expect(doA.vendido.total).toBe(250000);
    expect((await dadosDoPainel({ atalho: "hoje", vendedorId: b.id })).vendas.vendido.total).toBe(50000);
  });

  it("venda fechada fora do período não entra no total vendido", async () => {
    const [a] = await criarConsultores();
    const l = await obterOuCriarLead("+5588900000308", "Y");
    await db.lead.update({ where: { id: l.id }, data: { consultorId: a.id } });
    await moverEtapa(l.id, "fechado", "t", { dados: { valorFechado: 99900 } });
    await db.mudancaEtapa.updateMany({ where: { leadId: l.id, para: "fechado" }, data: { criadoEm: new Date(Date.now() - 40 * DIA) } });
    expect((await dadosDoPainel({ atalho: "hoje" })).vendas.vendido).toEqual({ quantidade: 0, total: 0 });
  });
});

describe("configurar vendas (Bloco 2, tarefa 9)", () => {
  beforeEach(limparBanco);

  it("começa com os 5 motivos de fábrica, na ordem", async () => {
    expect((await motivosDePerda()).map((m) => m.nome)).toEqual(["Preço", "Prazo", "Concorrente", "Desistiu", "Outro"]);
  });

  it("Negociação deixa de exigir o próximo contato quando o admin desliga; Orçamento continua exigindo", async () => {
    const lead = await obterOuCriarLead("+5588900000401");
    await expect(moverEtapa(lead.id, "negociacao", "t")).rejects.toThrow(/próximo contato/);
    await definirExigirContatoNegociacao(false);
    await moverEtapa(lead.id, "negociacao", "t");
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe("negociacao");
    const outro = await obterOuCriarLead("+5588900000402");
    await expect(moverEtapa(outro.id, "orcamento", "t")).rejects.toThrow(/próximo contato/);
    // Sem data e sem obrigação: não vira cobrança na lista de hoje.
    expect((await retornosDeHoje(admin)).map((l) => l.id)).not.toContain(lead.id);
    await definirExigirContatoNegociacao(true);
    expect((await retornosDeHoje(admin)).map((l) => l.id)).toContain(lead.id);
  });

  const admin = { id: "admin", perfil: "admin" };

  it("motivo novo, com pergunta, vale ao perder; renomear não perde o histórico", async () => {
    await criarMotivo({ nome: "Sem crédito", pergunta: "Qual banco?" });
    const novo = (await motivosDePerda()).find((m) => m.nome === "Sem crédito")!;
    const lead = await obterOuCriarLead("+5588900000403");
    await expect(moverEtapa(lead.id, "perdido", "t", { dados: { motivoPerda: novo.codigo } })).rejects.toThrow(/Qual banco/);
    await moverEtapa(lead.id, "perdido", "t", { dados: { motivoPerda: novo.codigo, concorrente: "Banco X" } });
    await editarMotivo(novo.codigo, { nome: "Crédito negado" });
    const painel = (await dadosDoPainel({ atalho: "hoje" })).vendas.perdidos.motivos;
    expect(painel).toEqual([{ codigo: novo.codigo, nome: "Crédito negado", total: 1, detalhes: ["Banco X"] }]);
  });

  it("motivo desativado não pode ser escolhido, mas continua nos números; em uso não se exclui", async () => {
    const preco = (await motivosDePerda()).find((m) => m.codigo === "preco")!;
    const lead = await obterOuCriarLead("+5588900000404");
    await moverEtapa(lead.id, "perdido", "t", { dados: { motivoPerda: "preco" } });
    await editarMotivo("preco", { ativo: false });
    const outro = await obterOuCriarLead("+5588900000405");
    await expect(moverEtapa(outro.id, "perdido", "t", { dados: { motivoPerda: "preco" } })).rejects.toThrow(/motivo/);
    expect((await dadosDoPainel({ atalho: "hoje" })).vendas.perdidos.motivos.find((m) => m.codigo === "preco")?.total).toBe(1);
    await expect(excluirMotivo(preco.codigo)).rejects.toThrow(/Desative/);
    await excluirMotivo("outro"); // sem uso: pode
    expect((await motivosDePerda()).map((m) => m.codigo)).not.toContain("outro");
  });

  it("reordena, recusa nome repetido e não deixa ficar sem nenhum motivo ativo", async () => {
    await reordenarMotivos(["outro", "desistiu"]);
    expect((await motivosDePerda()).map((m) => m.codigo).slice(0, 3)).toEqual(["outro", "desistiu", "preco"]);
    await expect(criarMotivo({ nome: " preço " })).rejects.toThrow(/Já existe/);
    await expect(criarMotivo({ nome: "  " })).rejects.toThrow(/nome/);
    for (const c of ["preco", "prazo", "concorrente", "desistiu"]) await editarMotivo(c, { ativo: false });
    await expect(editarMotivo("outro", { ativo: false })).rejects.toThrow(/pelo menos um/);
  });
});
