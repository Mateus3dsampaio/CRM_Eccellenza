import { db } from "@/lib/db";
import { apagarMidia, listarMidiasAntigasDaPasta, tamanhoDaPasta } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { marcarMudanca } from "@/lib/versao";
import { DIA } from "@/regras/tempo";
import { DIAS_MIDIA_ATE_APAGAR, familiaDoTipo, nomeSeguroDeArquivo, rotuloDoArquivo, ROTULO_FAMILIA, TIPO_GENERICO, TIPOS_MIDIA, type FamiliaMidia } from "@/regras/midia";
import { nomeExibicao } from "@/regras/telefone";
import { registrarAlteracao } from "./historico";

// Mídias (imagem, vídeo, PDF): apagar, medir, listar na galeria. O arquivo fica no disco (Volume do Railway); a linha da mensagem fica
// com um aviso no lugar, para a conversa não ficar com buraco.

/** Apaga o arquivo de uma mensagem. A mensagem continua, com o aviso do motivo. Devolve false se não havia arquivo. */
export async function apagarMidiaDaMensagem(mensagemId: string, motivo: string, quem?: string): Promise<boolean> {
  const m = await db.mensagem.findUnique({ where: { id: mensagemId } });
  if (!m?.midiaArquivo) return false;
  // Primeiro o banco, de forma que só UM pedido (você e a rotina ao mesmo tempo) ganha; depois o arquivo.
  // Se apagar o arquivo falhar, ele fica solto no disco e a varredura de arquivos soltos limpa depois.
  const r = await db.mensagem.updateMany({
    where: { id: m.id, midiaArquivo: m.midiaArquivo },
    data: { midiaArquivo: null, midiaTipo: null, midiaNome: null, midiaBytes: null, texto: [m.texto, `[arquivo apagado ${motivo}]`].filter(Boolean).join("\n") },
  });
  if (r.count !== 1) return false;
  await apagarMidia(m.midiaArquivo).catch(() => undefined);
  if (quem) await registrarAlteracao(m.leadId, quem, `Apagou um arquivo da conversa (${motivo})`);
  await marcarMudanca();
  return true;
}

/** Rotina: apaga arquivos com mais de 180 dias (decisão do Mateus). Um erro numa mensagem não para as outras. Lote por vez. */
export async function apagarMidiasAntigas(limite = 200): Promise<number> {
  const corte = new Date((await agora()).getTime() - DIAS_MIDIA_ATE_APAGAR * DIA);
  const antigas = await db.mensagem.findMany({ where: { midiaArquivo: { not: null }, enviadaEm: { lt: corte } }, select: { id: true }, orderBy: { enviadaEm: "asc" }, take: limite });
  let total = 0;
  for (const m of antigas) {
    try {
      if (await apagarMidiaDaMensagem(m.id, `automaticamente após ${DIAS_MIDIA_ATE_APAGAR} dias`)) total++;
    } catch {
      console.error("[midias] não consegui apagar um arquivo antigo; sigo com os outros");
    }
  }
  return total;
}

/**
 * Rotina: apaga arquivos soltos na pasta (gravados há mais de 1 dia e sem nenhuma mensagem que aponte para eles).
 * Sobram quando algo falha entre guardar o arquivo e gravar a mensagem. Sem isso o dado do cliente ficaria para sempre.
 */
export async function apagarMidiasSoltas(): Promise<number> {
  const candidatos = await listarMidiasAntigasDaPasta(new Date(Date.now() - DIA));
  let total = 0;
  for (let i = 0; i < candidatos.length; i += 500) {
    const lote = candidatos.slice(i, i + 500);
    const usados = new Set((await db.mensagem.findMany({ where: { midiaArquivo: { in: lote } }, select: { midiaArquivo: true } })).map((m) => m.midiaArquivo));
    for (const nome of lote) {
      if (usados.has(nome)) continue;
      await apagarMidia(nome).then(() => total++).catch(() => undefined);
    }
  }
  return total;
}

export interface ResumoDeMidias {
  arquivos: number;
  bytes: number;
}

/** Quantos arquivos (e quantos bytes) seriam apagados junto com estes leads (ou com todos os leads de uma coluna). Para avisar antes de excluir. */
export async function resumoDeMidias(alvo: { ids?: string[]; etapa?: string }): Promise<ResumoDeMidias> {
  const lead = alvo.ids ? { id: { in: alvo.ids } } : alvo.etapa ? { etapa: alvo.etapa, arquivadoEm: null } : { id: "nenhum" };
  const soma = await db.mensagem.aggregate({ where: { midiaArquivo: { not: null }, lead }, _count: { _all: true }, _sum: { midiaBytes: true } });
  return { arquivos: soma._count._all, bytes: soma._sum.midiaBytes ?? 0 };
}

export interface Armazenamento {
  arquivos: number;
  bytes: number;
  /** Tamanho do disco em bytes, se o admin informou em MIDIAS_LIMITE_MB (o Railway não avisa o app). */
  limiteBytes: number | null;
}

export async function armazenamento(env: Record<string, string | undefined> = process.env): Promise<Armazenamento> {
  const pasta = await tamanhoDaPasta();
  const mb = Number(env.MIDIAS_LIMITE_MB);
  return { ...pasta, limiteBytes: Number.isFinite(mb) && mb > 0 ? Math.round(mb * 1024 * 1024) : null };
}

export interface ItemDaGaleria {
  mensagemId: string;
  arquivo: string;
  tipo: string;
  familia: FamiliaMidia;
  rotulo: string;
  nome: string;
  bytes: number | null;
  enviadaEm: string;
  daLoja: boolean;
  leadId: string;
  leadNome: string;
  /** Dias que faltam para o apagamento automático (só vem quando faltam 30 ou menos). */
  apagaEmDias: number | null;
}

export interface Galeria {
  itens: ItemDaGaleria[];
  total: number;
  bytes: number;
  vendedores: { id: string; nome: string }[];
}

const POR_TIPO: Record<FamiliaMidia, object> = {
  imagem: { midiaTipo: { startsWith: "image/" } },
  video: { midiaTipo: { startsWith: "video/" } },
  documento: { midiaTipo: { in: [...Object.keys(TIPOS_MIDIA).filter((t) => TIPOS_MIDIA[t].familia === "documento"), TIPO_GENERICO] } },
};

/** Galeria: as mídias dos leads do vendedor (o admin vê todas e pode filtrar por vendedor). */
export async function listarGaleria(
  usuario: { id: string; perfil: string },
  filtro: { familia?: FamiliaMidia; vendedorId?: string; limite?: number; deslocamento?: number } = {},
): Promise<Galeria> {
  const admin = usuario.perfil === "admin";
  const donoDoLead = admin ? (filtro.vendedorId === "sem" ? { consultorId: null } : filtro.vendedorId ? { consultorId: filtro.vendedorId } : {}) : { consultorId: usuario.id };
  const where = { midiaArquivo: { not: null }, lead: donoDoLead, ...(filtro.familia ? POR_TIPO[filtro.familia] : {}) };
  const quando = await agora();
  const [mensagens, soma, vendedores] = await Promise.all([
    db.mensagem.findMany({
      where,
      orderBy: { enviadaEm: "desc" },
      take: Math.min(filtro.limite ?? 60, 200),
      skip: filtro.deslocamento ?? 0,
      include: { lead: { select: { id: true, nome: true, nomePerfil: true, telefone: true } } },
    }),
    db.mensagem.aggregate({ where, _count: { _all: true }, _sum: { midiaBytes: true } }),
    admin ? db.usuario.findMany({ where: { perfil: "consultor", ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
  ]);
  const itens: ItemDaGaleria[] = mensagens.flatMap((m) => {
    const familia = m.midiaTipo ? familiaDoTipo(m.midiaTipo) : null;
    if (!m.midiaArquivo || !m.midiaTipo || !familia) return [];
    const restam = Math.ceil((m.enviadaEm.getTime() + DIAS_MIDIA_ATE_APAGAR * DIA - quando.getTime()) / DIA);
    return [
      {
        mensagemId: m.id,
        arquivo: m.midiaArquivo,
        tipo: m.midiaTipo,
        familia,
        rotulo: rotuloDoArquivo(m.midiaTipo, m.midiaNome),
        nome: nomeSeguroDeArquivo(m.midiaNome, ROTULO_FAMILIA[familia]),
        bytes: m.midiaBytes,
        enviadaEm: m.enviadaEm.toISOString(),
        daLoja: m.autor !== "cliente",
        leadId: m.lead.id,
        leadNome: nomeExibicao(m.lead),
        apagaEmDias: restam <= 30 ? Math.max(restam, 0) : null,
      },
    ];
  });
  return { itens, total: soma._count._all, bytes: soma._sum.midiaBytes ?? 0, vendedores };
}
