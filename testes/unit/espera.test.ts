import { beforeEach, describe, expect, it } from "vitest";
import { executarFerramenta } from "@/bot/executor";
import { db } from "@/lib/db";
import { avancarRelogio } from "@/lib/relogio";
import {
  compararParaColuna,
  faixaDeEspera,
  minutosEsperando,
  ordenarParaColuna,
  PRAZOS_ESPERA_PADRAO,
  textoDeEspera,
  validarPrazos, idsCriticosDaColuna } from "@/regras/espera";
import { definirPrazosDeEspera, prazosDeEspera } from "@/servicos/configuracoes";
import { cardsDoKanban, fichaDoLead, leadsAguardando } from "@/servicos/consultas";
import { devolverAoBot, marcarConversaVista } from "@/servicos/conversa";
import { obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { criarConsultores, limparBanco } from "./ajuda";

const MIN = 60_000;
const base = new Date("2026-11-04T12:00:00Z");
const depois = (min: number) => new Date(base.getTime() + min * MIN);
const prazos = { amarelo: 10, vermelho: 30 };

describe("regras de espera (Bloco 1)", () => {
  it("valida os prazos", () => {
    expect(validarPrazos(10, 30)).toBeNull();
    expect(validarPrazos(30, 30)).toMatch(/menor/);
    expect(validarPrazos(40, 30)).toMatch(/menor/);
    expect(validarPrazos(0, 30)).toMatch(/1 minuto/);
    expect(validarPrazos(10, 1441)).toMatch(/24 horas/);
    expect(validarPrazos(1.5, 30)).toMatch(/inteiros/);
    expect(validarPrazos("10", 30)).toMatch(/inteiros/);
  });

  it("escolhe a faixa de cor pelo tempo de espera", () => {
    expect(faixaDeEspera(null, depois(100), prazos)).toBe("normal");
    expect(faixaDeEspera(base, depois(9), prazos)).toBe("normal");
    expect(faixaDeEspera(base, depois(10), prazos)).toBe("amarelo");
    expect(faixaDeEspera(base, depois(29), prazos)).toBe("amarelo");
    expect(faixaDeEspera(base, depois(30), prazos)).toBe("vermelho");
    expect(faixaDeEspera(base.toISOString(), depois(31), prazos)).toBe("vermelho");
  });

  it("conta os minutos e escreve o tempo", () => {
    expect(minutosEsperando(base, depois(12))).toBe(12);
    expect(minutosEsperando(base, new Date(base.getTime() - 5 * MIN))).toBe(0);
    expect(minutosEsperando(null, depois(12))).toBe(0);
    expect(textoDeEspera(0)).toBe("menos de 1 min");
    expect(textoDeEspera(12)).toBe("12 min");
    expect(textoDeEspera(60)).toBe("1 h");
    expect(textoDeEspera(65)).toBe("1 h 05 min");
    expect(textoDeEspera(26 * 60 + 10)).toBe("1 d 2 h");
    expect(textoDeEspera(48 * 60)).toBe("2 d");
  });

  it("ordena: quem espera primeiro (mais antigo no topo), depois o resto pela última mensagem", () => {
    const cards = [
      { id: "resto-velho", esperandoDesde: null, ultimaMensagemEm: depois(1) },
      { id: "espera-recente", esperandoDesde: depois(20), ultimaMensagemEm: depois(20) },
      { id: "resto-novo", esperandoDesde: null, ultimaMensagemEm: depois(50) },
      { id: "espera-antiga", esperandoDesde: depois(5).toISOString(), ultimaMensagemEm: depois(40).toISOString() },
      { id: "sem-mensagem", esperandoDesde: null, ultimaMensagemEm: null },
    ];
    expect(ordenarParaColuna(cards).map((c) => c.id)).toEqual(["espera-antiga", "espera-recente", "resto-novo", "resto-velho", "sem-mensagem"]);
    expect(compararParaColuna(cards[0], cards[0])).toBe(0);
  });
});

describe("card crítico da coluna (tarefa 33)", () => {
  it("só o vermelho mais antigo é crítico; 24 h+ também; amarelo nunca", () => {
    const agora = new Date("2026-11-04T12:00:00Z");
    const ha = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
    const prazos = { amarelo: 10, vermelho: 30 };
    const cards = [
      { id: "amarelo", esperandoDesde: ha(15) },
      { id: "vermelho-novo", esperandoDesde: ha(40) },
      { id: "vermelho-antigo", esperandoDesde: ha(90) },
      { id: "um-dia", esperandoDesde: ha(25 * 60) },
      { id: "sem-espera", esperandoDesde: null },
    ];
    expect([...idsCriticosDaColuna(cards, agora, prazos)].sort()).toEqual(["um-dia"]);
    expect([...idsCriticosDaColuna(cards.slice(0, 3), agora, prazos)]).toEqual(["vermelho-antigo"]);
    expect(idsCriticosDaColuna(cards.slice(0, 1), agora, prazos).size).toBe(0);
  });
});

describe("espera e não lidas no banco (Bloco 1)", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  async function leadComConsultor(telefone: string) {
    const [a] = await criarConsultores();
    const lead = await obterOuCriarLead(telefone, "Cliente");
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: a.id, modoAtendimento: "humano", aguardandoHumano: false } });
    return lead;
  }

  it("com o bot atendendo não há espera nem não lidas", async () => {
    const lead = await obterOuCriarLead("+5588900007001");
    await registrarMensagemCliente(lead.id, "Oi");
    const atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atual.esperandoDesde).toBeNull();
    expect(atual.naoLidas).toBe(0);
  });

  it("com o consultor na conversa, a espera conta da 1ª mensagem sem resposta e a bolinha soma", async () => {
    const lead = await leadComConsultor("+5588900007002");
    await registrarMensagemCliente(lead.id, "Oi, tem novidade?");
    const primeira = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(primeira.aguardandoHumano).toBe(true);
    expect(primeira.naoLidas).toBe(1);
    expect(primeira.esperandoDesde).not.toBeNull();

    await avancarRelogio(5 * MIN);
    await registrarMensagemCliente(lead.id, "Alô?");
    const segunda = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(segunda.naoLidas).toBe(2);
    expect(segunda.esperandoDesde?.getTime()).toBe(primeira.esperandoDesde?.getTime());
  });

  it("abrir a conversa zera a bolinha, mas a espera continua até o consultor responder", async () => {
    const lead = await leadComConsultor("+5588900007003");
    await registrarMensagemCliente(lead.id, "Oi");
    await marcarConversaVista(lead.id);
    let atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atual.naoLidas).toBe(0);
    expect(atual.esperandoDesde).not.toBeNull();
    expect(atual.aguardandoHumano).toBe(true);

    await registrarMensagemCliente(lead.id, "Mais uma");
    await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", autorNome: "Consultor A", texto: "Olá!" });
    atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atual.esperandoDesde).toBeNull();
    expect(atual.naoLidas).toBe(0);
    expect(atual.aguardandoHumano).toBe(false);
  });

  it("mensagem do bot ou do sistema não encerra a espera", async () => {
    const lead = await leadComConsultor("+5588900007004");
    await registrarMensagemCliente(lead.id, "Oi");
    await enviarMensagemLoja({ leadId: lead.id, autor: "sistema", texto: "Aviso automático" });
    const atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atual.esperandoDesde).not.toBeNull();
    expect(atual.naoLidas).toBe(1);
  });

  it("devolver ao bot encerra a espera", async () => {
    const lead = await leadComConsultor("+5588900007005");
    await registrarMensagemCliente(lead.id, "Oi");
    await devolverAoBot(lead.id, { nome: "Consultor A" });
    const atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atual.esperandoDesde).toBeNull();
    expect(atual.naoLidas).toBe(0);
  });

  it("quando o bot passa o lead, a espera começa e a mensagem conta como não lida", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900007006");
    await registrarMensagemCliente(lead.id, "Quero falar com alguém");
    const resultado = await executarFerramenta(lead.id, "passar_para_consultor", { motivo: "pedido do cliente" });
    expect(resultado.erro).toBeFalsy();
    const atual = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(atual.aguardandoHumano).toBe(true);
    expect(atual.esperandoDesde).not.toBeNull();
    expect(atual.naoLidas).toBe(1);
  });

  it("o kanban põe quem espera primeiro e o lead que escreve de novo sobe (item 11)", async () => {
    const [a] = await criarConsultores();
    const criar = async (tel: string, esperaMin: number | null) => {
      const lead = await obterOuCriarLead(tel, tel);
      await registrarMensagemCliente(lead.id, "Oi");
      if (esperaMin !== null) {
        await db.lead.update({
          where: { id: lead.id },
          data: { consultorId: a.id, modoAtendimento: "humano", aguardandoHumano: true, esperandoDesde: new Date(Date.now() - esperaMin * MIN) },
        });
      }
      await avancarRelogio(MIN);
      return lead.id;
    };
    const semEspera1 = await criar("+5588900007011", null);
    const espera10 = await criar("+5588900007012", 10);
    const semEspera2 = await criar("+5588900007013", null);
    const espera50 = await criar("+5588900007014", 50);

    expect((await cardsDoKanban()).map((c) => c.id)).toEqual([espera50, espera10, semEspera2, semEspera1]);

    // O lead mais antigo escreve de novo: passa para a frente de quem não espera.
    await registrarMensagemCliente(semEspera1, "Voltei");
    expect((await cardsDoKanban()).map((c) => c.id)).toEqual([espera50, espera10, semEspera1, semEspera2]);
  });

  it("guarda os prazos; sem valor ou com valor inválido, vale o padrão", async () => {
    expect(await prazosDeEspera()).toEqual(PRAZOS_ESPERA_PADRAO);
    await definirPrazosDeEspera({ amarelo: 5, vermelho: 20 });
    expect(await prazosDeEspera()).toEqual({ amarelo: 5, vermelho: 20 });
    await expect(definirPrazosDeEspera({ amarelo: 20, vermelho: 5 })).rejects.toThrow(/menor/);
    expect(await prazosDeEspera()).toEqual({ amarelo: 5, vermelho: 20 });
  });

  it("a lista de aguardando: o consultor vê só os dele, o admin vê todos, e a ficha traz as não lidas", async () => {
    const [a, b] = await criarConsultores();
    const criar = async (tel: string, dono: string | null) => {
      const lead = await obterOuCriarLead(tel, tel);
      await db.lead.update({ where: { id: lead.id }, data: { consultorId: dono, modoAtendimento: "humano" } });
      await registrarMensagemCliente(lead.id, "Oi");
      await avancarRelogio(MIN);
      return lead.id;
    };
    const deA = await criar("+5588900007021", a.id);
    const deB = await criar("+5588900007022", b.id);
    const semDono = await criar("+5588900007023", null);
    const respondido = await criar("+5588900007024", a.id);
    await enviarMensagemLoja({ leadId: respondido, autor: "consultor", autorNome: a.nome, texto: "Oi!" });

    expect((await leadsAguardando({ id: a.id, perfil: "consultor" })).map((l) => l.id)).toEqual([deA]);
    expect((await leadsAguardando({ id: b.id, perfil: "consultor" })).map((l) => l.id)).toEqual([deB]);
    expect((await leadsAguardando({ id: "admin", perfil: "admin" })).map((l) => l.id)).toEqual([deA, deB, semDono]);

    expect((await fichaDoLead(deA))?.naoLidas).toBe(1);
    await marcarConversaVista(deA);
    expect((await fichaDoLead(deA))?.naoLidas).toBe(0);
    // Abrir a conversa não tira o lead da lista: ele continua esperando até o consultor responder.
    expect((await leadsAguardando({ id: a.id, perfil: "consultor" })).map((l) => l.id)).toEqual([deA]);
  });
});
