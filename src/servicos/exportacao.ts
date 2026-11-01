import { db } from "@/lib/db";
import { lerMidia } from "@/lib/midias";
import { agora } from "@/lib/relogio";
import { ErroHttp } from "@/lib/sessao";
import { montarZip } from "@/lib/zip";
import { CODIGOS_ETAPA, ETAPAS, nomeEtapa } from "@/regras/etapas";
import { emMinutos, montarCsv, validarPeriodo } from "@/regras/exportacao";
import { estatisticaDeTempos, primeiraRespostaDoConsultor, temposDoConsultor, turnosDoCliente } from "@/regras/tempo-resposta";
import { formatarData, formatarDataHora } from "@/regras/tempo";

export interface PedidoExportacao {
  vendedorId: string;
  de: string; // AAAA-MM-DD
  ate: string;
  incluirMidia: boolean;
}

type Arquivo = { nome: string; conteudo: string | Buffer };

const ROTULO_MIDIA: Record<string, string> = { imagem: "imagem", foto: "foto", planta: "planta", audio: "áudio" };

/**
 * Exporta o desempenho de um vendedor num .zip para analisar fora do CRM (Claude Code): números, mudanças de etapa
 * e uma conversa por arquivo. Sem telefone nem nome do cliente. Mídias só se pedido. O bot e o consultor ficam separados.
 */
export async function exportarDesempenho(pedido: PedidoExportacao): Promise<{ nomeArquivo: string; zip: Buffer }> {
  const vendedor = await db.usuario.findUnique({ where: { id: pedido.vendedorId } });
  if (!vendedor) throw new ErroHttp(404, "Vendedor não encontrado.");
  let periodo;
  try {
    periodo = validarPeriodo(pedido.de, pedido.ate, await agora());
  } catch (e) {
    throw new ErroHttp(400, e instanceof Error ? e.message : "Período inválido.");
  }
  const { inicio, fim } = periodo;
  const noPeriodo = (d: Date) => d >= inicio && d < fim;

  const leads = await db.lead.findMany({
    where: {
      consultorId: vendedor.id,
      OR: [{ criadoEm: { gte: inicio, lt: fim } }, { mensagens: { some: { enviadaEm: { gte: inicio, lt: fim } } } }],
    },
    include: { mensagens: { orderBy: { enviadaEm: "asc" } }, mudancasEtapa: { orderBy: { criadoEm: "asc" } } },
    orderBy: { criadoEm: "asc" },
  });

  const arquivos: Arquivo[] = [];
  const midiasIncluidas = new Set<string>();
  const linhasLeads: (string | number | boolean | null)[][] = [];
  const linhasMudancas: (string | null)[][] = [];
  const segundosConsultor: number[] = [];
  const segundosPrimeira: number[] = [];
  const segundosBot: number[] = [];
  const chegaramNaEtapa = new Map<string, Set<string>>();
  const totais = { cliente: 0, bot: 0, consultor: 0, turnos: 0, semResposta: 0, atendidos: 0, novos: 0 };

  for (const lead of leads) {
    const doPeriodo = lead.mensagens.filter((m) => noPeriodo(m.enviadaEm));
    const contar = (autor: string) => doPeriodo.filter((m) => m.autor === autor).length;
    const turnos = turnosDoCliente(lead.mensagens, inicio, fim);
    const doConsultor = temposDoConsultor(lead.mensagens, inicio, fim);
    const primeira = lead.repassadoEm ? primeiraRespostaDoConsultor(lead.repassadoEm, lead.mensagens) : null;
    const primeiraNoPeriodo = primeira && noPeriodo(primeira.consultorEm) ? primeira.segundos : null;
    if (primeiraNoPeriodo !== null) segundosPrimeira.push(primeiraNoPeriodo);
    const doBot = turnos.filter((t) => t.respondidoPor === "bot");
    const tConsultor = estatisticaDeTempos(doConsultor.map((t) => t.segundos as number));
    segundosConsultor.push(...doConsultor.map((t) => t.segundos as number));
    segundosBot.push(...doBot.map((t) => t.segundos as number));

    totais.cliente += contar("cliente");
    totais.bot += contar("bot");
    totais.consultor += contar("consultor");
    totais.turnos += turnos.length;
    totais.semResposta += turnos.filter((t) => !t.respondidoPor).length;
    if (contar("consultor") > 0) totais.atendidos++;
    if (noPeriodo(lead.criadoEm)) totais.novos++;

    for (const mudanca of lead.mudancasEtapa) {
      if (!noPeriodo(mudanca.criadoEm)) continue;
      linhasMudancas.push([lead.id, formatarDataHora(mudanca.criadoEm), mudanca.de ? nomeEtapa(mudanca.de) : "", nomeEtapa(mudanca.para), mudanca.autor]);
      chegaramNaEtapa.set(mudanca.para, (chegaramNaEtapa.get(mudanca.para) ?? new Set()).add(lead.id));
    }
    const caminho = lead.mudancasEtapa.filter((m) => m.criadoEm < fim).map((m) => nomeEtapa(m.para));

    linhasLeads.push([
      lead.id,
      formatarDataHora(lead.criadoEm),
      nomeEtapa(lead.etapa),
      caminho.join(" > "),
      lead.classificacao ?? "",
      lead.cidade ?? "",
      lead.modoAtendimento,
      contar("cliente"),
      contar("bot"),
      contar("consultor"),
      turnos.length,
      doConsultor.length,
      doBot.length,
      turnos.filter((t) => !t.respondidoPor).length,
      emMinutos(tConsultor.medianaSegundos),
      emMinutos(tConsultor.mediaSegundos),
      emMinutos(primeiraNoPeriodo),
    ]);

    const linhasConversa = [`Lead ${lead.id}`, `Etapa atual: ${nomeEtapa(lead.etapa)}`, `Período: ${formatarData(inicio)} a ${formatarData(new Date(fim.getTime() - 1))} (só as mensagens deste período)`, ""];
    for (const m of doPeriodo) {
      const quem = m.autor === "cliente" ? "Cliente" : m.autor === "bot" ? "Bot" : m.autor === "consultor" ? `Consultor${m.autorNome ? ` (${m.autorNome})` : ""}` : "Sistema";
      const partes: string[] = [];
      if (m.midiaArquivo) {
        const tipo = ROTULO_MIDIA[m.midiaTipo ?? ""] ?? m.midiaTipo ?? "arquivo";
        if (pedido.incluirMidia) {
          try {
            if (!midiasIncluidas.has(m.midiaArquivo)) {
              arquivos.push({ nome: `midias/${m.midiaArquivo}`, conteudo: await lerMidia(m.midiaArquivo) });
              midiasIncluidas.add(m.midiaArquivo);
            }
            partes.push(`[${tipo}: midias/${m.midiaArquivo}]`);
          } catch {
            partes.push(`[${tipo}: arquivo não encontrado]`);
          }
        } else {
          partes.push(`[${tipo} enviada(o), não incluída(o) na exportação]`);
        }
      }
      if (m.texto) partes.push(m.texto);
      else if (m.modelo && !m.midiaArquivo) partes.push(`[modelo de mensagem: ${m.modelo}]`);
      linhasConversa.push(`[${formatarDataHora(m.enviadaEm)}] ${quem}: ${partes.join(" ")}`);
    }
    arquivos.push({ nome: `conversas/${lead.id}.txt`, conteudo: linhasConversa.join("\n") + "\n" });
  }

  const tC = estatisticaDeTempos(segundosConsultor);
  const tB = estatisticaDeTempos(segundosBot);
  const tP = estatisticaDeTempos(segundosPrimeira);
  const atuais = (codigo: string) => leads.filter((l) => l.etapa === codigo).length;
  const resumo: (string | number)[][] = [
    ["vendedor", vendedor.nome],
    ["periodo", `${formatarData(inicio)} a ${formatarData(new Date(fim.getTime() - 1))}`],
    ["leads_do_vendedor_com_atividade_no_periodo", leads.length],
    ["leads_novos_no_periodo", totais.novos],
    ["leads_em_que_o_consultor_escreveu", totais.atendidos],
    ["mensagens_do_cliente", totais.cliente],
    ["mensagens_do_bot", totais.bot],
    ["mensagens_do_consultor", totais.consultor],
    ["vezes_que_o_cliente_escreveu", totais.turnos],
    ["vezes_sem_nenhuma_resposta", totais.semResposta],
    ["respostas_do_consultor", tC.quantidade],
    ["consultor_tempo_mediano_min", emMinutos(tC.medianaSegundos)],
    ["consultor_tempo_medio_min", emMinutos(tC.mediaSegundos)],
    ["consultor_tempo_maximo_min", emMinutos(tC.maximoSegundos)],
    ["leads_com_primeira_resposta_apos_repasse", tP.quantidade],
    ["primeira_resposta_apos_repasse_media_min", emMinutos(tP.mediaSegundos)],
    ["primeira_resposta_apos_repasse_mediana_min", emMinutos(tP.medianaSegundos)],
    ["respostas_do_bot", tB.quantidade],
    ["bot_tempo_mediano_min", emMinutos(tB.medianaSegundos)],
    ["bot_tempo_medio_min", emMinutos(tB.mediaSegundos)],
    ...CODIGOS_ETAPA.map((c): (string | number)[] => [`chegaram_em_${c}`, chegaramNaEtapa.get(c)?.size ?? 0]),
    ...CODIGOS_ETAPA.map((c): (string | number)[] => [`estao_agora_em_${c}`, atuais(c)]),
  ];

  const cabecalhoLeads = [
    "lead_id", "criado_em", "etapa_atual", "caminho_de_etapas", "classificacao", "cidade", "modo_atendimento",
    "msgs_cliente", "msgs_bot", "msgs_consultor", "vezes_que_o_cliente_escreveu", "respondidas_pelo_consultor", "respondidas_pelo_bot",
    "sem_resposta", "consultor_mediana_min", "consultor_media_min", "primeira_resposta_apos_repasse_min",
  ];

  arquivos.unshift(
    { nome: "LEIAME.md", conteudo: leiame(vendedor.nome, formatarData(inicio), formatarData(new Date(fim.getTime() - 1)), pedido.incluirMidia, leads.length) },
    { nome: "resumo.csv", conteudo: montarCsv(["indicador", "valor"], resumo) },
    { nome: "leads.csv", conteudo: montarCsv(cabecalhoLeads, linhasLeads) },
    { nome: "mudancas-de-etapa.csv", conteudo: montarCsv(["lead_id", "quando", "de", "para", "quem_moveu"], linhasMudancas) },
  );

  const nomeVendedor = vendedor.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "vendedor";
  return { nomeArquivo: `desempenho-${nomeVendedor}-${pedido.de}-a-${pedido.ate}.zip`, zip: montarZip(arquivos) };
}

function leiame(vendedor: string, de: string, ate: string, midia: boolean, totalLeads: number): string {
  const etapas = ETAPAS.map((e) => `\`${e.codigo}\` = ${e.nome}`).join("; ");
  return `# Exportação de desempenho: ${vendedor}

Período: ${de} a ${ate} (horário de Fortaleza). Leads incluídos: ${totalLeads} (os que são do vendedor e tiveram criação ou mensagem no período).
Mídias (fotos, plantas): ${midia ? "incluídas na pasta \`midias/\`." : "não incluídas."}

## Arquivos
- \`resumo.csv\`: números do vendedor no período (tempo de resposta, quantidades, quantos leads chegaram em cada etapa).
- \`leads.csv\`: uma linha por lead, com o caminho de etapas e os tempos de resposta.
- \`mudancas-de-etapa.csv\`: cada mudança de etapa no período (de, para, quando, quem moveu).
- \`conversas/<lead_id>.txt\`: a conversa de cada lead no período, com horário e quem escreveu (Cliente, Bot, Consultor, Sistema).

## Como ler os números
- **Tempo de resposta do consultor** (\`consultor_*\`): em toda resposta dele, da primeira mensagem do cliente que ficou sem resposta até a mensagem do consultor. Se o bot respondeu no meio, a espera recomeça. Contato iniciado pelo consultor não entra.
- **Primeira resposta após o repasse** (\`primeira_resposta_apos_repasse_*\`): da hora em que o bot passou o lead ao consultor até a primeira mensagem do consultor. Só existe para leads repassados depois que este registro foi ativado.
- **Tempo do bot e geral** (\`bot_*\`): do momento em que o cliente escreve (vários recados seguidos contam como um) até a primeira mensagem do bot ou do consultor. Mensagens do sistema (retomada, aviso de almoço) não contam.
- O tempo corre o dia todo, inclusive noite, domingo e almoço. Ele não desconta o horário de funcionamento da loja.
- **Vezes sem resposta**: o cliente escreveu e ninguém respondeu até hoje.
- **Chegaram em cada etapa**: leads que tiveram uma mudança para aquela etapa dentro do período, como foi anotado no CRM. O bot também move cards (ex.: Novo → Pronto) e isso aparece em \`quem_moveu\`.
- Mudanças de etapa só existem a partir do dia em que este registro foi ativado no CRM.
- Etapas: ${etapas}.

## Privacidade
Sem telefone e sem nome do cliente, mas o texto das conversas pode conter nomes, endereços e telefones. Guarde só no seu computador e não envie a ninguém de fora da loja.
`;
}
