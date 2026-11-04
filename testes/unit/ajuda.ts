import { db } from "@/lib/db";
import { gerarHashSenha } from "@/lib/senha";

export async function limparBanco() {
  await db.eventoMetrica.deleteMany();
  await db.assinaturaPush.deleteMany();
  await db.alerta.deleteMany();
  await db.lead.deleteMany();
  await db.bloqueio.deleteMany();
  await db.usuario.deleteMany();
  await db.registroRotina.deleteMany();
  await db.configuracao.deleteMany();
  await db.instrucao.deleteMany();
  await db.motivoPerda.deleteMany();
  await db.usoApi.deleteMany();
  await db.logWebhook.deleteMany();
  await db.pedidoLgpd.deleteMany();
  await db.eventoWebhook.deleteMany();
}

export async function criarConsultores() {
  const a = await db.usuario.create({ data: { nome: "Consultor A", login: "a", senhaHash: gerarHashSenha("x"), perfil: "consultor" } });
  const b = await db.usuario.create({ data: { nome: "Consultor B", login: "b", senhaHash: gerarHashSenha("x"), perfil: "consultor" } });
  return [a, b];
}

/**
 * Roteiro de EXEMPLO só para os testes (não é o que o bot usa). As instruções reais ficam no repositório de instruções
 * do Mateus e são coladas na tela; o projeto não guarda cópia delas.
 */
export async function criarRoteiroDeTeste() {
  const { criarInstrucao } = await import("@/servicos/instrucoes");
  await criarInstrucao({ titulo: "Exemplo de teste", texto: "01. EXEMPLO DE TESTE\nCumprimente o cliente e pergunte qual ambiente ele quer fazer." });
}
