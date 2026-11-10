import { describe, expect, it } from "vitest";
import { PRAZOS_ESPERA_PADRAO } from "@/regras/espera";
import { diasAte, itensDoProximoPasso, quandoRelativo, type LeadDoPasso } from "@/regras/proximo-passo";
import { HORA, dataLocal } from "@/regras/tempo";

// Terça 10/11/2026, 09h (Fortaleza).
const AGORA = dataLocal(2026, 11, 10, 9);
const iso = (dia: number, hora: number, minuto = 0) => dataLocal(2026, 11, dia, hora, minuto).toISOString();
const base: LeadDoPasso = { etapa: "qualificacao", esperandoDesde: null, ultimaMsgClienteEm: null, proximoContatoEm: null, lembreteNota: null, visitas: [] };
const visita = (tipo: string, dia: number, hora: number, status = "agendada") => ({ id: `${tipo}-${dia}`, tipo, status, inicio: iso(dia, hora), consultor: "Rafael Lima" });
const itens = (lead: Partial<LeadDoPasso>) => itensDoProximoPasso({ ...base, ...lead }, AGORA, PRAZOS_ESPERA_PADRAO);

describe("próximo passo do lead", () => {
  it("sem espera, compromisso nem lembrete: nada a mostrar", () => {
    expect(itens({})).toEqual([]);
  });

  it("datas relativas: hoje, amanhã, ontem e a data por extenso", () => {
    expect(quandoRelativo(dataLocal(2026, 11, 10, 16), AGORA)).toBe("hoje, 16h");
    expect(quandoRelativo(dataLocal(2026, 11, 11, 9, 30), AGORA)).toBe("amanhã, 9h30");
    expect(quandoRelativo(dataLocal(2026, 11, 9, 15), AGORA)).toBe("ontem, 15h");
    expect(quandoRelativo(dataLocal(2026, 11, 13, 10), AGORA)).toBe("sex 13/11 10h");
    expect(diasAte(dataLocal(2026, 11, 12, 0, 5), AGORA)).toBe(2);
  });

  it("compromisso futuro é neutro; hoje é amarelo", () => {
    const [medicao] = itens({ visitas: [visita("medicao", 12, 9)] });
    expect(medicao).toMatchObject({ tipo: "compromisso", urgencia: "neutro", titulo: "Medição qui 12/11 9h", detalhe: "em 2 dias · com Rafael Lima", tipoCompromisso: "medicao", visitaId: "medicao-12" });
    const [hoje] = itens({ visitas: [visita("visita", 10, 16)] });
    expect(hoje).toMatchObject({ urgencia: "amarelo", titulo: "Visita à loja hoje, 16h", curto: "Visita à loja hoje 16h" });
  });

  it("compromisso cancelado não aparece", () => {
    expect(itens({ visitas: [visita("medicao", 12, 9, "cancelada")] })).toEqual([]);
  });

  it("lembrete: futuro neutro, hoje amarelo, atrasado vermelho; em Negociação chama 'Próximo contato'", () => {
    expect(itens({ proximoContatoEm: iso(13, 10), lembreteNota: "Confirmar presença" })[0]).toMatchObject({ tipo: "lembrete", urgencia: "neutro", titulo: "Lembrete sex 13/11 10h", detalhe: "em 3 dias · Confirmar presença" });
    expect(itens({ proximoContatoEm: iso(10, 19, 1) })[0]).toMatchObject({ urgencia: "amarelo", titulo: "Lembrete hoje, 19h01" });
    expect(itens({ proximoContatoEm: iso(9, 15), lembreteNota: "Mandar fotos" })[0]).toMatchObject({ urgencia: "vermelho", titulo: "Lembrete atrasado · era ontem, 15h", detalhe: "Mandar fotos" });
    expect(itens({ etapa: "negociacao", proximoContatoEm: iso(11, 10) })[0].titulo).toBe("Próximo contato amanhã, 10h");
  });

  it("lead fechado ou perdido não mostra lembrete nem janela", () => {
    expect(itens({ etapa: "fechado", proximoContatoEm: iso(9, 15), ultimaMsgClienteEm: new Date(AGORA.getTime() - 23 * HORA).toISOString() })).toEqual([]);
  });

  it("cliente esperando: a cor segue os prazos de espera", () => {
    const esperando = (minutos: number) => itens({ esperandoDesde: new Date(AGORA.getTime() - minutos * 60_000).toISOString() })[0];
    expect(esperando(3)).toMatchObject({ tipo: "espera", urgencia: "neutro", curto: "Esperando há 3 min" });
    expect(esperando(15).urgencia).toBe("amarelo");
    expect(esperando(42)).toMatchObject({ urgencia: "vermelho", titulo: "Esperando resposta há 42 min" });
  });

  it("janela de 24h só aparece perto de fechar", () => {
    const janela = (horasAtras: number) => itens({ ultimaMsgClienteEm: new Date(AGORA.getTime() - horasAtras * HORA).toISOString() });
    expect(janela(2)).toEqual([]);
    expect(janela(19)[0]).toMatchObject({ tipo: "janela", urgencia: "amarelo" });
    expect(janela(23)[0]).toMatchObject({ urgencia: "vermelho", titulo: "Janela de 24h fecha em 1 h" });
    expect(janela(30)).toEqual([]);
  });

  it("data vencida vira decisão pendente e toma o lugar do compromisso (ou do retorno da Negociação)", () => {
    const apresentacao = itens({ etapa: "apresentacao", visitas: [visita("apresentacao", 6, 10)] });
    expect(apresentacao).toHaveLength(1);
    expect(apresentacao[0]).toMatchObject({ tipo: "decisao", urgencia: "vermelho", decisao: { tipo: "apresentacao", venceuEm: iso(6, 10) } });
    const negociacao = itens({ etapa: "negociacao", proximoContatoEm: iso(6, 19) });
    expect(negociacao.map((i) => i.tipo)).toEqual(["decisao"]);
  });

  it("ordem: vermelho, amarelo e neutro; dentro da mesma cor, a data mais próxima primeiro", () => {
    const lista = itens({
      proximoContatoEm: iso(9, 15),
      visitas: [visita("apresentacao", 16, 15), visita("visita", 10, 16), visita("medicao", 11, 9)],
    });
    expect(lista.map((i) => i.titulo)).toEqual(["Lembrete atrasado · era ontem, 15h", "Visita à loja hoje, 16h", "Medição amanhã, 9h", "Apresentação seg 16/11 15h"]);
  });
});
