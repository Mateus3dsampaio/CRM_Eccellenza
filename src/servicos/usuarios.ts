import { db } from "@/lib/db";
import { conferirSenha, gerarHashSenha } from "@/lib/senha";
import { marcarMudanca } from "@/lib/versao";
import { limparNomeParaCliente } from "@/regras/nome-cliente";
import { problemaNaSenha } from "@/regras/senha";
import { contarLeadsEmAndamento, transferirLeads } from "./distribuicao";

export { SENHA_MINIMA } from "@/regras/senha";

type Perfil = "admin" | "consultor";

function exigirSenhaValida(senha: string) {
  const problema = problemaNaSenha(senha);
  if (problema) throw new Error(problema);
}

/** Cria um usuário (admin ou consultor). Recusa login repetido e senha fraca. */
export async function criarUsuario(params: { nome: string; login: string; senha: string; perfil: Perfil; nomeCliente?: string | null }) {
  const login = params.login.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,30}$/.test(login)) throw new Error("Login inválido: use 2 a 30 letras minúsculas, números, ponto, traço ou sublinhado.");
  exigirSenhaValida(params.senha);
  if (!params.nome.trim()) throw new Error("Informe o nome.");
  if (await db.usuario.findUnique({ where: { login } })) throw new Error("Já existe um usuário com esse login.");
  return db.usuario.create({ data: { nome: params.nome.trim(), login, senhaHash: gerarHashSenha(params.senha), perfil: params.perfil, nomeCliente: limparNomeParaCliente(params.nomeCliente) || null } });
}

/** Equipe para a tela de Configurações, com quantos leads em andamento cada um tem. */
export async function listarEquipe() {
  const usuarios = await db.usuario.findMany({
    orderBy: [{ perfil: "asc" }, { criadoEm: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      nomeCliente: true,
      login: true,
      perfil: true,
      ativo: true,
      status: true,
      _count: { select: { leads: { where: { arquivadoEm: null, etapa: { notIn: ["fechado", "perdido"] } } } } },
    },
  });
  return usuarios.map(({ _count, ...u }) => ({ ...u, leadsEmAndamento: _count.leads }));
}

async function outrosAdminsAtivos(excetoId: string): Promise<number> {
  return db.usuario.count({ where: { perfil: "admin", ativo: true, id: { not: excetoId } } });
}

/** Muda nome e/ou perfil. Não deixa o sistema ficar sem nenhum administrador ativo. */
export async function editarUsuario(id: string, dados: { nome?: string; perfil?: Perfil; nomeCliente?: string | null }) {
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id } });
  const nome = dados.nome?.trim();
  if (dados.nome !== undefined && !nome) throw new Error("Informe o nome.");
  if (dados.perfil && dados.perfil !== usuario.perfil && usuario.perfil === "admin" && usuario.ativo && (await outrosAdminsAtivos(id)) === 0) {
    throw new Error("Este é o único administrador ativo. Cadastre outro administrador antes de mudar o perfil dele.");
  }
  await db.usuario.update({ where: { id }, data: { nome: nome ?? undefined, perfil: dados.perfil, nomeCliente: dados.nomeCliente === undefined ? undefined : limparNomeParaCliente(dados.nomeCliente) || null } });
  await marcarMudanca();
}

/** O admin define uma senha nova para qualquer usuário (esqueceu a senha, por exemplo). */
export async function redefinirSenha(id: string, senhaNova: string) {
  exigirSenhaValida(senhaNova);
  await db.usuario.findUniqueOrThrow({ where: { id } });
  await db.usuario.update({ where: { id }, data: { senhaHash: gerarHashSenha(senhaNova) } });
}

/** Cada um troca a própria senha, confirmando a atual. */
export async function trocarMinhaSenha(id: string, senhaAtual: string, senhaNova: string) {
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id } });
  if (!conferirSenha(senhaAtual, usuario.senhaHash)) throw new Error("A senha atual não confere.");
  exigirSenhaValida(senhaNova);
  await db.usuario.update({ where: { id }, data: { senhaHash: gerarHashSenha(senhaNova) } });
}

/**
 * Desativa ou reativa. Desativado não entra mais (a sessão cai na próxima ação), mas o histórico continua.
 * Quem tem leads em andamento só é desativado se os leads forem para outro consultor (`transferirPara`).
 * Devolve quantos leads foram transferidos.
 */
export async function definirAtivo(id: string, ativo: boolean, quemFazId: string, transferirPara?: string): Promise<number> {
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id } });
  if (usuario.ativo === ativo) return 0;
  let transferidos = 0;
  if (!ativo) {
    if (id === quemFazId) throw new Error("Você não pode desativar a si mesmo.");
    if (usuario.perfil === "admin" && (await outrosAdminsAtivos(id)) === 0) throw new Error("Este é o único administrador ativo. Cadastre outro antes de desativar.");
    if ((await contarLeadsEmAndamento(id)) > 0) {
      if (!transferirPara) throw new Error("Este consultor tem leads em andamento. Escolha para quem eles vão.");
      const autor = (await db.usuario.findUnique({ where: { id: quemFazId }, select: { nome: true } }))?.nome ?? "sistema";
      transferidos = await transferirLeads(id, transferirPara, autor);
    }
  }
  await db.usuario.update({ where: { id }, data: { ativo } });
  await marcarMudanca();
  return transferidos;
}

/**
 * Primeiro uso em produção: se o banco não tem nenhum usuário e as variáveis ADMIN_LOGIN, ADMIN_SENHA (e ADMIN_NOME) existem,
 * cria o administrador. Depois disso as variáveis são ignoradas (trocar a senha lá não muda a senha do banco).
 */
export async function garantirPrimeiroAdmin(env: Record<string, string | undefined> = process.env): Promise<boolean> {
  if (!env.ADMIN_LOGIN || !env.ADMIN_SENHA) return false;
  if ((await db.usuario.count()) > 0) return false;
  await criarUsuario({ nome: env.ADMIN_NOME || "Administrador", login: env.ADMIN_LOGIN, senha: env.ADMIN_SENHA, perfil: "admin" });
  console.log("[usuarios] administrador inicial criado.");
  return true;
}
