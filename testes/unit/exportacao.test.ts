import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { avancarRelogio, agora } from "@/lib/relogio";
import { montarCsv, periodoPadrao, validarPeriodo } from "@/regras/exportacao";
import { estatisticaDeTempos, primeiraRespostaDoConsultor, temposDoConsultor, turnosDoCliente } from "@/regras/tempo-resposta";
import { HORA, dataLocal } from "@/regras/tempo";
import { exportarDesempenho } from "@/servicos/exportacao";
import { moverEtapa, obterOuCriarLead } from "@/servicos/leads";
import { enviarMensagemLoja, registrarMensagemCliente } from "@/servicos/mensagens";
import { criarConsultores, limparBanco } from "./ajuda";

const MIN = 60 * 1000;

describe("período da exportação", () => {
  const hoje = dataLocal(2026, 10, 31, 15);
  it("aceita até 30 dias contando os dois extremos e recusa 31", () => {
    expect(validarPeriodo("2026-10-02", "2026-10-31", hoje).dias).toBe(30);
    expect(() => validarPeriodo("2026-10-01", "2026-10-31", hoje)).toThrow(/30 dias/);
  });
  it("recusa data invertida, futura ou vazia", () => {
    expect(() => validarPeriodo("2026-10-20", "2026-10-10", hoje)).toThrow(/depois/);
    expect(() => validarPeriodo("2026-10-20", "2026-11-01", hoje)).toThrow(/futuro/);
    expect(() => validarPeriodo("", "2026-10-10", hoje)).toThrow(/datas/);
  });
  it("o padrão são os últimos 30 dias e passa na própria validação", () => {
    const p = periodoPadrao(hoje);
    expect(p).toEqual({ de: "2026-10-02", ate: "2026-10-31" });
    expect(validarPeriodo(p.de, p.ate, hoje).dias).toBe(30);
  });
});

describe("tempo de resposta", () => {
  const t = (min: number) => new Date(min * MIN);
  it("recados seguidos do cliente são um turno e a resposta é do primeiro que responde", () => {
    const turnos = turnosDoCliente(
      [
        { autor: "cliente", enviadaEm: t(0) },
        { autor: "cliente", enviadaEm: t(1) },
        { autor: "sistema", enviadaEm: t(2) },
        { autor: "bot", enviadaEm: t(3) },
        { autor: "cliente", enviadaEm: t(10) },
        { autor: "consultor", enviadaEm: t(40) },
        { autor: "cliente", enviadaEm: t(100) },
      ],
      t(0),
      t(1000),
    );
    expect(turnos.map((x) => [x.respondidoPor, x.segundos])).toEqual([["bot", 180], ["consultor", 1800], [null, null]]);
  });
  it("só conta turnos que começam dentro do período", () => {
    const turnos = turnosDoCliente([{ autor: "cliente", enviadaEm: t(5) }, { autor: "bot", enviadaEm: t(6) }], t(10), t(20));
    expect(turnos).toEqual([]);
  });
  it("tempo do consultor mede toda resposta, ignora o bot e recomeça quando o bot responde", () => {
    const m = [
      { autor: "cliente", enviadaEm: t(0) },
      { autor: "cliente", enviadaEm: t(3) },
      { autor: "consultor", enviadaEm: t(5) }, // espera desde o minuto 0: 5 min
      { autor: "consultor", enviadaEm: t(6) }, // seguida: não conta
      { autor: "cliente", enviadaEm: t(60) },
      { autor: "bot", enviadaEm: t(61) }, // o bot respondeu: a espera recomeça
      { autor: "cliente", enviadaEm: t(100) },
      { autor: "consultor", enviadaEm: t(160) }, // 60 min
      { autor: "consultor", enviadaEm: t(500) }, // contato dele, sem cliente esperando: não conta
    ];
    expect(temposDoConsultor(m, t(0), t(1000)).map((r) => r.segundos)).toEqual([300, 3600]);
    expect(temposDoConsultor(m, t(100), t(1000)).map((r) => r.segundos)).toEqual([3600]);
  });
  it("primeira resposta depois do repasse", () => {
    const m = [
      { autor: "consultor", enviadaEm: t(1) }, // antes do repasse
      { autor: "consultor", enviadaEm: t(50) },
      { autor: "consultor", enviadaEm: t(90) },
    ];
    expect(primeiraRespostaDoConsultor(t(10), m)?.segundos).toBe(40 * 60);
    expect(primeiraRespostaDoConsultor(t(100), m)).toBeNull();
  });
  it("mediana, média e máximo", () => {
    expect(estatisticaDeTempos([60, 600, 120])).toEqual({ quantidade: 3, mediaSegundos: 260, medianaSegundos: 120, maximoSegundos: 600 });
    expect(estatisticaDeTempos([]).medianaSegundos).toBeNull();
  });
});

describe("CSV", () => {
  it("escapa aspas e vírgulas e protege contra fórmula", () => {
    const csv = montarCsv(["a", "b"], [['diz "oi", ok', "=SOMA(1)"], ["-5", "texto"]]);
    expect(csv).toContain('"diz ""oi"", ok",\'=SOMA(1)');
    expect(csv).toContain("-5,texto");
  });
});

describe("exportação do vendedor", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("separa bot e consultor, registra as etapas e deixa a mídia de fora quando não pedida", async () => {
    const [a, b] = await criarConsultores();
    const lead = await obterOuCriarLead("+5588900007777", "Fulano Secreto");
    await db.lead.update({ where: { id: lead.id }, data: { consultorId: a.id } });
    await registrarMensagemCliente(lead.id, "Oi, quero uma cozinha");
    await avancarRelogio(2 * MIN);
    await enviarMensagemLoja({ leadId: lead.id, autor: "bot", texto: "Olá! Qual o ambiente?" });
    await moverEtapa(lead.id, "pronto", "bot");
    await avancarRelogio(HORA);
    await registrarMensagemCliente(lead.id, "É a cozinha, 3 metros");
    await avancarRelogio(30 * MIN);
    await enviarMensagemLoja({ leadId: lead.id, autor: "consultor", autorNome: a.nome, texto: "Vamos marcar uma visita?" });
    await moverEtapa(lead.id, "qualificacao", a.nome, { semExigencias: true });

    // Lead de outro vendedor não entra.
    const outro = await obterOuCriarLead("+5588900008888");
    await db.lead.update({ where: { id: outro.id }, data: { consultorId: b.id } });
    await registrarMensagemCliente(outro.id, "Oi");

    const p = periodoPadrao(await agora());
    const { nomeArquivo, zip } = await exportarDesempenho({ vendedorId: a.id, ...{ de: p.de, ate: p.ate }, incluirMidia: false });
    const texto = zip.toString("utf8");

    expect(nomeArquivo).toMatch(/^desempenho-consultor-a-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(texto).toContain(`conversas/${lead.id}.txt`);
    expect(texto).not.toContain(`conversas/${outro.id}.txt`);
    expect(texto).toContain("Cliente: Oi, quero uma cozinha");
    expect(texto).toContain("Bot: Olá! Qual o ambiente?");
    expect(texto).toContain(`Consultor (${a.nome}): Vamos marcar uma visita?`);
    expect(texto).toContain("consultor_tempo_mediano_min,30.0");
    expect(texto).toContain("bot_tempo_mediano_min,2.0");
    expect(texto).toContain("chegaram_em_qualificacao,1");
    expect(texto).toContain("IA atendendo > Aguardando consultor > Em qualificação");
    expect(texto).not.toContain("+5588900007777");
    expect(texto).not.toContain("Fulano Secreto");
  });

  it("recusa período maior que 30 dias e vendedor inexistente", async () => {
    const [a] = await criarConsultores();
    await expect(exportarDesempenho({ vendedorId: a.id, de: "2026-01-01", ate: "2026-03-01", incluirMidia: false })).rejects.toThrow(/30 dias/);
    await expect(exportarDesempenho({ vendedorId: "nao-existe", de: "2026-10-01", ate: "2026-10-05", incluirMidia: false })).rejects.toThrow(/não encontrado/);
  });
});
