import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { agora, avancarRelogio } from "@/lib/relogio";
import { decisaoPendente } from "@/regras/decisao";
import { DIA, HORA, dataLocal } from "@/regras/tempo";
import { avisarDecisoesVencidas } from "@/servicos/alertas";
import { agendarVisita, horariosLivresParaLead } from "@/servicos/agenda";
import { cardsDoKanban, retornosDeHoje } from "@/servicos/consultas";
import { moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { criarConsultores, limparBanco } from "./ajuda";

beforeEach(async () => {
  await limparBanco();
});

describe("decisão pendente (regra)", () => {
  const agoraTeste = dataLocal(2026, 11, 5, 9); // quinta 09h
  it("vence no dia seguinte ao compromisso, não na hora", () => {
    const ontem = dataLocal(2026, 11, 4, 17);
    const hojeCedo = dataLocal(2026, 11, 5, 8);
    expect(decisaoPendente({ etapa: "apresentacao" }, [{ tipo: "apresentacao", inicio: ontem }], agoraTeste)).toMatchObject({ tipo: "apresentacao" });
    expect(decisaoPendente({ etapa: "apresentacao" }, [{ tipo: "apresentacao", inicio: hojeCedo }], agoraTeste)).toBeNull();
    expect(decisaoPendente({ etapa: "medicao" }, [{ tipo: "medicao", inicio: ontem }], agoraTeste)).toMatchObject({ tipo: "medicao" });
  });
  it("só o compromisso da coluna conta; sem compromisso não há decisão (vale o Sem data)", () => {
    const ontem = dataLocal(2026, 11, 4, 10);
    expect(decisaoPendente({ etapa: "apresentacao" }, [{ tipo: "visita", inicio: ontem }], agoraTeste)).toBeNull();
    expect(decisaoPendente({ etapa: "apresentacao" }, [], agoraTeste)).toBeNull();
    expect(decisaoPendente({ etapa: "qualificacao" }, [{ tipo: "medicao", inicio: ontem }], agoraTeste)).toBeNull();
  });
  it("Negociação: retorno de um dia anterior vence; o de hoje ainda não", () => {
    expect(decisaoPendente({ etapa: "negociacao", proximoContatoEm: dataLocal(2026, 11, 4, 15) }, [], agoraTeste)).toMatchObject({ tipo: "negociacao" });
    expect(decisaoPendente({ etapa: "negociacao", proximoContatoEm: dataLocal(2026, 11, 5, 8) }, [], agoraTeste)).toBeNull();
    expect(decisaoPendente({ etapa: "negociacao", proximoContatoEm: null }, [], agoraTeste)).toBeNull();
  });
});

describe("decisão pendente (fluxo)", () => {
  async function apresentacaoVencida() {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900008001");
    const [ap] = await horariosLivresParaLead(lead.id, 1, undefined, "apresentacao");
    await agendarVisita({ leadId: lead.id, inicio: ap.inicio, autor: "teste", tipo: "apresentacao" });
    // Vai para o dia seguinte à apresentação, 8h.
    const alvo = new Date(ap.inicio.getTime() + DIA);
    await avancarRelogio(alvo.getTime() - (await agora()).getTime());
    return lead;
  }
  const card = async (id: string) => (await cardsDoKanban()).find((c) => c.id === id)!;

  it("card, lista de retornos e aviso (dono e admin), um aviso por dia até decidir", async () => {
    const lead = await apresentacaoVencida();
    expect((await card(lead.id)).decisao).toMatchObject({ tipo: "apresentacao" });
    const consultorId = (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).consultorId!;
    const lista = await retornosDeHoje({ id: consultorId, perfil: "consultor" });
    expect(lista.find((l) => l.id === lead.id)).toMatchObject({ situacao: "atrasado", decisao: expect.stringContaining("Apresentação passou") });

    expect(await avisarDecisoesVencidas()).toBe(1);
    expect(await avisarDecisoesVencidas()).toBe(0);
    const aviso = await db.alerta.findFirstOrThrow({ where: { tipo: "decisao_vencida", leadId: lead.id } });
    expect(aviso.consultorId).toBe(consultorId);
    await avancarRelogio(DIA);
    expect(await avisarDecisoesVencidas()).toBe(1);

    // Fechou na apresentação: vai direto para Fechado e a cobrança some.
    await moverEtapa(lead.id, "fechado", "teste", { dados: { valorFechado: 4200000 } });
    expect((await card(lead.id)).decisao).toBeNull();
    await avancarRelogio(DIA);
    expect(await avisarDecisoesVencidas()).toBe(0);
  });

  it("cliente não veio: remarcar conta como falta no Painel e tira a cobrança", async () => {
    const lead = await apresentacaoVencida();
    const [nova] = await horariosLivresParaLead(lead.id, 1, undefined, "apresentacao");
    await agendarVisita({ leadId: lead.id, inicio: nova.inicio, autor: "teste", tipo: "apresentacao" });
    expect(await db.eventoMetrica.count({ where: { tipo: "nao_compareceu" } })).toBe(1);
    expect((await card(lead.id)).decisao).toBeNull();
    expect(await avisarDecisoesVencidas()).toBe(0);
  });

  it("remarcar antes da data não conta como falta", async () => {
    await criarConsultores();
    const lead = await obterOuCriarLead("+5588900008002");
    const [a, b] = await horariosLivresParaLead(lead.id, 2, undefined, "medicao");
    await agendarVisita({ leadId: lead.id, inicio: a.inicio, autor: "teste", tipo: "medicao" });
    await agendarVisita({ leadId: lead.id, inicio: b.inicio, autor: "teste", tipo: "medicao" });
    expect(await db.eventoMetrica.count({ where: { tipo: "nao_compareceu" } })).toBe(0);
    // Na hora da medição ainda não cobra.
    await avancarRelogio(b.inicio.getTime() + HORA - (await agora()).getTime());
    expect((await card(lead.id)).decisao).toBeNull();
  });
});
