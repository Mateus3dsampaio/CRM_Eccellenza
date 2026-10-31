import { beforeEach, describe, expect, it } from "vitest";
import { montarPromptSistema } from "@/bot/prompt";
import { montarZip } from "@/lib/zip";
import { pode } from "@/regras/permissoes";
import {
  criarInstrucao,
  excluirInstrucao,
  editarInstrucao,
  instrucoesAtivas,
  listarInstrucoes,
  paraExportar,
  reordenarInstrucoes,
  tituloDaPrimeiraLinha,
  voltarParaAnterior,
} from "@/servicos/instrucoes";
import { limparBanco } from "./ajuda";

beforeEach(async () => {
  await limparBanco();
});

describe("instruções de atendimento (o CRM é a fonte)", () => {
  it("carrega as 13 instruções dos arquivos na primeira vez e não recarrega depois", async () => {
    const lista = await listarInstrucoes();
    expect(lista).toHaveLength(13);
    expect(lista[0].titulo).toBe("Papel e tom");
    expect(lista.map((i) => i.ordem)).toEqual(Array.from({ length: 13 }, (_, n) => n + 1));
    await editarInstrucao(lista[0].id, { titulo: "Outro título" });
    expect(await listarInstrucoes()).toHaveLength(13);
  });

  it("o bot usa o texto do banco, na ordem, e ignora as desativadas", async () => {
    const [a, b] = await listarInstrucoes();
    await editarInstrucao(a.id, { texto: "TEXTO NOVO DA PRIMEIRA" });
    await editarInstrucao(b.id, { ativa: false });
    const prompt = await montarPromptSistema();
    expect(prompt).toContain("TEXTO NOVO DA PRIMEIRA");
    expect(prompt).not.toContain(b.texto);
    expect((await instrucoesAtivas()).length).toBe(12);
  });

  it("guarda só a versão anterior e permite voltar e desfazer o voltar", async () => {
    const [a] = await listarInstrucoes();
    const original = a.texto;
    await editarInstrucao(a.id, { texto: "versão 2" });
    const v3 = await editarInstrucao(a.id, { texto: "versão 3" });
    expect(v3.anteriorTexto).toBe("versão 2");

    const voltou = await voltarParaAnterior(a.id);
    expect(voltou.texto).toBe("versão 2");
    expect(voltou.anteriorTexto).toBe("versão 3");
    expect(original).not.toBe("versão 2");
  });

  it("ligar/desligar e reordenar não criam versão anterior; sem anterior, voltar dá erro", async () => {
    const [a] = await listarInstrucoes();
    await editarInstrucao(a.id, { ativa: false });
    expect((await listarInstrucoes())[0].anteriorTexto).toBeNull();
    await expect(voltarParaAnterior(a.id)).rejects.toThrow("não tem versão anterior");

    const ids = (await listarInstrucoes()).map((i) => i.id).reverse();
    await reordenarInstrucoes(ids);
    expect((await listarInstrucoes()).map((i) => i.id)).toEqual(ids);
    await expect(reordenarInstrucoes(ids.slice(1))).rejects.toThrow();
  });

  it("mudar só o título não apaga a versão anterior do texto; não deixa desativar a última ativa", async () => {
    const lista = await listarInstrucoes();
    const a = lista[0];
    await editarInstrucao(a.id, { texto: "texto v2" });
    const renomeada = await editarInstrucao(a.id, { titulo: "Novo título" });
    expect(renomeada.anteriorTexto).toBe(a.texto);

    for (const i of lista.slice(1)) await editarInstrucao(i.id, { ativa: false });
    await expect(editarInstrucao(a.id, { ativa: false })).rejects.toThrow("ao menos uma instrução ativa");
  });

  it("cargas simultâneas da primeira vez não duplicam nem dão erro", async () => {
    const listas = await Promise.all([listarInstrucoes(), listarInstrucoes(), instrucoesAtivas()]);
    expect(listas[0]).toHaveLength(13);
    expect(await listarInstrucoes()).toHaveLength(13);
  });

  it("exclui de vez, reorganiza a ordem e protege a última ativa", async () => {
    const lista = await listarInstrucoes();
    await excluirInstrucao(lista[1].id);
    const depois = await listarInstrucoes();
    expect(depois).toHaveLength(12);
    expect(depois.map((i) => i.ordem)).toEqual(Array.from({ length: 12 }, (_, n) => n + 1));
    await expect(excluirInstrucao(lista[1].id)).rejects.toThrow("não encontrada");

    for (const i of depois.slice(1)) await excluirInstrucao(i.id);
    await expect(excluirInstrucao(depois[0].id)).rejects.toThrow("ao menos uma instrução ativa");
  });

  it("cria nova instrução no fim da lista", async () => {
    await listarInstrucoes();
    const nova = await criarInstrucao({ titulo: "Garantia", texto: "Texto da garantia" });
    expect(nova.ordem).toBe(14);
    expect(await instrucoesAtivas()).toContain("Texto da garantia");
  });

  it("só o admin tem a permissão de configurar", () => {
    expect(pode("admin", "configurar")).toBe(true);
    expect(pode("consultor", "configurar")).toBe(false);
  });

  it("exporta só as selecionadas, em ordem, e recusa lista vazia", async () => {
    const lista = await listarInstrucoes();
    const { texto, arquivos } = await paraExportar([lista[2].id, lista[0].id]);
    expect(arquivos.map((a) => a.nome)).toEqual(["01-papel-e-tom.txt", "02-valores-e-encaminhamento-ao-consultor.txt"]);
    expect(texto.startsWith(lista[0].texto.trim())).toBe(true);
    expect((await paraExportar(null)).arquivos).toHaveLength(13);
    await expect(paraExportar([])).rejects.toThrow("Selecione");
  });

  it("título da carga inicial vem da primeira linha", () => {
    expect(tituloDaPrimeiraLinha("04. CLIENTE FORA DA FAIXA\nx", "p")).toBe("Cliente fora da faixa");
    expect(tituloDaPrimeiraLinha("", "padrão")).toBe("padrão");
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
