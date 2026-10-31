import { describe, expect, it } from "vitest";
import { horariosLivres, horarioDentroDaRegra, janelaDeAgendamento } from "@/regras/agenda";
import { janelaAberta } from "@/regras/janela24h";
import { deveExcluirArquivado } from "@/regras/limpeza";
import { escolherConsultor } from "@/regras/distribuicao";
import { LAYOUT_PADRAO_FICHA, layoutValido } from "@/regras/layout-ficha";
import { pode, podeEditarAgendaDe } from "@/regras/permissoes";
import { avaliarRetomada } from "@/regras/retomada";
import { gerarResumo } from "@/servicos/resumo";
import { limparResposta, respostaDescartada } from "@/bot/saida";
import { normalizarTelefone } from "@/regras/telefone";
import { DIA, HORA, dataLocal, partesLocais } from "@/regras/tempo";

const base = dataLocal(2026, 11, 3, 10); // terça-feira, 10h em Fortaleza

describe("janela de 24h (MSG-02)", () => {
  it("abre com mensagem do cliente e fecha depois de 24h", () => {
    expect(janelaAberta(base, new Date(base.getTime() + 23 * HORA))).toBe(true);
    expect(janelaAberta(base, new Date(base.getTime() + 24 * HORA))).toBe(false);
  });
  it("número que nunca falou com a loja: janela fechada", () => {
    expect(janelaAberta(null, base)).toBe(false);
  });
});

describe("retomada (RET-01/03)", () => {
  const lead = {
    etapa: "novo", modoAtendimento: "bot", aguardandoHumano: false, temVisitaFutura: false,
    arquivadoEm: null, ultimaMsgClienteEm: base, ultimaMsgLojaEm: new Date(base.getTime() + 60_000), retomadaEnviadaEm: null,
  };
  it("só envia depois de 3 dias sem resposta", () => {
    expect(avaliarRetomada(lead, new Date(base.getTime() + 2.9 * DIA))).toBeNull();
    expect(avaliarRetomada(lead, new Date(base.getTime() + 3.1 * DIA))).toBe("enviar_retomada");
  });
  it("nunca envia uma segunda retomada; 4 dias depois vai para Sem resposta", () => {
    const enviada = { ...lead, retomadaEnviadaEm: new Date(base.getTime() + 3 * DIA), ultimaMsgLojaEm: new Date(base.getTime() + 3 * DIA) };
    expect(avaliarRetomada(enviada, new Date(base.getTime() + 6 * DIA))).toBeNull();
    expect(avaliarRetomada(enviada, new Date(base.getTime() + 7.1 * DIA))).toBe("mover_sem_resposta");
    expect(avaliarRetomada(enviada, new Date(base.getTime() + 30 * DIA))).toBe("mover_sem_resposta");
  });
  it("cliente respondeu depois da retomada: nada a fazer", () => {
    const respondeu = { ...lead, retomadaEnviadaEm: new Date(base.getTime() + 3 * DIA), ultimaMsgClienteEm: new Date(base.getTime() + 4 * DIA) };
    expect(avaliarRetomada(respondeu, new Date(base.getTime() + 9 * DIA))).toBeNull();
  });
  it("não age em leads arquivados, fora do Novo, com o consultor ou com visita marcada", () => {
    const depois = new Date(base.getTime() + 5 * DIA);
    expect(avaliarRetomada({ ...lead, etapa: "fechado" }, depois)).toBeNull();
    expect(avaliarRetomada({ ...lead, etapa: "pronto" }, depois)).toBeNull();
    expect(avaliarRetomada({ ...lead, etapa: "visita" }, depois)).toBeNull();
    expect(avaliarRetomada({ ...lead, arquivadoEm: base }, depois)).toBeNull();
    expect(avaliarRetomada({ ...lead, modoAtendimento: "pausado" }, depois)).toBeNull();
    expect(avaliarRetomada({ ...lead, modoAtendimento: "humano" }, depois)).toBeNull();
    expect(avaliarRetomada({ ...lead, aguardandoHumano: true }, depois)).toBeNull();
    expect(avaliarRetomada({ ...lead, temVisitaFutura: true }, depois)).toBeNull();
  });
});

describe("exclusão de arquivados (LIMP-04)", () => {
  it("exclui só com 30 dias de arquivo", () => {
    expect(deveExcluirArquivado(base, new Date(base.getTime() + 29 * DIA))).toBe(false);
    expect(deveExcluirArquivado(base, new Date(base.getTime() + 30 * DIA))).toBe(true);
    expect(deveExcluirArquivado(null, base)).toBe(false);
  });
});

describe("permissões (LIMP-05, USR-02)", () => {
  it("só o administrador exclui", () => {
    expect(pode("admin", "excluir_lead")).toBe(true);
    expect(pode("consultor", "excluir_lead")).toBe(false);
    expect(pode("consultor", "arquivar_lead")).toBe(true);
    expect(pode("desconhecido", "arquivar_lead")).toBe(false);
  });
});

describe("agenda (AGENDA-02)", () => {
  it("respeita horário da loja", () => {
    expect(horarioDentroDaRegra(dataLocal(2026, 11, 3, 8))).toBe(true);
    expect(horarioDentroDaRegra(dataLocal(2026, 11, 3, 18))).toBe(false); // termina 19h
    expect(horarioDentroDaRegra(dataLocal(2026, 11, 7, 11))).toBe(true); // sábado 11h
    expect(horarioDentroDaRegra(dataLocal(2026, 11, 7, 12))).toBe(false);
    expect(horarioDentroDaRegra(dataLocal(2026, 11, 8, 10))).toBe(false); // domingo
  });
  it("começa no próximo dia útil e vai até 14 dias", () => {
    const { de, ate } = janelaDeAgendamento(dataLocal(2026, 11, 7, 9)); // sábado
    expect(partesLocais(de).diaSemana).toBe(1); // segunda
    expect(ate.getTime() - dataLocal(2026, 11, 7).getTime()).toBe(15 * DIA);
  });
  it("uma visita por horário na loja; bloqueio tira só o consultor bloqueado", () => {
    const inicio = dataLocal(2026, 11, 4, 8);
    const ocupados = [
      { consultorId: "a", inicio, fim: new Date(inicio.getTime() + HORA), tipo: "visita" as const },
      { consultorId: "b", inicio: new Date(inicio.getTime() + HORA), fim: new Date(inicio.getTime() + 3 * HORA), tipo: "bloqueio" as const },
    ];
    const livres = horariosLivres({ agora: base, consultores: ["a", "b"], ocupados, limite: 3 });
    // 8h tem visita (com qualquer consultor, a loja está ocupada); 9h e 10h: b bloqueado, a livre.
    expect(livres.map((v) => [partesLocais(v.inicio).hora, v.consultorId])).toEqual([[9, "a"], [10, "a"], [11, "a"]]);
  });
});

describe("telefone (MSG-01)", () => {
  it("normaliza e valida", () => {
    expect(normalizarTelefone("(88) 99999-1234")).toBe("+5588999991234");
    expect(normalizarTelefone("+55 88 99999-1234")).toBe("+5588999991234");
    expect(normalizarTelefone("123")).toBeNull();
    expect(normalizarTelefone("+55 88 89999-1234")).toBeNull();
  });
});

describe("resumo (FICHA-02)", () => {
  it("segue o formato combinado", () => {
    const texto = gerarResumo({
      nome: "Ana Souza", nomePerfil: null, cidade: "Crato", situacaoImovel: "apartamento na planta", prazo: "entrega em mar/27",
      ambientes: ["cozinha", "2 quartos"], exigencias: ["cores claras"], pedidosTecnicos: ["quero aproveitar a bancada de granito"],
      investimento: "R$ 40–60 mil", classificacao: "qualificado",
      medidas: [{ ambiente: "cozinha", descricao: "3,20 × 2,10", fonte: "planta", confirmada: true }],
      visita: { inicio: dataLocal(2026, 11, 7, 10), consultorNome: "Consultor 1" },
    });
    expect(texto.split("\n")).toEqual([
      "Ana Souza – Crato – apartamento na planta, entrega em mar/27",
      "Ambientes: cozinha, 2 quartos",
      "Medidas: cozinha 3,20 × 2,10 (planta enviada, confirmada); 2 quartos sem medida",
      "Exigências: cores claras",
      'Pedido técnico: "quero aproveitar a bancada de granito"',
      "Investimento: informou R$ 40–60 mil",
      "Visita: sáb 07/11 10h com Consultor 1",
      "Classificação: qualificado",
    ]);
  });
});

describe("texto do bot antes de enviar", () => {
  it("tira anotação interna e [SEM RESPOSTA], mantém endereço e horário", () => {
    expect(limparResposta("Segunda insistência: oferecer o caminho.\n\nO consultor consegue te passar uma estimativa. Posso pedir para ele falar com você?")).toBe(
      "O consultor consegue te passar uma estimativa. Posso pedir para ele falar com você?",
    );
    expect(limparResposta("[SEM RESPOSTA]")).toBe("");
    const endereco = "Endereço: Av. Ailton Gomes, 3515\nHorário: segunda a sexta, das 8h às 18h";
    expect(limparResposta(endereco)).toBe(endereco);
    expect(limparResposta("Instrução 07: não repetir.\nCerto!")).toBe("Certo!");
  });
});

describe("resposta descartada pelo filtro", () => {
  it("só conta quando havia texto e o filtro apagou tudo", () => {
    expect(respostaDescartada("Segunda insistência: x", "")).toBe(true);
    expect(respostaDescartada("[SEM RESPOSTA]", "")).toBe(false);
    expect(respostaDescartada("Certo!", "Certo!")).toBe(false);
  });
});

describe("permissões da fase 2 (consultor x admin)", () => {
  it("só o admin exclui lead e remove medida; o consultor edita notas e arquiva", () => {
    expect(pode("consultor", "excluir_lead")).toBe(false);
    expect(pode("consultor", "remover_medida")).toBe(false);
    expect(pode("consultor", "editar_lead")).toBe(true);
    expect(pode("admin", "excluir_lead")).toBe(true);
    expect(pode("admin", "remover_medida")).toBe(true);
    expect(pode("admin", "configurar")).toBe(true);
    expect(pode("consultor", "configurar")).toBe(false);
  });
  it("agenda: consultor altera só a própria; admin altera todas", () => {
    const rafael = { id: "r", perfil: "consultor" };
    expect(podeEditarAgendaDe(rafael, "r")).toBe(true);
    expect(podeEditarAgendaDe(rafael, "b")).toBe(false);
    expect(podeEditarAgendaDe({ id: "m", perfil: "admin" }, "b")).toBe(true);
  });
});

describe("layout da ficha", () => {
  it("o layout padrão é válido", () => {
    expect(layoutValido(LAYOUT_PADRAO_FICHA)).toBe(true);
  });
  it("recusa bloco repetido, faltando, fora da grade ou lixo", () => {
    expect(layoutValido(LAYOUT_PADRAO_FICHA.slice(1))).toBe(false);
    expect(layoutValido([...LAYOUT_PADRAO_FICHA.slice(1), LAYOUT_PADRAO_FICHA[1]])).toBe(false);
    expect(layoutValido(LAYOUT_PADRAO_FICHA.map((l, n) => (n === 0 ? { ...l, x: 8 } : l)))).toBe(false);
    expect(layoutValido("qualquer coisa")).toBe(false);
    expect(layoutValido(null)).toBe(false);
  });
});

describe("escolha do consultor (rodízio e menos leads)", () => {
  const equipe = (online: boolean[], leads = [0, 0, 0]) => online.map((o, n) => ({ id: `c${n + 1}`, online: o, leadsEmAndamento: leads[n] }));
  it("rodízio segue a ordem e volta ao início", () => {
    expect(escolherConsultor("rodizio", equipe([true, true]), null)).toBe("c1");
    expect(escolherConsultor("rodizio", equipe([true, true]), "c1")).toBe("c2");
    expect(escolherConsultor("rodizio", equipe([true, true]), "c2")).toBe("c1");
  });
  it("rodízio pula quem está offline e devolve null se ninguém está online", () => {
    expect(escolherConsultor("rodizio", equipe([true, false, true]), "c1")).toBe("c3");
    expect(escolherConsultor("rodizio", equipe([false, false]), "c1")).toBeNull();
  });
  it("menos leads escolhe só entre os online", () => {
    expect(escolherConsultor("menos_leads", equipe([true, false, true], [5, 0, 2]), null)).toBe("c3");
  });
});
