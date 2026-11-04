import { beforeEach, describe, expect, it } from "vitest";
import { MANUAL_INICIAL } from "@/bot/manual-inicial";
import { montarPromptSistema } from "@/bot/prompt";
import { db } from "@/lib/db";
import { montarZip } from "@/lib/zip";
import { pode } from "@/regras/permissoes";
import {
  criarInstrucao,
  excluirInstrucao,
  editarInstrucao,
  instrucoesAtivas,
  listarInstrucoes,
  obterManual,
  paraExportar,
  reordenarInstrucoes,
  TITULO_MANUAL,
  voltarParaAnterior,
} from "@/servicos/instrucoes";
import { limparBanco } from "./ajuda";

beforeEach(async () => {
  await limparBanco();
});

/** Três instruções numeradas de exemplo (o projeto não traz roteiro). */
async function tresInstrucoes() {
  for (const n of [1, 2, 3]) await criarInstrucao({ titulo: `Instrução ${n}`, texto: `0${n}. INSTRUÇÃO ${n}\nTexto da instrução ${n}.` });
  return listarInstrucoes();
}

describe("instruções de atendimento (coladas pelo admin; o projeto não traz cópia)", () => {
  it("banco vazio: nenhuma instrução numerada, só o Manual do CRM, criado uma vez", async () => {
    expect(await listarInstrucoes()).toEqual([]);
    expect(await instrucoesAtivas()).toEqual([]);
    const manual = await obterManual();
    expect(manual.titulo).toBe(TITULO_MANUAL);
    expect(manual.texto).toBe(MANUAL_INICIAL);
    await Promise.all([obterManual(), listarInstrucoes(), instrucoesAtivas()]);
    expect(await db.instrucao.count({ where: { tipo: "manual" } })).toBe(1);
  });

  it("o manual não oferece agendamento: quem agenda é o consultor", () => {
    expect(MANUAL_INICIAL).toContain("passar_para_consultor");
    expect(MANUAL_INICIAL).not.toContain("ver_horarios_livres");
    expect(MANUAL_INICIAL).not.toContain("agendar_visita");
  });

  it("banco antigo: a instrução 15 vira o manual (texto antigo como anterior) e a 14 sai da lista", async () => {
    const agora = new Date();
    await db.instrucao.createMany({
      data: [
        { titulo: "Papel e tom", texto: "01. PAPEL E TOM\nx", ordem: 1, criadoEm: agora, atualizadoEm: agora },
        { titulo: "Dados da loja", texto: "14. DADOS DA LOJA\ny", ordem: 2, criadoEm: agora, atualizadoEm: agora },
        { titulo: "Regras do crm e ferramentas", texto: "15. REGRAS DO CRM E FERRAMENTAS\nantigo", ordem: 3, criadoEm: agora, atualizadoEm: agora },
        { titulo: "Nova", texto: "Outra instrução", ordem: 4, criadoEm: agora, atualizadoEm: agora },
      ],
    });
    const lista = await listarInstrucoes();
    expect(lista.map((i) => [i.titulo, i.ordem])).toEqual([["Papel e tom", 1], ["Nova", 2]]);
    const manual = await obterManual();
    expect(manual.texto).toBe(MANUAL_INICIAL);
    expect(manual.anteriorTexto).toBe("15. REGRAS DO CRM E FERRAMENTAS\nantigo");
    // Voltar para o texto antigo mantém o título fixo do manual.
    const voltou = await voltarParaAnterior(manual.id);
    expect(voltou.titulo).toBe(TITULO_MANUAL);
    expect(voltou.texto).toContain("antigo");
    expect(await db.instrucao.count({ where: { tipo: "manual" } })).toBe(1);
  });

  it("o bot usa o roteiro do banco, na ordem, sem as desativadas, e depois o manual", async () => {
    const [a, b] = await tresInstrucoes();
    await editarInstrucao(a.id, { texto: "TEXTO NOVO DA PRIMEIRA" });
    await editarInstrucao(b.id, { ativa: false });
    const prompt = await montarPromptSistema();
    expect(prompt).toContain("TEXTO NOVO DA PRIMEIRA");
    expect(prompt).not.toContain(b.texto);
    expect(prompt.indexOf("TEXTO NOVO DA PRIMEIRA")).toBeLessThan(prompt.indexOf("# Manual do CRM"));
    expect(prompt).toContain("passar_para_consultor");
    expect((await instrucoesAtivas()).length).toBe(2);
    const manual = await obterManual();
    await editarInstrucao(manual.id, { texto: "MANUAL EDITADO" });
    expect(await montarPromptSistema()).toContain("MANUAL EDITADO");
  });

  it("o manual tem título fixo e não pode ser desativado nem excluído; não entra na lista nem na ordem", async () => {
    await tresInstrucoes();
    const manual = await obterManual();
    const editado = await editarInstrucao(manual.id, { titulo: "Outro", texto: "novo texto" });
    expect(editado.titulo).toBe(TITULO_MANUAL);
    expect(editado.anteriorTexto).toBe(MANUAL_INICIAL);
    await expect(editarInstrucao(manual.id, { ativa: false })).rejects.toThrow("não pode ser desativado");
    await expect(excluirInstrucao(manual.id)).rejects.toThrow("não pode ser excluído");
    const ids = (await listarInstrucoes()).map((i) => i.id);
    expect(ids).not.toContain(manual.id);
    await expect(reordenarInstrucoes([...ids, manual.id])).rejects.toThrow();
  });

  it("guarda só a versão anterior e permite voltar e desfazer o voltar", async () => {
    const [a] = await tresInstrucoes();
    await editarInstrucao(a.id, { texto: "versão 2" });
    const v3 = await editarInstrucao(a.id, { texto: "versão 3" });
    expect(v3.anteriorTexto).toBe("versão 2");
    const voltou = await voltarParaAnterior(a.id);
    expect(voltou.texto).toBe("versão 2");
    expect(voltou.anteriorTexto).toBe("versão 3");
  });

  it("ligar/desligar e reordenar não criam versão anterior; sem anterior, voltar dá erro", async () => {
    const [a] = await tresInstrucoes();
    await editarInstrucao(a.id, { ativa: false });
    expect((await listarInstrucoes())[0].anteriorTexto).toBeNull();
    await expect(voltarParaAnterior(a.id)).rejects.toThrow("não tem versão anterior");
    const ids = (await listarInstrucoes()).map((i) => i.id).reverse();
    await reordenarInstrucoes(ids);
    expect((await listarInstrucoes()).map((i) => i.id)).toEqual(ids);
    await expect(reordenarInstrucoes(ids.slice(1))).rejects.toThrow();
  });

  it("mudar só o título não apaga a versão anterior do texto; não deixa desativar a última ativa", async () => {
    const lista = await tresInstrucoes();
    const a = lista[0];
    await editarInstrucao(a.id, { texto: "texto v2" });
    const renomeada = await editarInstrucao(a.id, { titulo: "Novo título" });
    expect(renomeada.anteriorTexto).toBe(a.texto);
    for (const i of lista.slice(1)) await editarInstrucao(i.id, { ativa: false });
    await expect(editarInstrucao(a.id, { ativa: false })).rejects.toThrow("ao menos uma instrução ativa");
  });

  it("exclui de vez, reorganiza a ordem e protege a última ativa", async () => {
    const lista = await tresInstrucoes();
    await excluirInstrucao(lista[1].id);
    const depois = await listarInstrucoes();
    expect(depois.map((i) => i.ordem)).toEqual([1, 2]);
    await expect(excluirInstrucao(lista[1].id)).rejects.toThrow("não encontrada");
    await excluirInstrucao(depois[1].id);
    await expect(excluirInstrucao(depois[0].id)).rejects.toThrow("ao menos uma instrução ativa");
  });

  it("cria nova instrução no fim da lista (o manual não conta na numeração)", async () => {
    await tresInstrucoes();
    const nova = await criarInstrucao({ titulo: "Garantia", texto: "Texto da garantia" });
    expect(nova.ordem).toBe(4);
    expect(await instrucoesAtivas()).toContain("Texto da garantia");
  });

  it("só o admin tem a permissão de configurar", () => {
    expect(pode("admin", "configurar")).toBe(true);
    expect(pode("consultor", "configurar")).toBe(false);
  });

  it("exporta só as selecionadas, em ordem; tudo leva o manual por último; recusa lista vazia", async () => {
    const lista = await tresInstrucoes();
    const { texto, arquivos } = await paraExportar([lista[2].id, lista[0].id]);
    expect(arquivos.map((a) => a.nome)).toEqual(["01-instrucao-1.txt", "02-instrucao-3.txt"]);
    expect(texto.startsWith(lista[0].texto.trim())).toBe(true);
    const tudo = await paraExportar(null);
    expect(tudo.arquivos.map((a) => a.nome).at(-1)).toBe("manual-do-crm.txt");
    expect(tudo.arquivos).toHaveLength(4);
    const manual = await obterManual();
    expect((await paraExportar([manual.id])).arquivos.map((a) => a.nome)).toEqual(["manual-do-crm.txt"]);
    await expect(paraExportar([])).rejects.toThrow("Selecione");
  });
});

describe("bot sem instruções cadastradas", () => {
  it("não chama a API: passa o cliente ao consultor e avisa o motivo", async () => {
    const { responderCliente } = await import("@/bot/atendimento");
    const { obterOuCriarLead } = await import("@/servicos/leads");
    const { registrarMensagemCliente } = await import("@/servicos/mensagens");
    const lead = await obterOuCriarLead("+5588900006666", "Cliente");
    await registrarMensagemCliente(lead.id, "Oi, quero uma cozinha");
    const r = await responderCliente(lead.id);
    expect(r.respostas).toEqual([]);
    expect(r.erro).toMatch(/sem instruções/);
    const depois = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(depois).toMatchObject({ etapa: "qualificacao", modoAtendimento: "pausado", aguardandoHumano: true });
    expect(depois.erroBot).toMatch(/sem instruções/);
    expect(await db.usoApi.count()).toBe(0);
  });
});

describe("zip de exportação", () => {
  it("gera um zip válido com os arquivos e acentos preservados", () => {
    const zip = montarZip([
      { nome: "01-a.txt", conteudo: "Olá, ação\n" },
      { nome: "02-b.txt", conteudo: "segunda" },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const fim = zip.length - 22;
    expect(zip.readUInt32LE(fim)).toBe(0x06054b50);
    expect(zip.readUInt16LE(fim + 10)).toBe(2);
    expect(zip.includes(Buffer.from("Olá, ação\n", "utf8"))).toBe(true);
  });
});
