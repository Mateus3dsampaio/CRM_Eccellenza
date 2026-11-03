import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { montarZip } from "@/lib/zip";
import { PASTA_MIDIAS } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { TEXTO_CONFIRMA_PARAR } from "@/regras/optout";
import { registrarAlteracao } from "./historico";
import { alterarEtiqueta, excluirLeads } from "./leads";
import { enviarMensagemLoja } from "./mensagens";

const fim = (telefone: string) => telefone.replace(/\D/g, "").slice(-4);

/** Exclusão pedida por uma pessoa (cliente ou admin): apaga tudo e guarda só que foi feito e quando (sem o conteúdo). */
export async function excluirComRegistro(ids: string[], quem: string): Promise<number> {
  const leads = await db.lead.findMany({ where: { id: { in: ids } }, select: { id: true, telefone: true } });
  const total = await excluirLeads(leads.map((l) => l.id));
  if (total) {
    await db.pedidoLgpd.createMany({ data: leads.map((l) => ({ acao: "exclusao", quem, telefoneFim: fim(l.telefone) })) });
  }
  return total;
}

/** O cliente pediu para parar: sem retomada nem bot, etiqueta na ficha e uma confirmação (texto PROVISÓRIO). */
export async function registrarPedidoParar(leadId: string): Promise<void> {
  const quando = await agora();
  const r = await db.lead.updateMany({ where: { id: leadId, naoReceberEm: null }, data: { naoReceberEm: quando } });
  if (!r.count) return;
  await alterarEtiqueta(leadId, "nao_receber", true, "sistema");
  await registrarAlteracao(leadId, "sistema", "Cliente pediu para parar de receber mensagens automáticas");
  await enviarMensagemLoja({ leadId, autor: "sistema", autorNome: "Sistema", texto: TEXTO_CONFIRMA_PARAR });
  await marcarMudanca();
}

/** Um humano resolveu voltar a atender (ex.: o cliente mudou de ideia): libera o bot e as rotinas. */
export async function liberarPedidoParar(leadId: string): Promise<void> {
  const r = await db.lead.updateMany({ where: { id: leadId, naoReceberEm: { not: null } }, data: { naoReceberEm: null } });
  if (r.count) await alterarEtiqueta(leadId, "nao_receber", false, "sistema");
}

/** Direito de acesso: tudo o que o CRM guarda de um cliente, em um .zip (dados em JSON + as fotos). */
export async function exportarDadosDoCliente(leadId: string, quem: string): Promise<{ nome: string; zip: Buffer }> {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { mensagens: { orderBy: { enviadaEm: "asc" } }, medidas: true, notas: true, visitas: true, historico: true, mudancasEtapa: true },
  });
  const arquivos: { nome: string; conteudo: string | Buffer }[] = [];
  const { mensagens, ...dados } = lead;
  arquivos.push({ nome: "dados-do-cliente.json", conteudo: JSON.stringify({ ...dados, mensagens: mensagens.map((m) => {
          const copia: Record<string, unknown> = { ...m };
          delete copia.idExterno;
          delete copia.processadaPeloBot;
          return copia;
        }) }, null, 2) });
  for (const m of mensagens) {
    if (!m.midiaArquivo) continue;
    const dadosArquivo = await readFile(path.join(PASTA_MIDIAS, path.basename(m.midiaArquivo))).catch(() => null);
    if (dadosArquivo) arquivos.push({ nome: `midias/${path.basename(m.midiaArquivo)}`, conteudo: dadosArquivo });
  }
  await db.pedidoLgpd.create({ data: { acao: "exportacao", quem, telefoneFim: fim(lead.telefone) } });
  return { nome: `dados-cliente-${fim(lead.telefone)}.zip`, zip: montarZip(arquivos) };
}
