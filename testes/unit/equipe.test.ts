import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { conferirSenha } from "@/lib/senha";
import { problemaNaSenha } from "@/regras/senha";
import { definirStatusConsultor, escolherProximoConsultor, transferirLead, transferirLeads } from "@/servicos/distribuicao";
import { obterOuCriarLead } from "@/servicos/leads";
import { criarUsuario, definirAtivo, editarUsuario, listarEquipe, redefinirSenha, trocarMinhaSenha } from "@/servicos/usuarios";
import { limparBanco } from "./ajuda";

describe("regra de senha", () => {
  it("aceita 6+ caracteres com letra, número e uma maiúscula", () => {
    expect(problemaNaSenha("Abc123")).toBeNull();
    expect(problemaNaSenha("loja2026Forte")).toBeNull();
    expect(problemaNaSenha("Ábaco1")).toBeNull();
  });
  it("recusa curta, sem maiúscula, sem número ou sem letra", () => {
    expect(problemaNaSenha("Ab12")).not.toBeNull();
    expect(problemaNaSenha("abc123")).not.toBeNull();
    expect(problemaNaSenha("Abcdef")).not.toBeNull();
    expect(problemaNaSenha("123456")).not.toBeNull();
  });
});

async function montar() {
  const admin = await criarUsuario({ nome: "Mateus", login: "mateus", senha: "Mateus123", perfil: "admin" });
  const ana = await criarUsuario({ nome: "Ana", login: "ana", senha: "Ana12345", perfil: "consultor" });
  const rui = await criarUsuario({ nome: "Rui", login: "rui", senha: "Rui12345", perfil: "consultor" });
  return { admin, ana, rui };
}

async function leadDe(consultorId: string, telefone: string, etapa = "novo") {
  const lead = await obterOuCriarLead(telefone);
  return db.lead.update({ where: { id: lead.id }, data: { consultorId, etapa } });
}

describe("equipe: cadastro, senha e desativação", () => {
  beforeEach(limparBanco);

  it("lista a equipe com os leads em andamento (ignora arquivados, fechados e perdidos)", async () => {
    const { ana } = await montar();
    await leadDe(ana.id, "+5588900000001");
    await leadDe(ana.id, "+5588900000002", "fechado");
    const arquivado = await leadDe(ana.id, "+5588900000003");
    await db.lead.update({ where: { id: arquivado.id }, data: { arquivadoEm: new Date() } });
    const equipe = await listarEquipe();
    expect(equipe.find((u) => u.login === "ana")?.leadsEmAndamento).toBe(1);
  });

  it("admin redefine a senha e a nova passa a valer; senha fraca é recusada", async () => {
    const { ana } = await montar();
    await expect(redefinirSenha(ana.id, "fraca")).rejects.toThrow(/pelo menos/);
    await redefinirSenha(ana.id, "NovaSenha9");
    const u = await db.usuario.findUniqueOrThrow({ where: { id: ana.id } });
    expect(conferirSenha("NovaSenha9", u.senhaHash)).toBe(true);
    expect(conferirSenha("Ana12345", u.senhaHash)).toBe(false);
  });

  it("trocar a própria senha exige a atual", async () => {
    const { ana } = await montar();
    await expect(trocarMinhaSenha(ana.id, "errada", "NovaSenha9")).rejects.toThrow(/atual/);
    await expect(trocarMinhaSenha(ana.id, "Ana12345", "fraca")).rejects.toThrow(/pelo menos/);
    await trocarMinhaSenha(ana.id, "Ana12345", "NovaSenha9");
    expect(conferirSenha("NovaSenha9", (await db.usuario.findUniqueOrThrow({ where: { id: ana.id } })).senhaHash)).toBe(true);
  });

  it("não deixa o sistema sem administrador ativo", async () => {
    const { admin, ana } = await montar();
    await expect(definirAtivo(admin.id, false, ana.id)).rejects.toThrow(/único administrador/);
    await expect(editarUsuario(admin.id, { perfil: "consultor" })).rejects.toThrow(/único administrador/);
    // Com um segundo admin, pode.
    await editarUsuario(ana.id, { perfil: "admin" });
    await definirAtivo(admin.id, false, ana.id);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: admin.id } })).ativo).toBe(false);
  });

  it("ninguém desativa a si mesmo", async () => {
    const { admin } = await montar();
    await editarUsuario((await db.usuario.findUniqueOrThrow({ where: { login: "ana" } })).id, { perfil: "admin" });
    await expect(definirAtivo(admin.id, false, admin.id)).rejects.toThrow(/a si mesmo/);
  });

  it("consultor com leads só é desativado se os leads forem para outro consultor", async () => {
    const { admin, ana, rui } = await montar();
    const lead = await leadDe(ana.id, "+5588900000001");
    await leadDe(ana.id, "+5588900000002", "visita_marcada");
    await expect(definirAtivo(ana.id, false, admin.id)).rejects.toThrow(/leads em andamento/);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: ana.id } })).ativo).toBe(true);
    expect(await definirAtivo(ana.id, false, admin.id, rui.id)).toBe(2);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: ana.id } })).ativo).toBe(false);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).consultorId).toBe(rui.id);
    // Fica registrado na ficha, com o nome de quem fez.
    const alteracao = await db.alteracao.findFirstOrThrow({ where: { leadId: lead.id, descricao: { contains: "transferido" } } });
    expect(alteracao.autor).toBe("Mateus");
    expect(alteracao.descricao).toMatch(/Ana.*Rui/);
  });

  it("desativado não recebe lead novo; reativado volta", async () => {
    const { admin, ana, rui } = await montar();
    await definirAtivo(ana.id, false, admin.id);
    for (let i = 0; i < 3; i++) expect(await escolherProximoConsultor()).toBe(rui.id);
    await definirAtivo(ana.id, true, admin.id);
    const escolhidos = new Set([await escolherProximoConsultor(), await escolherProximoConsultor()]);
    expect(escolhidos.has(ana.id)).toBe(true);
  });
});

describe("transferir leads", () => {
  beforeEach(limparBanco);

  it("passa só os leads em andamento e preserva a conversa", async () => {
    const { ana, rui } = await montar();
    const aberto = await leadDe(ana.id, "+5588900000001");
    const fechado = await leadDe(ana.id, "+5588900000002", "fechado");
    expect(await transferirLeads(ana.id, rui.id, "Mateus")).toBe(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: aberto.id } })).consultorId).toBe(rui.id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: fechado.id } })).consultorId).toBe(ana.id);
  });

  it("só aceita consultor ativo como destino", async () => {
    const { admin, ana, rui } = await montar();
    await expect(transferirLeads(ana.id, ana.id, "Mateus")).rejects.toThrow(/diferente/);
    await expect(transferirLeads(ana.id, admin.id, "Mateus")).rejects.toThrow(/consultor ativo/);
    await db.usuario.update({ where: { id: rui.id }, data: { ativo: false } });
    await expect(transferirLeads(ana.id, rui.id, "Mateus")).rejects.toThrow(/consultor ativo/);
  });
});

describe("almoço é só manual", () => {
  beforeEach(limparBanco);

  it("quem está em almoço continua fora do rodízio até voltar sozinho, e ao voltar volta a receber", async () => {
    const { ana, rui } = await montar();
    await definirStatusConsultor(ana.id, "almoco");
    // Nenhuma rotina devolve o consultor ao rodízio sozinha.
    for (let i = 0; i < 4; i++) expect(await escolherProximoConsultor()).toBe(rui.id);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: ana.id } })).status).toBe("almoco");
    await definirStatusConsultor(ana.id, "online");
    const escolhidos = new Set([await escolherProximoConsultor(), await escolherProximoConsultor()]);
    expect(escolhidos.has(ana.id)).toBe(true);
  });
});

describe("transferir um lead só", () => {
  beforeEach(limparBanco);

  it("passa o lead (qualquer etapa) e registra os nomes no histórico", async () => {
    const { ana, rui } = await montar();
    const fechado = await leadDe(ana.id, "+5588900000001", "fechado");
    const outro = await leadDe(ana.id, "+5588900000002");
    await transferirLead(fechado.id, rui.id, "Mateus");
    expect((await db.lead.findUniqueOrThrow({ where: { id: fechado.id } })).consultorId).toBe(rui.id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: outro.id } })).consultorId).toBe(ana.id);
    const log = await db.alteracao.findFirstOrThrow({ where: { leadId: fechado.id, descricao: { contains: "transferido" } } });
    expect(log.descricao).toMatch(/Ana.*Rui/);
  });

  it("aceita lead sem dono, recusa o mesmo consultor, admin e consultor inativo", async () => {
    const { admin, ana, rui } = await montar();
    const semDono = await obterOuCriarLead("+5588900000003");
    await transferirLead(semDono.id, ana.id, "Mateus");
    expect((await db.lead.findUniqueOrThrow({ where: { id: semDono.id } })).consultorId).toBe(ana.id);
    await expect(transferirLead(semDono.id, ana.id, "Mateus")).rejects.toThrow(/já está/);
    await expect(transferirLead(semDono.id, admin.id, "Mateus")).rejects.toThrow(/consultor ativo/);
    await db.usuario.update({ where: { id: rui.id }, data: { ativo: false } });
    await expect(transferirLead(semDono.id, rui.id, "Mateus")).rejects.toThrow(/consultor ativo/);
  });
});
