import { beforeEach, describe, expect, it } from "vitest";
import { executarFerramenta } from "@/bot/executor";
import { db } from "@/lib/db";
import { avancarRelogio } from "@/lib/relogio";
import { lerPreferencias, textoDoAlerta, tituloDaAba } from "@/regras/alertas";
import { DIA } from "@/regras/tempo";
import { agendarVisita, horariosLivresParaLead } from "@/servicos/agenda";
import { alertasDesde, avisarPrazosVermelhos, registrarAlerta } from "@/servicos/alertas";
import { definirPrazosDeEspera } from "@/servicos/configuracoes";
import { arquivarLeads } from "@/servicos/leads";
import { enviarMensagemLoja } from "@/servicos/mensagens";
import { rodarRotinas } from "@/servicos/rotinas";
import { obterOuCriarLead } from "@/servicos/leads";
import { registrarMensagemCliente } from "@/servicos/mensagens";
import { criarConsultores, limparBanco } from "./ajuda";

describe("regras dos avisos (Bloco 1, tarefa 3)", () => {
  it("escreve o aviso do ponto de vista de quem lê", () => {
    const base = { leadNome: "Ana", consultorId: "c1", consultorNome: "Rafael", texto: "Oi" };
    expect(textoDoAlerta({ ...base, tipo: "mensagem" }, "c1")).toEqual({ titulo: "Nova mensagem de Ana", corpo: "Oi" });
    expect(textoDoAlerta({ ...base, tipo: "lead_passado" }, "c1").titulo).toBe("Ana foi passado para você");
    expect(textoDoAlerta({ ...base, tipo: "lead_passado" }, "admin").titulo).toBe("Ana foi passado para Rafael");
    expect(textoDoAlerta({ ...base, tipo: "lead_passado", consultorId: null, consultorNome: null }, "admin").titulo).toMatch(/fila/);
    expect(textoDoAlerta({ ...base, tipo: "visita_marcada", texto: "qua 05/11 10h" }, "c1")).toEqual({ titulo: "Visita marcada: Ana", corpo: "qua 05/11 10h" });
    expect(textoDoAlerta({ ...base, tipo: "visita_marcada", texto: "qua 05/11 10h" }, "admin").corpo).toBe("qua 05/11 10h com Rafael");
    expect(textoDoAlerta({ ...base, tipo: "prazo_vermelho", texto: "35 min" }, "admin")).toEqual({ titulo: "Ana passou do prazo sem resposta", corpo: "Espera de 35 min. Consultor: Rafael." });
    expect(textoDoAlerta({ ...base, tipo: "prazo_vermelho", texto: "35 min", consultorNome: null }, "admin").corpo).toMatch(/fila/);
  });

  it("põe e tira o número da aba sem duplicar", () => {
    expect(tituloDaAba("CRM Eccellenza", 3)).toBe("(3) CRM Eccellenza");
    expect(tituloDaAba("(3) CRM Eccellenza", 5)).toBe("(5) CRM Eccellenza");
    expect(tituloDaAba("(3) CRM Eccellenza", 0)).toBe("CRM Eccellenza");
    expect(tituloDaAba("CRM Eccellenza", 0)).toBe("CRM Eccellenza");
    // Título vazio: o navegador devolve "(3)" sem espaço; o resultado tem de ser igual para não girar em laço.
    expect(tituloDaAba("", 3)).toBe("(3)");
    expect(tituloDaAba("(3)", 3)).toBe("(3)");
  });

  it("lê as preferências guardadas; lixo vira o padrão", () => {
    expect(lerPreferencias(null)).toEqual({ som: true, notificacoes: true });
    expect(lerPreferencias('{"som":false,"notificacoes":true}')).toEqual({ som: false, notificacoes: true });
    expect(lerPreferencias('{"som":"não"}')).toEqual({ som: true, notificacoes: true });
    expect(lerPreferencias("{quebrado")).toEqual({ som: true, notificacoes: true });
  });
});

describe("avisos no banco (Bloco 1, tarefa 3)", () => {
  beforeEach(async () => {
    await limparBanco();
  });
  const admin = { id: "admin", perfil: "admin" };

  it("a primeira consulta só marca o ponto de partida: o que veio antes não vira aviso", async () => {
    const lead = await obterOuCriarLead("+5588900008001", "Ana");
    await registrarMensagemCliente(lead.id, "Oi");
    const primeira = await alertasDesde(admin);
    expect(primeira.eventos).toEqual([]);
    expect(primeira.ultimoId).toBeGreaterThan(0);
    expect((await alertasDesde(admin, primeira.ultimoId)).eventos).toEqual([]);
  });

  it("mensagem do cliente avisa o dono do lead; o admin recebe todas; lead sem dono é só do admin", async () => {
    const [a, b] = await criarConsultores();
    const deA = await obterOuCriarLead("+5588900008002", "Ana");
    const deB = await obterOuCriarLead("+5588900008003", "Bia");
    const semDono = await obterOuCriarLead("+5588900008004", "Caio");
    await db.lead.update({ where: { id: deA.id }, data: { consultorId: a.id } });
    await db.lead.update({ where: { id: deB.id }, data: { consultorId: b.id } });
    const { ultimoId } = await alertasDesde(admin);

    await registrarMensagemCliente(deA.id, "Quero uma cozinha");
    await registrarMensagemCliente(deB.id, "Bom dia");
    await registrarMensagemCliente(semDono.id, "Olá");

    const doA = (await alertasDesde({ id: a.id, perfil: "consultor" }, ultimoId)).eventos;
    expect(doA.map((e) => [e.tipo, e.leadNome, e.texto])).toEqual([["mensagem", "Ana", "Quero uma cozinha"]]);
    const doB = (await alertasDesde({ id: b.id, perfil: "consultor" }, ultimoId)).eventos;
    expect(doB.map((e) => e.leadNome)).toEqual(["Bia"]);
    const doAdmin = (await alertasDesde(admin, ultimoId)).eventos;
    expect(doAdmin.map((e) => e.leadNome)).toEqual(["Ana", "Bia", "Caio"]);
    // O cursor avança: nada se repete.
    const { ultimoId: novo } = await alertasDesde(admin, ultimoId);
    expect((await alertasDesde(admin, novo)).eventos).toEqual([]);
  });

  it("o bot passa o lead: avisa uma vez, para o consultor escolhido", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900008005", "Dani");
    await registrarMensagemCliente(lead.id, "Quero falar com alguém");
    const { ultimoId } = await alertasDesde(admin);
    await executarFerramenta(lead.id, "passar_para_consultor", { motivo: "pedido do cliente" });
    await executarFerramenta(lead.id, "passar_para_consultor", { motivo: "de novo" });
    const dono = (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).consultorId!;
    const passados = (await alertasDesde(admin, ultimoId)).eventos.filter((e) => e.tipo === "lead_passado");
    expect(passados).toHaveLength(1);
    expect(passados[0].consultorId).toBe(dono);
    expect((await alertasDesde({ id: dono, perfil: "consultor" }, ultimoId)).eventos.map((e) => e.tipo)).toEqual(["lead_passado"]);
  });

  it("visita marcada pelo bot avisa; marcada por uma pessoa na tela não", async () => {
    const [a] = await criarConsultores();
    const bot = await obterOuCriarLead("+5588900008006", "Edu");
    const pessoa = await obterOuCriarLead("+5588900008007", "Fabi");
    const [v1, v2] = await horariosLivresParaLead(bot.id, 2);
    const { ultimoId } = await alertasDesde(admin);
    await agendarVisita({ leadId: pessoa.id, inicio: v2.inicio, consultorId: a.id, autor: "Rafael" });
    expect((await alertasDesde(admin, ultimoId)).eventos).toEqual([]);
    await agendarVisita({ leadId: bot.id, inicio: v1.inicio, consultorId: a.id, autor: "bot" });
    const eventos = (await alertasDesde({ id: a.id, perfil: "consultor" }, ultimoId)).eventos;
    expect(eventos.map((e) => [e.tipo, e.leadNome, e.consultorNome])).toEqual([["visita_marcada", "Edu", a.nome]]);
    expect(eventos[0].texto).toBeTruthy();
  });

  it("apaga aviso com mais de 1 dia", async () => {
    const lead = await obterOuCriarLead("+5588900008008", "Gil");
    await registrarAlerta({ tipo: "mensagem", leadId: lead.id, texto: "velho" });
    await avancarRelogio(DIA + 60_000);
    await registrarAlerta({ tipo: "mensagem", leadId: lead.id, texto: "novo" });
    expect((await db.alerta.findMany()).map((a) => a.texto)).toEqual(["novo"]);
  });
});

describe("prazo vermelho avisa o admin (ESP-09)", () => {
  beforeEach(async () => {
    await limparBanco();
  });
  const admin = { id: "admin", perfil: "admin" };
  const MIN = 60_000;

  async function leadEsperando(telefone: string, nome: string, dono: string | null) {
    const lead = await obterOuCriarLead(telefone, nome);
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: dono, modoAtendimento: "humano" } });
    await registrarMensagemCliente(lead.id, "Alô?");
    return lead.id;
  }

  it("só depois do prazo, uma vez por espera, e só para o admin", async () => {
    const [a] = await criarConsultores();
    const id = await leadEsperando("+5588900008101", "Hugo", a.id);
    const { ultimoId } = await alertasDesde(admin);

    await avancarRelogio(29 * MIN);
    expect(await avisarPrazosVermelhos()).toBe(0);

    await avancarRelogio(2 * MIN); // 31 min: passou dos 30
    expect(await avisarPrazosVermelhos()).toBe(1);
    expect(await avisarPrazosVermelhos()).toBe(0);
    await avancarRelogio(60 * MIN);
    expect(await rodarRotinas()).toBeTruthy();
    expect(await avisarPrazosVermelhos()).toBe(0);

    const doAdmin = (await alertasDesde(admin, ultimoId)).eventos.filter((e) => e.tipo === "prazo_vermelho");
    expect(doAdmin).toHaveLength(1);
    expect(doAdmin[0]).toMatchObject({ leadId: id, leadNome: "Hugo", consultorNome: a.nome, texto: "31 min" });
    // O dono do lead não recebe o aviso de prazo: ele é do admin.
    expect((await alertasDesde({ id: a.id, perfil: "consultor" }, ultimoId)).eventos.filter((e) => e.tipo === "prazo_vermelho")).toEqual([]);
  });

  it("espera nova depois de o consultor responder avisa de novo", async () => {
    const [a] = await criarConsultores();
    const id = await leadEsperando("+5588900008102", "Iara", a.id);
    await avancarRelogio(31 * MIN);
    expect(await avisarPrazosVermelhos()).toBe(1);

    await enviarMensagemLoja({ leadId: id, autor: "consultor", autorNome: a.nome, texto: "Desculpe a demora!" });
    await registrarMensagemCliente(id, "Tudo bem. Mais uma dúvida");
    await avancarRelogio(10 * MIN);
    expect(await avisarPrazosVermelhos()).toBe(0);
    await avancarRelogio(25 * MIN);
    expect(await avisarPrazosVermelhos()).toBe(1);
    expect(await db.alerta.count({ where: { tipo: "prazo_vermelho" } })).toBe(2);
  });

  it("respeita o prazo configurado e ignora arquivado e quem não espera humano", async () => {
    const [a] = await criarConsultores();
    await definirPrazosDeEspera({ amarelo: 2, vermelho: 5 });
    const esperando = await leadEsperando("+5588900008103", "Joel", a.id);
    const arquivado = await leadEsperando("+5588900008104", "Kely", a.id);
    await arquivarLeads([arquivado], "teste");
    const comBot = await obterOuCriarLead("+5588900008105", "Lia");
    await registrarMensagemCliente(comBot.id, "Oi");

    await avancarRelogio(6 * MIN);
    expect(await avisarPrazosVermelhos()).toBe(1);
    expect((await db.alerta.findFirstOrThrow({ where: { tipo: "prazo_vermelho" } })).leadId).toBe(esperando);
  });
});
