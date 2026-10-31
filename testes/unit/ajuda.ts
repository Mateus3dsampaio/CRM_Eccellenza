import { db } from "@/lib/db";
import { gerarHashSenha } from "@/lib/senha";

export async function limparBanco() {
  await db.eventoMetrica.deleteMany();
  await db.lead.deleteMany();
  await db.bloqueio.deleteMany();
  await db.usuario.deleteMany();
  await db.registroRotina.deleteMany();
  await db.configuracao.deleteMany();
  await db.instrucao.deleteMany();
}

export async function criarConsultores() {
  const a = await db.usuario.create({ data: { nome: "Consultor A", login: "a", senhaHash: gerarHashSenha("x"), perfil: "consultor" } });
  const b = await db.usuario.create({ data: { nome: "Consultor B", login: "b", senhaHash: gerarHashSenha("x"), perfil: "consultor" } });
  return [a, b];
}
