import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { pediuParaParar } from "@/regras/optout";
import { receberMensagemCliente } from "@/servicos/conversa";
import { devolverAoBot } from "@/servicos/conversa";
import { exportarDadosDoCliente, excluirComRegistro } from "@/servicos/lgpd";
import { rodarRotinas } from "@/servicos/rotinas";
import { avancarRelogio } from "@/lib/relogio";
import { obterOuCriarLead } from "@/servicos/leads";
import { registrarMensagemCliente } from "@/servicos/mensagens";
import { limparBanco } from "./ajuda";

describe("pedido para parar (regra)", () => {
  it("só vale quando a mensagem inteira é o pedido", () => {
    expect(pediuParaParar("PARAR")).toBe(true);
    expect(pediuParaParar("  Não quero mais receber mensagens! ")).toBe(true);
    expect(pediuParaParar("Sair")).toBe(true);
    expect(pediuParaParar("quero parar de pagar aluguel e fazer minha cozinha")).toBe(false);
    expect(pediuParaParar("Oi, bom dia")).toBe(false);
    expect(pediuParaParar(null)).toBe(false);
  });
});

describe("LGPD no sistema", () => {
  beforeEach(limparBanco);

  it("cliente que pede para parar: confirma, etiqueta, bot não responde e não recebe mensagem automática", async () => {
    const r = await receberMensagemCliente({ telefone: "+5588900001111", nomePerfil: "Ana", texto: "parar" });
    expect(r.respostas).toEqual([]);
    const lead = await db.lead.findUniqueOrThrow({ where: { telefone: "+5588900001111" }, include: { mensagens: true } });
    expect(lead.naoReceberEm).not.toBeNull();
    expect(lead.etiquetas).toContain("nao_receber");
    expect(lead.mensagens.some((m) => m.autor === "sistema")).toBe(true);
    expect(await db.usoApi.count()).toBe(0);

    await avancarRelogio(5 * 24 * 3600_000);
    const rot = await rodarRotinas();
    expect(rot.mensagens).toBe(0);
    await db.configuracao.deleteMany({ where: { chave: "relogio_deslocamento_ms" } });
  });

  it("devolver ao bot libera o cliente que tinha pedido para parar", async () => {
    await receberMensagemCliente({ telefone: "+5588900002222", texto: "sair" });
    const lead = await db.lead.findUniqueOrThrow({ where: { telefone: "+5588900002222" } });
    await devolverAoBot(lead.id, { nome: "Mateus" });
    const depois = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(depois.naoReceberEm).toBeNull();
    expect(depois.etiquetas).not.toContain("nao_receber");
  });

  it("exclusão apaga tudo e guarda só os 4 últimos dígitos e quem fez", async () => {
    const lead = await obterOuCriarLead("+5588900003333", "Beto");
    await registrarMensagemCliente(lead.id, "oi");
    expect(await db.alerta.count({ where: { leadId: lead.id } })).toBeGreaterThan(0); // a prévia da mensagem virou aviso
    expect(await excluirComRegistro([lead.id], "Mateus")).toBe(1);
    expect(await db.lead.count()).toBe(0);
    expect(await db.mensagem.count()).toBe(0);
    expect(await db.alerta.count({ where: { leadId: lead.id } })).toBe(0);
    const pedido = await db.pedidoLgpd.findFirstOrThrow();
    expect(pedido).toMatchObject({ acao: "exclusao", quem: "Mateus", telefoneFim: "3333" });
  });

  it("exportação traz os dados do cliente num zip e registra o pedido", async () => {
    const lead = await obterOuCriarLead("+5588900004444", "Carla");
    await registrarMensagemCliente(lead.id, "quero uma cozinha");
    const { nome, zip } = await exportarDadosDoCliente(lead.id, "Mateus");
    expect(nome).toBe("dados-cliente-4444.zip");
    expect(zip.subarray(0, 2).toString("ascii")).toBe("PK");
    expect(zip.toString("utf8")).toContain("quero uma cozinha");
    expect(await db.pedidoLgpd.count({ where: { acao: "exportacao" } })).toBe(1);
  });
});
