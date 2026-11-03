import { beforeEach, describe, expect, it } from "vitest";
import { executarFerramenta } from "@/bot/executor";
import { db } from "@/lib/db";
import { avancarRelogio } from "@/lib/relogio";
import { lerPreferencias, textoDoAlerta, tituloDaAba } from "@/regras/alertas";
import { DIA } from "@/regras/tempo";
import { agendarVisita, horariosLivresParaLead } from "@/servicos/agenda";
import { alertasDesde, registrarAlerta } from "@/servicos/alertas";
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
  });

  it("põe e tira o número da aba sem duplicar", () => {
    expect(tituloDaAba("CRM Eccellenza", 3)).toBe("(3) CRM Eccellenza");
    expect(tituloDaAba("(3) CRM Eccellenza", 5)).toBe("(5) CRM Eccellenza");
    expect(tituloDaAba("(3) CRM Eccellenza", 0)).toBe("CRM Eccellenza");
    expect(tituloDaAba("CRM Eccellenza", 0)).toBe("CRM Eccellenza");
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
