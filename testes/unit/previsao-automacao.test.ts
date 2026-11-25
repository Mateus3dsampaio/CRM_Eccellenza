import { describe, expect, it } from "vitest";
import { avaliarRecuperacao, REGRAS_RECUPERACAO_PADRAO, type RegrasRecuperacao } from "@/regras/recuperacao";
import { avaliarRede, type RegrasRedeDeSeguranca } from "@/regras/rede-seguranca";
import { diasParaArquivar, REGRAS_ARQUIVAR_PADRAO, type RegrasArquivarPerdido } from "@/regras/arquivar-perdido";
import {
  categoriaDaPrevisao,
  linhaDaPrevisao,
  previsaoArquivo,
  previsaoDeJson,
  previsaoDoCard,
  previsaoParaJson,
  previsaoRecuperacao,
  previsaoRede,
  type EstadoPrevisao,
  type RegrasDePrevisao,
} from "@/regras/previsao-automacao";
import { dataLocal, DIA, HORA } from "@/regras/tempo";

// Segunda 09/11/2026, terça 10/11, etc. (horário de Fortaleza).
const dia = (d: number, h: number, m = 0) => dataLocal(2026, 11, d, h, m);
const seg = (h: number, m = 0) => dia(9, h, m);
const ter = (h: number, m = 0) => dia(10, h, m);

const R: RegrasRecuperacao = { ...REGRAS_RECUPERACAO_PADRAO, ligado: true, segundaModo: "horas", segundaHoras: 4 };
const REDE: RegrasRedeDeSeguranca = { ligado: true, dias: 5 };
const ARQ: RegrasArquivarPerdido = { ...REGRAS_ARQUIVAR_PADRAO, ligado: true };
const REGRAS: RegrasDePrevisao = { recuperacao: R, rede: REDE, arquivar: ARQ };
const TUDO_DESLIGADO: RegrasDePrevisao = { recuperacao: { ...R, ligado: false }, rede: { ...REDE, ligado: false }, arquivar: { ...ARQ, ligado: false } };

const base: EstadoPrevisao = {
  etapa: "novo",
  arquivadoEm: null,
  classificacao: null,
  modoAtendimento: "bot",
  aguardandoHumano: false,
  naoReceberEm: null,
  temVisitaFutura: false,
  proximoContatoEm: null,
  ultimaMsgClienteEm: seg(9, 0),
  ultimaMsgLojaEm: seg(9, 1),
  recuperacaoPrimeiraEm: null,
  recuperacaoSegundaEm: null,
  recuperacaoFalhou: false,
  passouPorHumano: false,
  visitaEm: null,
  perdidoEm: null,
  autorDaMudanca: null,
};

describe("previsão da recuperação: casos fixos", () => {
  it("1ª mensagem: depois dos minutos combinados, no horário permitido", () => {
    const p = previsaoRecuperacao(base, R, seg(9, 10));
    expect(p).toMatchObject({ tipo: "primeira", quando: seg(9, 31) });
    // Projeção: 2ª 4 h depois da 1ª e Perdido 5 h depois da 2ª.
    expect(p.tipo === "primeira" && p.passos.map((x) => [x.tipo, x.quando.getTime()])).toEqual([["primeira", seg(9, 31).getTime()], ["segunda", seg(13, 31).getTime()], ["perdido", seg(18, 31).getTime()]]);
  });

  it("1ª mensagem marcada fora do horário permitido vai para a abertura seguinte", () => {
    const p = previsaoRecuperacao({ ...base, ultimaMsgClienteEm: seg(19, 40), ultimaMsgLojaEm: seg(19, 50) }, R, seg(19, 55));
    expect(p).toMatchObject({ tipo: "primeira", quando: ter(8, 0) });
  });

  it("1ª mensagem que só poderia sair com a janela fechada fica travada", () => {
    const p = previsaoRecuperacao({ ...base, ultimaMsgClienteEm: seg(7, 0), ultimaMsgLojaEm: seg(7, 1) }, R, ter(9, 0));
    expect(p).toMatchObject({ tipo: "travado", motivo: "primeira_fora_da_janela" });
  });

  it("2ª mensagem no modo 'dia seguinte às 10:00' e no modo 'horas'", () => {
    const comPrimeira = { ...base, ultimaMsgClienteEm: seg(14, 30), ultimaMsgLojaEm: seg(14, 40), recuperacaoPrimeiraEm: seg(15, 0) };
    expect(previsaoRecuperacao(comPrimeira, { ...R, segundaModo: "dia_seguinte", segundaHora: "10:00" }, seg(16, 0))).toMatchObject({ tipo: "segunda", quando: ter(10, 0) });
    expect(previsaoRecuperacao(comPrimeira, R, seg(16, 0))).toMatchObject({ tipo: "segunda", quando: seg(19, 0) });
  });

  it("2ª mensagem antecipada para caber na janela de 24h", () => {
    const e = { ...base, ultimaMsgClienteEm: seg(9, 50), recuperacaoPrimeiraEm: seg(10, 0) };
    const regras = { ...R, segundaModo: "dia_seguinte" as const, segundaHora: "10:00" };
    // O alvo (terça 10:00) cai depois do fim da janela (terça 09:50): sai 5 min antes do fim.
    expect(previsaoRecuperacao(e, regras, seg(11, 0))).toMatchObject({ tipo: "segunda", quando: ter(9, 45) });
  });

  it("2ª mensagem que não cabe de jeito nenhum fica travada, e a rede de segurança é o que resta", () => {
    const e = { ...base, ultimaMsgClienteEm: seg(7, 0), recuperacaoPrimeiraEm: seg(10, 0) };
    const regras = { ...R, segundaModo: "dia_seguinte" as const, segundaHora: "10:00" };
    expect(previsaoRecuperacao(e, regras, seg(11, 0))).toMatchObject({ tipo: "travado", motivo: "segunda_fora_da_janela" });
    const card = previsaoDoCard(e, { ...REGRAS, recuperacao: regras }, seg(11, 0));
    expect(card).toMatchObject({ tipo: "travado", quando: new Date(seg(7, 0).getTime() + 5 * DIA) });
    expect(linhaDaPrevisao(card, seg(11, 0))).toMatchObject({ rotulo: "Travado", horario: "Perdido sáb 14/11", icone: "alerta" });
    expect(categoriaDaPrevisao(card, seg(11, 0))).toEqual({ categoria: "travado", cor: "aviso" });
  });

  it("envio que falhou trava o ciclo", () => {
    expect(previsaoRecuperacao({ ...base, recuperacaoPrimeiraEm: seg(10, 0), recuperacaoFalhou: true }, R, seg(11, 0))).toMatchObject({ tipo: "travado", motivo: "envio_falhou" });
  });

  it("Perdido: 5 h depois da última mensagem enviada, em relógio corrido", () => {
    const e = { ...base, recuperacaoPrimeiraEm: seg(10, 0), recuperacaoSegundaEm: seg(14, 0) };
    expect(previsaoRecuperacao(e, R, seg(15, 0))).toMatchObject({ tipo: "perdido", quando: seg(19, 0) });
    // Com a 2ª desligada, conta a partir da 1ª.
    expect(previsaoRecuperacao({ ...base, recuperacaoPrimeiraEm: seg(10, 0) }, { ...R, segundaLigada: false }, seg(11, 0))).toMatchObject({ tipo: "perdido", quando: seg(15, 0) });
  });

  it("cliente que respondeu depois da mensagem cancela o ciclo; cada motivo de 'fora' é nomeado", () => {
    expect(previsaoRecuperacao({ ...base, recuperacaoPrimeiraEm: seg(10, 0), ultimaMsgClienteEm: seg(11, 0) }, R, seg(12, 0))).toEqual({ tipo: "fora", motivo: "cliente_respondeu" });
    expect(previsaoRecuperacao({ ...base, ultimaMsgLojaEm: seg(8, 0) }, R, seg(10, 0))).toEqual({ tipo: "fora", motivo: "vez_do_cliente" });
    expect(previsaoRecuperacao({ ...base, naoReceberEm: seg(9, 5) }, R, seg(10, 0))).toEqual({ tipo: "fora", motivo: "pediu_parar" });
    expect(previsaoRecuperacao({ ...base, classificacao: "pos_venda" }, R, seg(10, 0))).toEqual({ tipo: "fora", motivo: "pos_venda" });
    expect(previsaoRecuperacao({ ...base, temVisitaFutura: true }, R, seg(10, 0))).toEqual({ tipo: "fora", motivo: "visita" });
    expect(previsaoRecuperacao(base, { ...R, ligado: false }, seg(10, 0))).toEqual({ tipo: "fora", motivo: "desligada" });
  });
});

describe("previsão da rede de segurança e do arquivo: casos fixos", () => {
  it("rede: dias depois da última mensagem do cliente; pós-venda vai para o arquivo", () => {
    expect(previsaoRede(base, REDE, seg(10, 0))).toMatchObject({ tipo: "perdido", quando: new Date(seg(9, 0).getTime() + 5 * DIA), seguradoPorRetorno: false });
    expect(previsaoRede({ ...base, classificacao: "pos_venda" }, REDE, seg(10, 0))).toMatchObject({ tipo: "arquivar" });
  });

  it("retorno marcado no futuro segura a rede: vale o mais tarde entre o retorno e os dias", () => {
    const retorno = dia(20, 10, 0);
    expect(previsaoRede({ ...base, proximoContatoEm: retorno }, REDE, seg(10, 0))).toMatchObject({ tipo: "perdido", quando: retorno, seguradoPorRetorno: true });
    // Retorno que já passou não segura.
    expect(previsaoRede({ ...base, proximoContatoEm: seg(9, 30) }, REDE, seg(10, 0))).toMatchObject({ seguradoPorRetorno: false });
  });

  it("Perdido movido pelo sistema arquiva em 7 dias; por uma pessoa, em 60; desligado ou sem o ajuste, não arquiva", () => {
    const automatico = { ...base, etapa: "perdido", perdidoEm: seg(9, 0), autorDaMudanca: "sistema" };
    expect(previsaoArquivo(automatico, ARQ, seg(10, 0))).toMatchObject({ tipo: "arquivo", dias: 7, automatico: true, quando: new Date(seg(9, 0).getTime() + 7 * DIA) });
    const pessoa = { ...automatico, autorDaMudanca: "Rafael" };
    expect(previsaoArquivo(pessoa, ARQ, seg(10, 0))).toMatchObject({ tipo: "arquivo", dias: 60, automatico: false });
    expect(previsaoArquivo(pessoa, { ...ARQ, vendedorLigado: false }, seg(10, 0))).toEqual({ tipo: "nao_arquiva", motivo: "vendedor_desligado" });
    expect(previsaoArquivo(automatico, { ...ARQ, ligado: false }, seg(10, 0))).toEqual({ tipo: "nao_arquiva", motivo: "desligada" });
  });
});

describe("previsão do card: categorias, textos e casos especiais", () => {
  const cat = (e: EstadoPrevisao, agora: Date, regras = REGRAS) => {
    const card = previsaoDoCard(e, regras, agora);
    return { card, ...categoriaDaPrevisao(card, agora), linha: linhaDaPrevisao(card, agora) };
  };

  it("mensagem hoje (âmbar): 1ª e 2ª; o texto cabe e a trilha mostra onde está", () => {
    const a = cat(base, seg(9, 10));
    expect(a).toMatchObject({ categoria: "msg_hoje", cor: "aviso" });
    expect(a.linha).toMatchObject({ rotulo: "1ª mensagem", horario: "09:31", icone: "trilha", trilha: { feitos: 0, atual: 0 } });
    const b = cat({ ...base, recuperacaoPrimeiraEm: seg(9, 31) }, seg(10, 0));
    expect(b.linha).toMatchObject({ rotulo: "2ª mensagem hoje", horario: "13:31", trilha: { feitos: 1, atual: 1 } });
    const c = cat({ ...base, recuperacaoPrimeiraEm: seg(18, 0) }, seg(19, 0));
    expect(c.linha).toMatchObject({ rotulo: "2ª mensagem amanhã" });
    expect(c.categoria).toBe("depois");
  });

  it("Perdido hoje (vermelho): o próximo evento é ir para Perdido e é hoje", () => {
    const a = cat({ ...base, recuperacaoPrimeiraEm: seg(10, 0), recuperacaoSegundaEm: seg(14, 0) }, seg(15, 0));
    expect(a).toMatchObject({ categoria: "perdido_hoje", cor: "alerta" });
    expect(a.linha).toMatchObject({ rotulo: "Perdido hoje", horario: "19:00" });
  });

  it("cliente acabou de escrever: sem recuperação, mostra a data da rede em cinza", () => {
    const a = cat({ ...base, ultimaMsgClienteEm: seg(9, 0), ultimaMsgLojaEm: seg(8, 0) }, seg(10, 0));
    expect(a).toMatchObject({ categoria: "depois", cor: "neutra" });
    expect(a.linha).toMatchObject({ rotulo: "Perdido", horario: "sáb 14/11" });
  });

  it("pediu para parar: sem recuperação, mas a rede continua valendo", () => {
    const a = cat({ ...base, naoReceberEm: seg(9, 5) }, seg(10, 0));
    expect(a.card).toMatchObject({ tipo: "perdido", quando: new Date(seg(9, 0).getTime() + 5 * DIA) });
  });

  it("pós-venda: a rede manda para o ARQUIVO, não para Perdido", () => {
    const a = cat({ ...base, classificacao: "pos_venda" }, seg(10, 0));
    expect(a.card.tipo).toBe("arquivo");
    expect(a.linha.rotulo).toBe("Arquivo");
    expect(a.card.passos.at(-1)?.rotulo).toBe("Vai para o arquivo");
  });

  it("protegido (cinza): passou por consultor, com o consultor, visita marcada, retorno que segura a rede", () => {
    expect(cat({ ...base, passouPorHumano: true }, seg(10, 0)).linha).toMatchObject({ rotulo: "Passou por consultor", icone: "escudo" });
    expect(cat({ ...base, modoAtendimento: "humano" }, seg(10, 0)).linha.rotulo).toBe("Com o consultor");
    const visita = cat({ ...base, temVisitaFutura: true, visitaEm: dia(12, 8, 0) }, seg(10, 0));
    expect(visita).toMatchObject({ categoria: "protegido", cor: "neutra" });
    expect(visita.linha).toMatchObject({ rotulo: "Visita marcada", horario: "qui 12/11" });
    // Recuperação desligada e retorno marcado depois dos 5 dias: o retorno decide.
    const retorno = cat({ ...base, ultimaMsgLojaEm: seg(8, 0), proximoContatoEm: dia(20, 10, 0) }, seg(10, 0), { ...REGRAS, recuperacao: { ...R, ligado: false } });
    expect(retorno).toMatchObject({ categoria: "protegido" });
    expect(retorno.linha).toMatchObject({ rotulo: "Retorno marcado", horario: "ter 17/11".replace("ter 17/11", retorno.linha.horario) });
    expect(retorno.card.passos.at(-1)?.rotulo).toBe("Vai para Perdido");
  });

  it("tudo desligado: 'Automação desligada' e nenhum chip (categoria 'depois')", () => {
    const a = cat(base, seg(10, 0), TUDO_DESLIGADO);
    expect(a.card.tipo).toBe("desligada");
    expect(a.linha.rotulo).toBe("Automação desligada");
    expect(a.categoria).toBe("depois");
  });

  it("só uma das duas desligada: mostra só o que a outra faz", () => {
    expect(cat(base, seg(10, 0), { ...REGRAS, recuperacao: { ...R, ligado: false } }).card.tipo).toBe("perdido");
    expect(cat(base, seg(9, 10), { ...REGRAS, rede: { ...REDE, ligado: false } }).card.tipo).toBe("primeira");
  });

  it("a rede que leva antes do prazo da recuperação aparece na nota", () => {
    const rapida = { ...REGRAS, rede: { ligado: true, dias: 1 } };
    const a = cat({ ...base, recuperacaoPrimeiraEm: seg(10, 0), recuperacaoSegundaEm: seg(14, 0), ultimaMsgClienteEm: dia(8, 9, 0) }, seg(15, 0), rapida);
    expect(a.card.nota).toMatch(/rede de segurança/);
  });

  it("evento vencido (a rotina ainda não rodou): mostra 'agora', nunca uma data no passado", () => {
    const e = { ...base, recuperacaoPrimeiraEm: seg(10, 0), recuperacaoSegundaEm: seg(14, 0) };
    const card = previsaoDoCard(e, REGRAS, dia(11, 9, 0));
    expect(card.quando!.getTime()).toBeGreaterThanOrEqual(dia(11, 9, 0).getTime());
    expect(linhaDaPrevisao(card, dia(11, 9, 0)).rotulo).toBe("Perdido agora");
    expect(categoriaDaPrevisao(card, dia(11, 9, 0)).categoria).toBe("perdido_hoje");
  });

  it("coluna Perdido: arquivo breve (vermelho), depois (cinza) e 'não arquiva sozinho'", () => {
    const e = { ...base, etapa: "perdido", perdidoEm: seg(9, 0), autorDaMudanca: "sistema" };
    const amanha = cat(e, dia(15, 9, 0)); // 6 dias e 0 h depois: arquiva amanhã (segunda 16)
    expect(amanha).toMatchObject({ categoria: "arquiva_breve", cor: "alerta" });
    expect(amanha.linha).toMatchObject({ rotulo: "Arquivo amanhã", horario: "09:00" });
    const depois = cat(e, seg(10, 0));
    expect(depois).toMatchObject({ categoria: "arquiva_depois", cor: "neutra" });
    expect(depois.linha.rotulo).toMatch(/^Arquivo em \d+ dias$/);
    const nunca = cat({ ...e, autorDaMudanca: "Rafael" }, seg(10, 0), { ...REGRAS, arquivar: { ...ARQ, vendedorLigado: false } });
    expect(nunca).toMatchObject({ categoria: "nao_arquiva" });
    expect(nunca.linha.rotulo).toBe("Não arquiva sozinho");
  });

  it("o JSON da rota volta igual (datas em ISO)", () => {
    const card = previsaoDoCard(base, REGRAS, seg(9, 10));
    expect(previsaoDeJson(JSON.parse(JSON.stringify(previsaoParaJson(card))))).toEqual(card);
  });
});

// ---------------------------------------------------------------- consistência com as regras de verdade

/** Gerador pseudoaleatório com semente fixa (o teste nunca muda de resultado de um dia para o outro). */
function mulberry32(semente: number) {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN = 60 * 1000;

interface Caso {
  estado: EstadoPrevisao;
  regras: RegrasDePrevisao;
  agora: Date;
}

function casoAleatorio(rnd: () => number): Caso {
  const inteiro = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const escolhe = <T>(...v: T[]) => v[inteiro(0, v.length - 1)];
  // Tudo em minutos cheios: as rotinas rodam de minuto em minuto, então a previsão é conferida minuto a minuto.
  const agora = new Date(seg(6, 0).getTime() + inteiro(0, 3 * 24 * 60) * MIN);
  const cliente = new Date(agora.getTime() - inteiro(1, 30 * 60) * MIN);
  const loja = rnd() < 0.8 ? new Date(cliente.getTime() + inteiro(1, 600) * MIN) : new Date(cliente.getTime() - inteiro(1, 600) * MIN);
  const lojaPassada = loja.getTime() <= agora.getTime() ? loja : new Date(agora.getTime() - MIN);
  const inicio = inteiro(6, 10);
  const regrasRec: RegrasRecuperacao = {
    ...REGRAS_RECUPERACAO_PADRAO,
    ligado: rnd() < 0.9,
    primeiraMin: escolhe(1, 15, 30, 45, 90, 180),
    segundaLigada: rnd() < 0.8,
    segundaModo: escolhe("horas" as const, "dia_seguinte" as const),
    segundaHoras: inteiro(1, 23),
    segundaHora: escolhe("08:00", "10:00", "13:30", "17:45"),
    horarioInicio: inicio,
    horarioFim: inteiro(inicio + 1, 22),
    perdidoHoras: escolhe(1, 5, 12, 30, 72),
  };
  // Estado do ciclo: nada enviado, só a 1ª, ou as duas (as mensagens enviadas ficam entre a nossa última e agora).
  const fase = rnd();
  const primeira = fase > 0.35 ? new Date(Math.min(lojaPassada.getTime() + inteiro(1, 400) * MIN, agora.getTime() - MIN)) : null;
  const segunda = fase > 0.7 && primeira ? new Date(Math.min(primeira.getTime() + inteiro(1, 400) * MIN, agora.getTime() - MIN)) : null;
  const estado: EstadoPrevisao = {
    etapa: "novo",
    arquivadoEm: null,
    classificacao: rnd() < 0.1 ? "pos_venda" : null,
    modoAtendimento: "bot",
    aguardandoHumano: false,
    naoReceberEm: rnd() < 0.08 ? cliente : null,
    temVisitaFutura: rnd() < 0.06,
    proximoContatoEm: rnd() < 0.15 ? new Date(agora.getTime() + inteiro(-300, 7 * 24 * 60) * MIN) : null,
    ultimaMsgClienteEm: cliente,
    ultimaMsgLojaEm: lojaPassada,
    recuperacaoPrimeiraEm: primeira,
    recuperacaoSegundaEm: segunda,
    recuperacaoFalhou: rnd() < 0.05,
    passouPorHumano: rnd() < 0.05,
    visitaEm: null,
    perdidoEm: null,
    autorDaMudanca: null,
  };
  return { estado, agora, regras: { recuperacao: regrasRec, rede: { ligado: rnd() < 0.9, dias: inteiro(1, 7) }, arquivar: { ...ARQ, ligado: rnd() < 0.9, diasAutomatico: inteiro(1, 10), diasVendedor: inteiro(10, 90), vendedorLigado: rnd() < 0.7 } } };
}

/** Minutos amostrados entre `de` (inclusive) e `ate` (exclusive): os dois bordos mais pontos espalhados. */
function amostras(de: Date, ate: Date, passoMax: number, rnd: () => number): Date[] {
  const lista: Date[] = [];
  if (ate.getTime() <= de.getTime()) return lista;
  lista.push(de, new Date(ate.getTime() - MIN));
  for (let t = de.getTime() + MIN; t < ate.getTime(); t += Math.ceil(rnd() * passoMax) * MIN) lista.push(new Date(t));
  return lista;
}

describe("a previsão bate com as regras de verdade (consistência)", () => {
  const rnd = mulberry32(20261125);
  const casos = Array.from({ length: 600 }, () => casoAleatorio(rnd));

  it("recuperação: a ação sai no minuto previsto e em nenhum minuto antes", () => {
    let conferidos = 0;
    for (const { estado, regras, agora } of casos) {
      const p = previsaoRecuperacao(estado, regras.recuperacao, agora);
      const esperado = p.tipo === "primeira" ? "enviar_primeira" : p.tipo === "segunda" ? "enviar_segunda" : p.tipo === "perdido" ? "mover_perdido" : null;
      if (esperado) {
        expect(p.tipo !== "fora" && p.tipo !== "travado" && p.quando.getTime()).toBeGreaterThanOrEqual(agora.getTime());
        const quando = (p as { quando: Date }).quando;
        expect(avaliarRecuperacao(estado, regras.recuperacao, quando), `no minuto previsto ${quando.toISOString()}`).toBe(esperado);
        for (const t of amostras(agora, quando, 41, rnd)) expect(avaliarRecuperacao(estado, regras.recuperacao, t), `antes do previsto: ${t.toISOString()}`).toBeNull();
        conferidos++;
      } else {
        // Travado ou fora: nenhuma ação nas próximas 48 h.
        for (const t of amostras(agora, new Date(agora.getTime() + 48 * HORA), 29, rnd)) expect(avaliarRecuperacao(estado, regras.recuperacao, t), `travado/fora: ${p.tipo} ${t.toISOString()}`).toBeNull();
      }
    }
    expect(conferidos).toBeGreaterThan(100);
  });

  it("recuperação: os passos seguintes projetados são os que o ciclo realmente executa", () => {
    let conferidos = 0;
    for (const { estado, regras, agora } of casos.slice(0, 150)) {
      const p = previsaoRecuperacao(estado, regras.recuperacao, agora);
      if (p.tipo !== "primeira" && p.tipo !== "segunda" && p.tipo !== "perdido") continue;
      // Roda o ciclo minuto a minuto, aplicando cada ação como a rotina aplicaria.
      const vivo = { ...estado };
      const feito: Record<string, number> = {};
      for (let t = agora.getTime(); t < agora.getTime() + 9 * DIA; t += MIN) {
        const acao = avaliarRecuperacao(vivo, regras.recuperacao, new Date(t));
        if (!acao) continue;
        if (acao === "enviar_primeira") {
          vivo.recuperacaoPrimeiraEm = new Date(t);
          feito.primeira = t;
        }
        if (acao === "enviar_segunda") {
          vivo.recuperacaoSegundaEm = new Date(t);
          feito.segunda = t;
        }
        if (acao === "mover_perdido") {
          feito.perdido = t;
          break;
        }
      }
      for (const passo of p.passos.filter((x) => !x.feito)) expect(feito[passo.tipo], `${passo.tipo} projetado ${passo.quando.toISOString()}`).toBe(passo.quando.getTime());
      // Se a previsão diz que o ciclo trava, a simulação também não chega a Perdido.
      if (p.travaDepois) expect(feito.perdido).toBeUndefined();
      conferidos++;
    }
    expect(conferidos).toBeGreaterThan(30);
  });

  it("rede de segurança: age no minuto previsto e em nenhum antes", () => {
    let conferidos = 0;
    for (const { estado, regras, agora } of casos) {
      const p = previsaoRede(estado, regras.rede, agora);
      if (p.tipo === "fora") {
        for (const t of amostras(agora, new Date(agora.getTime() + 9 * DIA), 191, rnd)) expect(avaliarRede(estado, regras.rede, t), `fora: ${p.motivo} ${t.toISOString()}`).toBeNull();
        continue;
      }
      expect(avaliarRede(estado, regras.rede, p.quando), `no minuto previsto ${p.quando.toISOString()}`).toBe(p.tipo);
      for (const t of amostras(agora, p.quando, 97, rnd)) expect(avaliarRede(estado, regras.rede, t), `antes do previsto: ${t.toISOString()}`).toBeNull();
      conferidos++;
    }
    expect(conferidos).toBeGreaterThan(150);
  });

  it("arquivo: Perdido arquiva no minuto previsto e em nenhum antes", () => {
    let conferidos = 0;
    for (const { estado, regras, agora } of casos) {
      const perdido: EstadoPrevisao = { ...estado, etapa: "perdido", perdidoEm: new Date(agora.getTime() - Math.floor(rnd() * 12 * 24 * 60) * MIN), autorDaMudanca: rnd() < 0.5 ? "sistema" : "Rafael" };
      const p = previsaoArquivo(perdido, regras.arquivar, agora);
      if (p.tipo === "arquivo") {
        expect(diasParaArquivar(perdido, regras.arquivar, p.quando), `no minuto previsto ${p.quando.toISOString()}`).toBe(p.dias);
        for (const t of amostras(agora, p.quando, 1500, rnd)) expect(diasParaArquivar(perdido, regras.arquivar, t), `antes do previsto: ${t.toISOString()}`).toBeNull();
        conferidos++;
      } else {
        for (const t of amostras(agora, new Date(agora.getTime() + 120 * DIA), 2500, rnd)) expect(diasParaArquivar(perdido, regras.arquivar, t)).toBeNull();
      }
    }
    expect(conferidos).toBeGreaterThan(150);
  });

  it("o card: o próximo evento mostrado é o primeiro que alguma regra executa", () => {
    let conferidos = 0;
    for (const { estado, regras, agora } of casos) {
      const card = previsaoDoCard(estado, regras, agora);
      if (card.coluna !== "novo" || !card.quando) continue;
      if (card.tipo !== "primeira" && card.tipo !== "segunda" && card.tipo !== "perdido" && card.tipo !== "arquivo" && card.tipo !== "travado") continue;
      const acoes = (t: Date) => ({ rec: avaliarRecuperacao(estado, regras.recuperacao, t), rede: avaliarRede(estado, regras.rede, t) });
      const noMinuto = acoes(card.quando);
      const esperado: Record<string, string[]> = {
        primeira: ["enviar_primeira"],
        segunda: ["enviar_segunda"],
        perdido: ["mover_perdido", "perdido"],
        arquivo: ["arquivar"],
        travado: ["perdido", "arquivar"],
      };
      expect([noMinuto.rec, noMinuto.rede].some((a) => !!a && esperado[card.tipo].includes(a)), `${card.tipo} em ${card.quando.toISOString()}: ${JSON.stringify(noMinuto)}`).toBe(true);
      for (const t of amostras(agora, card.quando, 53, rnd)) {
        const a = acoes(t);
        expect(a.rec ?? a.rede, `antes do previsto (${card.tipo}): ${t.toISOString()}`).toBeNull();
      }
      conferidos++;
    }
    expect(conferidos).toBeGreaterThan(150);
  });
});
