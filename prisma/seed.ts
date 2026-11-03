// Dados de exemplo – TODOS FICTÍCIOS (SEG-02). Nomes e telefones inventados (faixa +55 88 90000-xxxx).
// Senhas de teste do simulador (não usar fora dele): mateus / mateus123 · rafael / rafael123 · beatriz / beatriz123
import { PrismaClient } from "@prisma/client";
import { rm } from "node:fs/promises";
import path from "node:path";
import { gerarHashSenha } from "../src/lib/senha";
import { gerarResumo } from "../src/servicos/resumo";
import { DIA, HORA, dataLocal, partesLocais, somarDias } from "../src/regras/tempo";
import { chaveVaga, horasDeInicio } from "../src/regras/agenda";

const db = new PrismaClient();

async function main() {
  // Banco limpo a cada seed.
  await db.eventoMetrica.deleteMany();
  await db.alerta.deleteMany();
  await db.lead.deleteMany();
  await db.bloqueio.deleteMany();
  await db.usuario.deleteMany();
  await db.registroRotina.deleteMany();
  await db.configuracao.deleteMany();
  await db.instrucao.deleteMany();
  await rm(path.join(process.cwd(), "midias"), { recursive: true, force: true });

  const agora = new Date();
  const mateus = await db.usuario.create({ data: { nome: "Mateus", login: "mateus", senhaHash: gerarHashSenha("mateus123"), perfil: "admin" } });
  const rafael = await db.usuario.create({ data: { nome: "Rafael Lima", login: "rafael", senhaHash: gerarHashSenha("rafael123"), perfil: "consultor" } });
  const beatriz = await db.usuario.create({ data: { nome: "Beatriz Alencar", login: "beatriz", senhaHash: gerarHashSenha("beatriz123"), perfil: "consultor" } });
  void mateus;

  // Próximo dia de funcionamento às 10h, para as visitas de exemplo.
  function proximoDiaUtil(diasAFrente: number, hora: number) {
    let d = somarDias(agora, diasAFrente);
    while (horasDeInicio(partesLocais(d).diaSemana).length === 0 || horasDeInicio(partesLocais(d).diaSemana).at(-1)! < hora) d = somarDias(d, 1);
    const p = partesLocais(d);
    return dataLocal(p.ano, p.mes, p.dia, hora);
  }

  type Msg = [autor: "cliente" | "bot" | "consultor", texto: string, minutosAtras: number];
  const exemplos: {
    tel: string; nome: string; etapa: string; cidade?: string; ambientes?: string[]; investimento?: string; situacao?: string; prazo?: string;
    exigencias?: string[]; pedidos?: string[]; etiquetas?: string[]; classificacao?: string; consultor?: string; aguardando?: boolean; modo?: string;
    msgs: Msg[]; visita?: Date; criadoDiasAtras: number;
  }[] = [
    { tel: "+5588900000101", nome: "Ana Souza", etapa: "novo", criadoDiasAtras: 0, ambientes: ["cozinha"],
      msgs: [["cliente", "Oi, quero fazer minha cozinha", 40], ["bot", "Oi, Ana, tudo bem? 😊 Qual ambiente você tem interesse em fazer?", 39], ["cliente", "cozinha", 30], ["bot", "Certo! E o projeto será em qual cidade?", 29]] },
    { tel: "+5588900000102", nome: "Carlos Bezerra", etapa: "novo", cidade: "Crato", ambientes: ["cozinha", "quarto de casal"], criadoDiasAtras: 0,
      msgs: [["cliente", "Quero cozinha e quarto de casal", 120], ["bot", "Certo! E o projeto será em qual cidade?", 119], ["cliente", "Crato", 100], ["bot", "Certo. Você já tem um projeto ou planta com as medidas, ou prefere que a gente desenvolva o projeto para você?", 99]] },
    { tel: "+5588900000103", nome: "Fernanda Lima", etapa: "pronto", cidade: "Juazeiro do Norte", ambientes: ["cozinha"], investimento: "R$ 20–30 mil", situacao: "apartamento pronto", prazo: "mudança em 2 meses",
      classificacao: "qualificado", consultor: rafael.id, aguardando: true, modo: "pausado", criadoDiasAtras: 1,
      msgs: [["cliente", "Quero fazer a cozinha do apartamento", 1500], ["bot", "Ok, entendi seu projeto! Vou passar para nosso consultor seguir com seu orçamento, tudo bem?", 1400], ["cliente", "Pode sim", 1390]] },
    { tel: "+5588900000104", nome: "Arq. Juliana Moreira", etapa: "pronto", cidade: "Juazeiro do Norte", ambientes: ["casa completa"], etiquetas: ["parceiro"], classificacao: "parceiro",
      consultor: beatriz.id, aguardando: true, modo: "pausado", criadoDiasAtras: 2,
      msgs: [["cliente", "Sou arquiteta, tenho um cliente que quer fechar a casa toda.", 2900], ["bot", "Certo! Vou passar seu contato para um dos nossos consultores, que vai falar com você em seguida.", 2899]] },
    { tel: "+5588900000105", nome: "Roberto Alves", etapa: "pronto", cidade: "Iguatu", ambientes: ["cozinha"], etiquetas: ["outra_cidade"], classificacao: "outra_cidade",
      consultor: rafael.id, aguardando: true, modo: "pausado", criadoDiasAtras: 2,
      msgs: [["cliente", "Quero cozinha, é em Iguatu.", 2800], ["bot", "Certo! Vou passar seu contato para um dos nossos consultores, que vai falar com você em seguida.", 2799]] },
    { tel: "+5588900000106", nome: "Patrícia Gomes", etapa: "visita", cidade: "Barbalha", ambientes: ["cozinha", "área gourmet"], exigencias: ["cores claras", "cooktop na ilha"],
      pedidos: ["quero aproveitar a bancada de granito"], situacao: "casa em obra", prazo: "fim da obra em março", classificacao: "qualificado", consultor: beatriz.id, modo: "pausado",
      visita: proximoDiaUtil(2, 10), criadoDiasAtras: 3,
      msgs: [["cliente", "Pode ser nesse horário", 3000], ["bot", "Certo! Sua visita está agendada. O consultor vai te receber na loja. 😊", 2999]] },
    { tel: "+5588900000107", nome: "Marcos Tavares", etapa: "visita", cidade: "Juazeiro do Norte", ambientes: ["closet"], classificacao: "qualificado", consultor: rafael.id, modo: "pausado",
      visita: proximoDiaUtil(3, 15), criadoDiasAtras: 4, msgs: [["cliente", "Combinado, até lá", 4000], ["bot", "Certo! Até lá. 😊", 3999]] },
    { tel: "+5588900000108", nome: "Luciana Ribeiro", etapa: "orcamento", cidade: "Crato", ambientes: ["cozinha", "lavanderia"], investimento: "R$ 35 mil", consultor: beatriz.id, modo: "humano", criadoDiasAtras: 8,
      msgs: [["consultor", "Luciana, obrigado pela visita! Qualquer dúvida sobre o orçamento estou por aqui.", 6000], ["cliente", "Obrigada! Vou conversar com meu marido.", 5900]] },
    { tel: "+5588900000109", nome: "Diego Nascimento", etapa: "negociacao", cidade: "Juazeiro do Norte", ambientes: ["home office", "quarto de solteiro"], consultor: rafael.id, modo: "humano", aguardando: true, criadoDiasAtras: 10,
      msgs: [["cliente", "Consegue ver uma condição melhor no cartão?", 60]] },
    { tel: "+5588900000110", nome: "Sofia Martins", etapa: "fechado", cidade: "Barbalha", ambientes: ["cozinha"], consultor: beatriz.id, modo: "humano", criadoDiasAtras: 20,
      msgs: [["cliente", "Fechado! Obrigada pelo atendimento.", 9000]] },
    { tel: "+5588900000111", nome: "Henrique Castro", etapa: "perdido", cidade: "Juazeiro do Norte", ambientes: ["cozinha"], consultor: rafael.id, modo: "humano", criadoDiasAtras: 15,
      msgs: [["cliente", "Vou deixar para o ano que vem.", 12000]] },
    { tel: "+5588900000112", nome: "Vera Lúcia", etapa: "sem_resposta", ambientes: ["quarto de casal"], etiquetas: ["retomada"], criadoDiasAtras: 9,
      msgs: [["cliente", "Quero um guarda-roupa", 12960], ["bot", "Certo! E o projeto será em qual cidade?", 12959], ["bot", "Oi! Passando para saber se você ainda tem interesse no seu projeto de móveis planejados. Se quiser, é só responder por aqui que seguimos com o atendimento. 😊", 8640]] },
    { tel: "+5588900000113", nome: "Antônio Pereira", etapa: "sem_resposta", criadoDiasAtras: 12,
      msgs: [["cliente", "Quanto custa uma cozinha?", 17000], ["bot", "O orçamento é personalizado para cada projeto. Qual ambiente você tem interesse em fazer?", 16999]] },
    { tel: "+5588900000114", nome: "Rita de Cássia", etapa: "pronto", cidade: "Juazeiro do Norte", etiquetas: ["pos_venda"], classificacao: "pos_venda", consultor: beatriz.id, aguardando: true, modo: "pausado", criadoDiasAtras: 0,
      msgs: [["cliente", "Comprei com vocês, quando vem a montagem?", 15], ["bot", "Certo! Vou passar seu contato para um dos nossos consultores, que vai falar com você em seguida.", 14]] },
  ];

  let i = 0;
  for (const e of exemplos) {
    const criadoEm = new Date(agora.getTime() - e.criadoDiasAtras * DIA - HORA);
    const ultima = e.msgs.at(-1)!;
    const ultimaEm = new Date(agora.getTime() - ultima[2] * 60_000);
    const ultimaCliente = [...e.msgs].reverse().find((m) => m[0] === "cliente");
    const ultimaLoja = [...e.msgs].reverse().find((m) => m[0] !== "cliente");
    const consultorNome = e.consultor === rafael.id ? rafael.nome : e.consultor === beatriz.id ? beatriz.nome : "";
    const resumo = gerarResumo({
      nome: e.nome, nomePerfil: e.nome, cidade: e.cidade ?? null, situacaoImovel: e.situacao ?? null, prazo: e.prazo ?? null,
      ambientes: e.ambientes ?? [], exigencias: e.exigencias ?? [], pedidosTecnicos: e.pedidos ?? [], investimento: e.investimento ?? null,
      classificacao: e.classificacao ?? null, medidas: [], visita: e.visita ? { inicio: e.visita, consultorNome } : null,
    });
    const lead = await db.lead.create({
      data: {
        telefone: e.tel, nomePerfil: e.nome, nome: e.nome, avatarCor: i % 6, cidade: e.cidade, ambientes: JSON.stringify(e.ambientes ?? []),
        exigencias: JSON.stringify(e.exigencias ?? []), pedidosTecnicos: JSON.stringify(e.pedidos ?? []), investimento: e.investimento,
        situacaoImovel: e.situacao, prazo: e.prazo, classificacao: e.classificacao, etapa: e.etapa, etiquetas: JSON.stringify(e.etiquetas ?? []),
        consultorId: e.consultor, modoAtendimento: e.modo ?? "bot", aguardandoHumano: e.aguardando ?? false, resumo,
        etapaAnterior: e.etapa === "sem_resposta" ? "novo" : null,
        repassadoEm: e.consultor && e.etapa !== "novo" ? new Date(Math.min(agora.getTime(), criadoEm.getTime() + 30 * 60_000)) : null,
        retomadaEnviadaEm: e.etiquetas?.includes("retomada") ? new Date(agora.getTime() - 8640 * 60_000) : null,
        ultimaMensagemEm: ultimaEm, ultimaMensagemPrevia: ultima[1].slice(0, 140),
        ultimaMsgClienteEm: ultimaCliente ? new Date(agora.getTime() - ultimaCliente[2] * 60_000) : null,
        esperandoDesde: e.aguardando && ultimaCliente ? new Date(agora.getTime() - ultimaCliente[2] * 60_000) : null,
        naoLidas: e.aguardando ? 1 : 0,
        ultimaMsgLojaEm: ultimaLoja ? new Date(agora.getTime() - ultimaLoja[2] * 60_000) : null,
        criadoEm, ordem: -ultimaEm.getTime(), conversaApi: { create: {} },
        mensagens: {
          create: e.msgs.map(([autor, texto, min]) => ({
            autor, texto, autorNome: autor === "bot" ? "Bot" : autor === "consultor" ? consultorNome : null,
            enviadaEm: new Date(agora.getTime() - min * 60_000), status: autor === "cliente" ? "lido" : "lido", lidaEm: new Date(agora.getTime() - min * 60_000 + 60_000),
          })),
        },
        historico: { create: [{ autor: "sistema", descricao: "Lead criado (dados de exemplo)", criadoEm }] },
      },
    });
    if (e.visita && e.consultor) {
      await db.visita.create({
        data: { leadId: lead.id, consultorId: e.consultor, inicio: e.visita, fim: new Date(e.visita.getTime() + HORA), vagaChave: chaveVaga(e.consultor, e.visita), criadoPor: "bot", criadoEm: criadoEm },
      });
    }
    // Contadores anônimos de exemplo, coerentes com os leads acima.
    const eventos = ["lead_novo", "etapa_novo"];
    const ordemFunil = ["pronto", "visita", "orcamento", "negociacao", "fechado"];
    const alcance = ordemFunil.indexOf(e.etapa);
    for (const etapa of ordemFunil.slice(0, alcance + 1)) if (etapa !== "negociacao") eventos.push(`etapa_${etapa}`);
    if (e.classificacao) eventos.push(e.classificacao);
    if (e.etapa === "sem_resposta") eventos.push("sem_resposta");
    if (e.etiquetas?.includes("retomada")) eventos.push("retomada_enviada");
    for (const tipo of eventos) await db.eventoMetrica.create({ data: { tipo, ocorridoEm: criadoEm } });
    if (e.visita && e.consultor) await db.eventoMetrica.create({ data: { tipo: "visita_agendada", consultorId: e.consultor, ocorridoEm: criadoEm } });
    await db.lead.update({ where: { id: lead.id }, data: { marcasMetricas: JSON.stringify(eventos) } });
    // Histórico de etapas de exemplo: nasce em "novo" e anda pelo funil até a etapa atual (usado pela exportação e pelo Painel por vendedor).
    const caminho = ["novo", ...(alcance >= 0 ? ordemFunil.slice(0, alcance + 1) : e.etapa === "perdido" || e.etapa === "sem_resposta" ? [e.etapa] : [])];
    for (const [k, para] of caminho.entries()) {
      const quando = new Date(Math.min(agora.getTime(), criadoEm.getTime() + k * 30 * 60_000));
      await db.mudancaEtapa.create({ data: { leadId: lead.id, de: k ? caminho[k - 1] : null, para, autor: k ? "bot" : "sistema", criadoEm: quando } });
    }
    i++;
  }

  // Um bloqueio de exemplo (consultor em treinamento).
  const bloqueio = proximoDiaUtil(1, 14);
  await db.bloqueio.create({ data: { consultorId: rafael.id, inicio: bloqueio, fim: new Date(bloqueio.getTime() + 2 * HORA), motivo: "Treinamento na fábrica (exemplo)", criadoEm: agora } });

  console.log(`Seed concluído: 3 usuários, ${exemplos.length} leads fictícios.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
