import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/login/route";
import { db } from "@/lib/db";
import { JANELA_BLOQUEIO_MS, LimiteDeTentativas, MAX_TENTATIVAS } from "@/regras/tentativas-login";
import { criarUsuario, garantirPrimeiroAdmin } from "@/servicos/usuarios";
import { limparBanco } from "./ajuda";

describe("limite de tentativas de login (regra)", () => {
  it("bloqueia depois de 5 erros e libera depois de 15 minutos", () => {
    const l = new LimiteDeTentativas();
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_TENTATIVAS; i++) l.registrarErro("ana|1.1.1.1", t0 + i);
    expect(l.bloqueadoPorMin("ana|1.1.1.1", t0 + 1000)).toBeGreaterThan(0);
    expect(l.bloqueadoPorMin("outra|1.1.1.1", t0 + 1000)).toBe(0);
    expect(l.bloqueadoPorMin("ana|1.1.1.1", t0 + JANELA_BLOQUEIO_MS + 10)).toBe(0);
  });
  it("acerto limpa os erros", () => {
    const l = new LimiteDeTentativas();
    for (let i = 0; i < 4; i++) l.registrarErro("a");
    l.limpar("a");
    l.registrarErro("a");
    expect(l.bloqueadoPorMin("a")).toBe(0);
  });
});

function pedido(loginTxt: string, senha: string, ip: string) {
  return new Request("https://crm.exemplo/api/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ login: loginTxt, senha }) });
}

describe("login e usuários", () => {
  beforeEach(limparBanco);

  it("depois de 5 senhas erradas responde 429, mesmo com a senha certa", async () => {
    await criarUsuario({ nome: "Ana", login: "ana", senha: "senha-bem-longa-1", perfil: "consultor" });
    for (let i = 0; i < MAX_TENTATIVAS; i++) expect((await login(pedido("ana", "errada", "9.9.9.9"))).status).toBe(401);
    expect((await login(pedido("ana", "senha-bem-longa-1", "9.9.9.9"))).status).toBe(429);
    // Outra origem não é afetada.
    expect((await login(pedido("ana", "senha-bem-longa-1", "8.8.8.8"))).status).toBe(200);
  });

  it("forjar o cabeçalho de origem não adianta: o limite por usuário também vale", async () => {
    await criarUsuario({ nome: "Dani", login: "dani", senha: "senha-bem-longa-1", perfil: "consultor" });
    let ultimo = 0;
    for (let i = 0; i < 21; i++) ultimo = (await login(pedido("dani", "errada", `1.1.1.${i}`))).status;
    expect(ultimo).toBe(429);
    expect((await login(pedido("dani", "senha-bem-longa-1", "2.2.2.2"))).status).toBe(429);
  });

  it("senha curta, login repetido e login inválido são recusados", async () => {
    await expect(criarUsuario({ nome: "X", login: "xx", senha: "curta", perfil: "admin" })).rejects.toThrow(/pelo menos/);
    await criarUsuario({ nome: "X", login: "xx", senha: "uma-senha-longa", perfil: "admin" });
    await expect(criarUsuario({ nome: "Y", login: "XX", senha: "uma-senha-longa", perfil: "admin" })).rejects.toThrow(/Já existe/);
    await expect(criarUsuario({ nome: "Z", login: "a b", senha: "uma-senha-longa", perfil: "admin" })).rejects.toThrow(/Login inválido/);
  });

  it("primeiro admin: cria só com banco vazio e variáveis preenchidas", async () => {
    expect(await garantirPrimeiroAdmin({})).toBe(false);
    expect(await garantirPrimeiroAdmin({ ADMIN_LOGIN: "mateus", ADMIN_SENHA: "senha-segura-123", ADMIN_NOME: "Mateus" })).toBe(true);
    expect((await db.usuario.findUniqueOrThrow({ where: { login: "mateus" } })).perfil).toBe("admin");
    expect(await garantirPrimeiroAdmin({ ADMIN_LOGIN: "outro", ADMIN_SENHA: "senha-segura-123" })).toBe(false);
    expect(await db.usuario.count()).toBe(1);
  });
});

describe("cookie de sessão", () => {
  beforeEach(limparBanco);
  const cookie = async (url: string, extra: Record<string, string> = {}) => {
    const r = await login(new Request(url, { method: "POST", headers: { "content-type": "application/json", ...extra }, body: JSON.stringify({ login: "bia", senha: "senha-bem-longa-1" }) }));
    return r.headers.get("set-cookie") ?? "";
  };
  it("só é 'Secure' quando o acesso é por https (no computador, em http, precisa funcionar)", async () => {
    await criarUsuario({ nome: "Bia", login: "bia", senha: "senha-bem-longa-1", perfil: "consultor" });
    expect(await cookie("http://127.0.0.1:3000/api/login")).not.toMatch(/Secure/i);
    expect(await cookie("https://crm.exemplo/api/login")).toMatch(/Secure/i);
    expect(await cookie("http://interno/api/login", { "x-forwarded-proto": "https" })).toMatch(/Secure/i);
    expect(await cookie("https://crm.exemplo/api/login")).toMatch(/HttpOnly/i);
  });
});
