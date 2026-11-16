import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { ErroHttp } from "@/lib/sessao";
import { marcarMudanca } from "@/lib/versao";
import { MOTIVO_SEM_RESPOSTA_AUTOMATICO, NOME_MOTIVO_SEM_RESPOSTA_AUTOMATICO } from "@/regras/recuperacao";
import { MOTIVO_PAROU_DE_RESPONDER, MOTIVOS_PADRAO, type MotivoDePerda, type RegrasDeVendas } from "@/regras/vendas";
import { gravarConfig, lerConfig } from "./configuracoes";

// Configurações de vendas (Configurações > Vendas): motivos de perda editáveis e se Negociação exige próximo contato.

const CHAVE_CONTATO_NEGOCIACAO = "vendas_exigir_contato_negociacao";

/** Padrão ligado: só desliga quando o admin desliga de propósito. */
export async function exigirContatoNegociacao(): Promise<boolean> {
  return (await lerConfig(CHAVE_CONTATO_NEGOCIACAO)) !== "0";
}

export async function definirExigirContatoNegociacao(exigir: boolean): Promise<void> {
  await gravarConfig(CHAVE_CONTATO_NEGOCIACAO, exigir ? "1" : "0");
  await marcarMudanca();
}

/** Todos os motivos (ativos e desativados) na ordem do admin. A tabela vazia recebe os 5 originais, uma vez. */
export async function motivosDePerda(): Promise<MotivoDePerda[]> {
  if ((await db.motivoPerda.count()) === 0) {
    // Duas telas pedindo ao mesmo tempo na primeira vez: a segunda esbarra no código repetido e só segue.
    await db.motivoPerda.createMany({ data: MOTIVOS_PADRAO.map((m, i) => ({ ...m, ordem: i })) }).catch(() => undefined);
  }
  const linhas = await db.motivoPerda.findMany({ orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] });
  return linhas.map((m) => ({ codigo: m.codigo, nome: m.nome, pergunta: m.pergunta, ativo: m.ativo, naoELead: m.naoELead }));
}

/**
 * O motivo "Parou de responder" é usado pela rotina (antiga coluna "Sem resposta"): bancos de antes da tarefa 21 não
 * o têm e o admin pode tê-lo apagado enquanto não tinha uso. Cria no fim da lista se faltar.
 */
export async function garantirMotivoParouDeResponder(): Promise<void> {
  await motivosDePerda();
  if (await db.motivoPerda.findUnique({ where: { codigo: MOTIVO_PAROU_DE_RESPONDER } })) return;
  const padrao = MOTIVOS_PADRAO.find((m) => m.codigo === MOTIVO_PAROU_DE_RESPONDER)!;
  const ultimo = await db.motivoPerda.aggregate({ _max: { ordem: true } });
  await db.motivoPerda.create({ data: { ...padrao, ordem: (ultimo._max.ordem ?? -1) + 1 } }).catch(() => undefined);
}

/** O motivo "Sem resposta (automático)" é o da recuperação de leads: cria no fim da lista se faltar (banco antigo ou apagado). */
export async function garantirMotivoSemRespostaAutomatico(): Promise<void> {
  await garantirMotivoAutomatico(MOTIVO_SEM_RESPOSTA_AUTOMATICO, NOME_MOTIVO_SEM_RESPOSTA_AUTOMATICO);
}

/** Motivo gravado por uma rotina automática: cria no fim da lista se faltar (banco antigo ou apagado pelo admin). */
export async function garantirMotivoAutomatico(codigo: string, nome: string): Promise<void> {
  await motivosDePerda();
  if (await db.motivoPerda.findUnique({ where: { codigo } })) return;
  const ultimo = await db.motivoPerda.aggregate({ _max: { ordem: true } });
  await db.motivoPerda.create({ data: { codigo, nome, pergunta: null, ordem: (ultimo._max.ordem ?? -1) + 1 } }).catch(() => undefined);
}

/**
 * Regras para conferir uma mudança de etapa. `motivoJaGravado` é o motivo que o lead já tem:
 * continua valendo mesmo se o admin desativou depois (não obriga a escolher de novo).
 */
export async function regrasDeVendas(motivoJaGravado?: string | null): Promise<RegrasDeVendas> {
  const motivos = (await motivosDePerda()).filter((m) => m.ativo || m.codigo === motivoJaGravado);
  return { exigirContatoNegociacao: await exigirContatoNegociacao(), motivos: motivos.map((m) => ({ codigo: m.codigo, pergunta: m.pergunta })) };
}

function limpar(nome: string, pergunta: string | null | undefined) {
  const n = nome.trim();
  if (!n) throw new ErroHttp(400, "Escreva o nome do motivo.");
  if (n.length > 60) throw new ErroHttp(400, "O nome do motivo pode ter até 60 letras.");
  const p = pergunta?.trim() || null;
  if (p && p.length > 100) throw new ErroHttp(400, "A pergunta pode ter até 100 letras.");
  return { nome: n, pergunta: p };
}

async function conferirNomeUnico(nome: string, ignorar?: string) {
  const todos = await motivosDePerda();
  if (todos.some((m) => m.codigo !== ignorar && m.nome.toLowerCase() === nome.toLowerCase())) throw new ErroHttp(400, "Já existe um motivo com esse nome.");
}

export async function criarMotivo(entrada: { nome: string; pergunta?: string | null; naoELead?: boolean }): Promise<void> {
  const { nome, pergunta } = limpar(entrada.nome, entrada.pergunta);
  await conferirNomeUnico(nome);
  const ultimo = await db.motivoPerda.aggregate({ _max: { ordem: true } });
  await db.motivoPerda.create({ data: { codigo: `m_${randomBytes(6).toString("hex")}`, nome, pergunta, ordem: (ultimo._max.ordem ?? -1) + 1, naoELead: entrada.naoELead === true } });
  await marcarMudanca();
}

export async function editarMotivo(codigo: string, entrada: { nome?: string; pergunta?: string | null; ativo?: boolean; naoELead?: boolean }): Promise<void> {
  const atual = (await motivosDePerda()).find((m) => m.codigo === codigo);
  if (!atual) throw new ErroHttp(404, "Motivo não encontrado.");
  const { nome, pergunta } = limpar(entrada.nome ?? atual.nome, entrada.pergunta === undefined ? atual.pergunta : entrada.pergunta);
  await conferirNomeUnico(nome, codigo);
  if (entrada.ativo === false && atual.ativo && (await motivosDePerda()).filter((m) => m.ativo).length <= 1) {
    throw new ErroHttp(400, "Precisa sobrar pelo menos um motivo ativo.");
  }
  await db.motivoPerda.update({ where: { codigo }, data: { nome, pergunta, ...(entrada.ativo === undefined ? {} : { ativo: entrada.ativo }), ...(entrada.naoELead === undefined ? {} : { naoELead: entrada.naoELead }) } });
  await marcarMudanca();
}

export async function reordenarMotivos(codigos: string[]): Promise<void> {
  const existentes = (await motivosDePerda()).map((m) => m.codigo);
  const resto = existentes.filter((c) => !codigos.includes(c));
  const ordem = [...codigos.filter((c) => existentes.includes(c)), ...resto];
  await db.$transaction(ordem.map((codigo, i) => db.motivoPerda.update({ where: { codigo }, data: { ordem: i } })));
  await marcarMudanca();
}

/** Motivo que algum lead já usa (ou que o painel guardou de um lead excluído) não é apagado: só desativa. */
export async function excluirMotivo(codigo: string): Promise<void> {
  const todos = await motivosDePerda();
  const motivo = todos.find((m) => m.codigo === codigo);
  if (!motivo) throw new ErroHttp(404, "Motivo não encontrado.");
  if ((await db.lead.count({ where: { motivoPerda: codigo } })) || (await db.leadExcluidoMetrica.count({ where: { motivoPerda: codigo } }))) {
    throw new ErroHttp(400, "Algum lead já perdeu por este motivo. Desative em vez de excluir.");
  }
  if (motivo.ativo && todos.filter((m) => m.ativo).length <= 1) throw new ErroHttp(400, "Precisa sobrar pelo menos um motivo ativo.");
  await db.motivoPerda.delete({ where: { codigo } });
  await marcarMudanca();
}
