import { describe, expect, it } from "vitest";
import { acoesDoCard, outrasPendencias, separarColuna, type ContextoDaAcao, type LeadParaAcao } from "@/regras/acao-card";
import { formatarReaisCurto, resumirReais } from "@/regras/vendas";

// Meio-dia em Fortaleza (15h UTC) de uma terça.
const agora = new Date("2026-11-10T15:00:00Z");
const ha = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
const daqui = (min: number) => new Date(agora.getTime() + min * 60_000).toISOString();
const ctx: ContextoDaAcao = { agora, prazos: { amarelo: 10, vermelho: 30 }, retornoObrigatorio: (etapa) => etapa === "negociacao" };

const lead = (mudancas: Partial<LeadParaAcao> = {}): LeadParaAcao => ({
  etapa: "qualificacao",
  modo: "humano",
  consultor: { id: "c1", nome: "Rafael Lima" },
  esperandoDesde: null,
  ultimaMsgClienteEm: ha(60),
  erroBot: null,
  decisao: null,
  semData: false,
  proximoContatoEm: null,
  lembreteNota: null,
  visita: null,
  visitaEm: null,
  ...mudancas,
});
const faixa = (mudancas: Partial<LeadParaAcao>) => acoesDoCard(lead(mudancas), ctx)[0];

describe("faixa de ação do card (tarefa 39)", () => {
  it("cliente esperando: cinza dentro do prazo, âmbar perto dele, vermelho depois", () => {
    expect(faixa({ esperandoDesde: ha(4) })).toMatchObject({ codigo: "responder", cor: "cinza", texto: "Responder · há 4 min", precisaDeVoce: true });
    expect(faixa({ esperandoDesde: ha(15) })).toMatchObject({ codigo: "responder_atencao", cor: "ambar", texto: "Responder · há 15 min" });
    expect(faixa({ esperandoDesde: ha(67) })).toMatchObject({ codigo: "responder_atrasado", cor: "vermelho", texto: "Responder · há 1 h 07 min" });
  });

  it("com a janela de 24h fechada a faixa já avisa que só vai modelo", () => {
    expect(faixa({ esperandoDesde: ha(2880), ultimaMsgClienteEm: ha(2880) }).texto).toBe("Responder com modelo · há 2 d");
    expect(faixa({ esperandoDesde: ha(2880), ultimaMsgClienteEm: null }).texto).toBe("Responder com modelo · há 2 d");
  });

  it("vermelho é só cliente sem resposta ou IA travada; data vencida é âmbar", () => {
    expect(faixa({ modo: "bot", consultor: null, erroBot: "erro na API" })).toMatchObject({ codigo: "ia_travou", cor: "vermelho", dica: "erro na API" });
    expect(faixa({ etapa: "medicao", decisao: { tipo: "medicao", venceuEm: ha(3000) }, visita: "Medição sex 06/11 8h" })).toMatchObject({ codigo: "decidir", cor: "ambar", texto: "Decidir: a medição aconteceu?" });
    expect(faixa({ etapa: "apresentacao", decisao: { tipo: "apresentacao", venceuEm: ha(3000) } }).texto).toBe("Decidir: o cliente veio?");
    expect(faixa({ etapa: "apresentacao", semData: true })).toMatchObject({ codigo: "marcar_data", cor: "ambar", texto: "Marcar data na agenda" });
    expect(faixa({ proximoContatoEm: "2026-11-06T17:00:00Z" })).toMatchObject({ codigo: "retorno_atrasado", cor: "ambar", texto: "Retorno atrasado desde 06/11" });
    expect(faixa({ consultor: null, modo: "pausado" })).toMatchObject({ codigo: "na_fila", cor: "ambar", texto: "Na fila · sem consultor" });
  });

  it("retorno vencido na Negociação vira só a decisão, sem repetir o retorno atrasado", () => {
    const acoes = acoesDoCard(lead({ etapa: "negociacao", proximoContatoEm: "2026-11-06T17:00:00Z", decisao: { tipo: "negociacao", venceuEm: "2026-11-06T17:00:00Z" } }), ctx);
    expect(acoes.map((a) => a.codigo)).toEqual(["decidir"]);
    expect(acoes[0].texto).toBe("Decidir: fechou?");
  });

  it("mostra a mais grave e conta as outras pendências do vendedor", () => {
    const acoes = acoesDoCard(lead({ etapa: "negociacao", esperandoDesde: ha(67), proximoContatoEm: "2026-11-06T17:00:00Z", decisao: { tipo: "negociacao", venceuEm: "2026-11-06T17:00:00Z" } }), ctx);
    expect(acoes.map((a) => a.codigo)).toEqual(["responder_atrasado", "decidir"]);
    expect(outrasPendencias(acoes)).toBe(1);
    // Compromisso marcado não é pendência do vendedor: não entra no "+1".
    expect(outrasPendencias(acoesDoCard(lead({ esperandoDesde: ha(40), visita: "Medição qui 12/11 8h", visitaEm: daqui(2800) }), ctx))).toBe(0);
  });

  it("hoje é azul, combinado é verde, o resto é cinza", () => {
    expect(faixa({ proximoContatoEm: daqui(180), lembreteNota: "ligar depois do almoço" })).toMatchObject({ codigo: "retorno_hoje", cor: "azul", precisaDeVoce: true, dica: "ligar depois do almoço" });
    expect(faixa({ etapa: "medicao", visita: "Medição qui 12/11 8h", visitaEm: daqui(2800) })).toMatchObject({ codigo: "compromisso", cor: "verde", texto: "Medição qui 12/11 8h", precisaDeVoce: false });
    expect(faixa({ etapa: "apresentacao", visita: "Apresentação ter 10/11 16h", visitaEm: daqui(240) })).toMatchObject({ codigo: "compromisso", cor: "azul" });
    expect(faixa({ proximoContatoEm: daqui(4000) })).toMatchObject({ codigo: "retorno_futuro", cor: "cinza", precisaDeVoce: false });
    expect(faixa({ modo: "bot", consultor: null })).toMatchObject({ codigo: "ia_atendendo", cor: "cinza", texto: "IA atendendo" });
    expect(faixa({})).toMatchObject({ codigo: "aguardando_cliente", cor: "cinza", texto: "Aguardando o cliente" });
  });

  it("sem retorno só cobra onde a data é obrigatória", () => {
    expect(faixa({ etapa: "negociacao" })).toMatchObject({ codigo: "definir_retorno", cor: "ambar" });
    expect(faixa({ etapa: "qualificacao" }).codigo).toBe("aguardando_cliente");
  });

  it("Fechado e Perdido não têm faixa, nem fila, nem compromisso", () => {
    expect(acoesDoCard(lead({ etapa: "fechado", consultor: null, modo: "pausado", visita: "Visita qui 12/11 8h" }), ctx)).toEqual([]);
    expect(acoesDoCard(lead({ etapa: "perdido", proximoContatoEm: "2026-11-01T12:00:00Z" }), ctx)).toEqual([]);
  });
});

describe("ordem da coluna (tarefa 39)", () => {
  it("em cima o que precisa do vendedor, do mais grave ao menos grave; embaixo o resto na ordem em que veio", () => {
    const cards = [
      { id: "combinado", l: lead({ etapa: "medicao", visita: "Medição qui 12/11 8h", visitaEm: daqui(2800) }) },
      { id: "retorno-hoje", l: lead({ proximoContatoEm: daqui(180) }) },
      { id: "espera-curta", l: lead({ esperandoDesde: ha(40) }) },
      { id: "aguardando", l: lead() },
      { id: "decidir", l: lead({ etapa: "medicao", decisao: { tipo: "medicao", venceuEm: ha(3000) } }) },
      { id: "espera-longa", l: lead({ esperandoDesde: ha(300) }) },
    ];
    const grupos = separarColuna(cards, (c) => acoesDoCard(c.l, ctx));
    expect(grupos.precisaDeVoce.map((c) => c.id)).toEqual(["espera-curta", "espera-longa", "decidir", "retorno-hoje"]);
    expect(grupos.aguardando.map((c) => c.id)).toEqual(["combinado", "aguardando"]);
  });
});

describe("valores curtos do kanban", () => {
  it("card sem centavos zerados e soma resumida no cabeçalho", () => {
    expect(formatarReaisCurto(1621000)).toBe("R$ 16.210");
    expect(formatarReaisCurto(162150)).toBe("R$ 1.621,50");
    expect(resumirReais(5121000)).toBe("R$ 51,2 mil");
    expect(resumirReais(4200000)).toBe("R$ 42 mil");
    expect(resumirReais(120000000)).toBe("R$ 1,2 mi");
    expect(resumirReais(85000)).toBe("R$ 850");
  });
});
