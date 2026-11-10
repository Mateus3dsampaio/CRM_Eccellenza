import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { ATALHOS_PAINEL, INDICADORES_DO_PAINEL, datasDosAtalhos } from "@/regras/painel";
import { gerarHtmlDoPainel, type DadosDoPainelExportado } from "@/regras/painel-html";
import { ETAPAS_FUNIL } from "@/regras/etapas";
import { chaveDia, formatarDataHora } from "@/regras/tempo";
import { nomesDasEtapas } from "./etapas";
import { compromissosDoPainel, encerradosDoPainel, painelZeradoEm } from "./painel-dados";
import { motivosDePerda } from "./vendas";

/**
 * Reúne tudo o que o Painel mostra, por dia, para o arquivo HTML (tudo que existe desde o último "Zerar painel").
 * A mesma fonte do Painel (`painel-dados.ts`), então os números do arquivo batem com a tela.
 */
export async function dadosParaExportar(): Promise<DadosDoPainelExportado> {
  const quando = await agora();
  const zeradoEm = await painelZeradoEm();
  const depois = (d: Date | null) => (d && (!zeradoEm || d >= zeradoEm) ? d : null);
  const nomes = await nomesDasEtapas();
  const consultores = await db.usuario.findMany({ where: { perfil: "consultor" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const eventos = await db.eventoMetrica.findMany({ where: zeradoEm ? { ocorridoEm: { gte: zeradoEm } } : {}, select: { tipo: true, consultorId: true, ocorridoEm: true }, orderBy: { ocorridoEm: "asc" } });
  const atalhos = datasDosAtalhos(quando);
  return {
    geradoEm: quando.toISOString(),
    geradoEmTexto: formatarDataHora(quando),
    zeradoEmTexto: zeradoEm ? formatarDataHora(zeradoEm) : null,
    atalhos: ATALHOS_PAINEL.map((a) => ({ codigo: a.codigo, nome: a.nome, ...atalhos[a.codigo] })),
    consultores,
    motivos: (await motivosDePerda()).map((m) => ({ codigo: m.codigo, nome: m.nome, pergunta: m.pergunta })),
    indicadores: INDICADORES_DO_PAINEL.map(([tipo, nome]) => ({ tipo, nome })),
    funil: ETAPAS_FUNIL.map((e) => ({ tipo: `etapa_${e}`, nome: nomes[e] })),
    eventos: eventos.map((e) => ({ t: e.tipo, c: e.consultorId, d: chaveDia(e.ocorridoEm) })),
    encerrados: (await encerradosDoPainel())
      .filter((e) => depois(e.quando))
      .map((e) => ({ e: e.etapa, m: e.motivo, conc: e.concorrente, v: e.valor, d: chaveDia(e.quando), c: e.consultorId, nl: e.naoELead })),
    compromissos: (await compromissosDoPainel())
      .map((c) => ({ ...c, medicao: depois(c.medicao), apresentacao: depois(c.apresentacao) }))
      .filter((c) => c.medicao || c.apresentacao)
      .map((c) => ({ c: c.consultorId, md: c.medicao ? chaveDia(c.medicao) : null, mt: c.medicao?.getTime() ?? null, ad: c.apresentacao ? chaveDia(c.apresentacao) : null, at: c.apresentacao?.getTime() ?? null, f: c.fechou })),
  };
}

export async function exportarPainelEmHtml(): Promise<{ nomeArquivo: string; html: string }> {
  const dados = await dadosParaExportar();
  return { nomeArquivo: `painel-eccellenza-${chaveDia(await agora())}.html`, html: gerarHtmlDoPainel(dados) };
}
