import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { responderCliente } from "@/bot/atendimento";
import { executarFerramenta } from "@/bot/executor";
import { FERRAMENTAS, NOME_ENCERRAR_CONTATO } from "@/bot/ferramentas";
import { bloquearContato, contatoBloqueado } from "@/servicos/bloqueio";
import { salvarChave } from "@/servicos/chaves-api";
import { listaArquivados } from "@/servicos/consultas";
import { receberMensagemCliente } from "@/servicos/conversa";
import { obterOuCriarLead, restaurarLead } from "@/servicos/leads";
import { registrarMensagemCliente } from "@/servicos/mensagens";
import { dadosDoPainel } from "@/servicos/painel";
import { definirConfigDoBot } from "@/servicos/provedor-bot";
import { processarWebhook } from "@/servicos/whatsapp";
import { criarRoteiroDeTeste, limparBanco } from "./ajuda";

const ler = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });

/** Lead novo, com o bot, que mandou uma mensagem sem relação com a loja. */
async function contato(telefone: string) {
  const lead = await obterOuCriarLead(telefone, "Fulano");
  await registrarMensagemCliente(lead.id, "Olá! Posso ter mais informações sobre isso?");
  return lead.id;
}

describe("contato bloqueado (tarefa 44)", () => {
  beforeEach(async () => {
    await limparBanco();
    await criarRoteiroDeTeste();
    vi.restoreAllMocks();
    vi.stubEnv("CHAVE_MESTRA", "mestra-de-teste-bem-longa");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  it("bloquear: vai para o arquivo sem passar por Perdido, sai da espera e fica registrado", async () => {
    const id = await contato("+5588900000201");
    await db.lead.update({ where: { id }, data: { aguardandoHumano: true, esperandoDesde: new Date(), naoLidas: 3 } });
    expect(await bloquearContato(id, "Ana", "conversa sem relação com a loja")).toBe(true);
    const l = await ler(id);
    expect(l).toMatchObject({ etapa: "novo", bloqueadoPor: "Ana", aguardandoHumano: false, esperandoDesde: null, naoLidas: 0, motivoPerda: null });
    expect(l.bloqueadoEm).not.toBeNull();
    expect(l.arquivadoEm).not.toBeNull();
    expect(await db.alteracao.count({ where: { leadId: id, descricao: { startsWith: "Bloqueou o contato (conversa sem relação com a loja)" } } })).toBe(1);
    expect(await contatoBloqueado("+5588900000201")).toBe(true);
    // Duas vezes não conta de novo.
    expect(await bloquearContato(id, "Ana")).toBe(false);
    expect((await dadosDoPainel({ atalho: "hoje" })).automacao.bloqueados).toBe(1);
    expect((await listaArquivados()).find((x) => x.id === id)).toMatchObject({ bloqueado: true, bloqueadoPor: "Ana" });
  });

  it("mensagem nova de bloqueado: fica guardada, mas não tira do arquivo, não avisa, não abre espera e não chama a IA", async () => {
    const id = await contato("+5588900000202");
    await bloquearContato(id, "bot");
    const arquivadoEm = (await ler(id)).arquivadoEm;
    const alertas = await db.alerta.count();
    const chamadas = vi.spyOn(globalThis, "fetch");
    const r = await receberMensagemCliente({ telefone: "+5588900000202", texto: "parar" });
    expect(r.respostas).toEqual([]);
    expect(chamadas).not.toHaveBeenCalled();
    const l = await ler(id);
    expect(l.arquivadoEm).toEqual(arquivadoEm);
    expect(l).toMatchObject({ naoLidas: 0, aguardandoHumano: false, naoReceberEm: null });
    expect(await db.alerta.count()).toBe(alertas);
    expect(await db.mensagem.count({ where: { leadId: id, autor: "cliente", texto: "parar", processadaPeloBot: true } })).toBe(1);
    // Nenhuma resposta da loja (nem a confirmação do "parar").
    expect(await db.mensagem.count({ where: { leadId: id, autor: { not: "cliente" } } })).toBe(0);
    expect(await db.usoApi.count()).toBe(0);
    expect((await responderCliente(id)).respostas).toEqual([]);
  });

  it("restaurar do arquivo desbloqueia: o contato volta ao kanban e a IA volta a valer para as próximas mensagens", async () => {
    const id = await contato("+5588900000203");
    await bloquearContato(id, "bot");
    await registrarMensagemCliente(id, "mensagem durante o bloqueio");
    await restaurarLead(id, "Mateus");
    expect(await ler(id)).toMatchObject({ arquivadoEm: null, bloqueadoEm: null, bloqueadoPor: null });
    expect(await db.alteracao.count({ where: { leadId: id, descricao: "Desbloqueou o contato" } })).toBe(1);
    // O que chegou durante o bloqueio já está como visto: o bot não responde a isso depois.
    expect(await db.mensagem.count({ where: { leadId: id, processadaPeloBot: false } })).toBe(0);
    await registrarMensagemCliente(id, "agora quero um orçamento");
    expect((await ler(id)).ultimaMensagemPrevia).toBe("agora quero um orçamento");
  });

  it("ferramenta encerrar_contato: existe, exige motivo e só vale para lead que ainda está com o bot na primeira coluna", async () => {
    const ferramenta = FERRAMENTAS.find((f) => f.name === NOME_ENCERRAR_CONTATO);
    expect(ferramenta?.input_schema.required).toEqual(["motivo"]);
    const id = await contato("+5588900000204");
    expect((await executarFerramenta(id, NOME_ENCERRAR_CONTATO, {})).erro).toBe(true);
    expect((await ler(id)).bloqueadoEm).toBeNull();

    const passado = await contato("+5588900000205");
    await executarFerramenta(passado, "passar_para_consultor", { motivo: "roteiro concluído" });
    const recusa = await executarFerramenta(passado, NOME_ENCERRAR_CONTATO, { motivo: "sem relação" });
    expect(recusa.erro).toBe(true);
    expect((await ler(passado)).bloqueadoEm).toBeNull();

    const r = await executarFerramenta(id, NOME_ENCERRAR_CONTATO, { motivo: "conversa sem relação com a loja" });
    expect(r.erro).toBeUndefined();
    expect(await ler(id)).toMatchObject({ bloqueadoPor: "bot" });
    expect((await ler(id)).arquivadoEm).not.toBeNull();
  });

  it("quando a IA encerra o contato, nada é enviado ao cliente (nem o texto que veio junto) e a conversa com a IA para ali", async () => {
    await salvarChave("openai", "sk-openai-bloqueio-0123456789abcd");
    await definirConfigDoBot({ provedor: "openai", modeloOpenai: "gpt-teste" });
    const respostas = [
      { choices: [{ finish_reason: "tool_calls", message: { content: "Vou encerrar por aqui.", tool_calls: [{ id: "call_1", type: "function", function: { name: NOME_ENCERRAR_CONTATO, arguments: '{"motivo":"conversa sem relação com a loja"}' } }] } }], usage: { prompt_tokens: 100, completion_tokens: 10 } },
      { choices: [{ finish_reason: "stop", message: { content: "Tchau!" } }], usage: { prompt_tokens: 120, completion_tokens: 5 } },
    ];
    const chamadas = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(respostas.shift()), { status: 200, headers: { "content-type": "application/json" } }));
    const id = await contato("+5588900000206");
    const r = await responderCliente(id);
    expect(r).toEqual({ respostas: [] });
    expect(chamadas).toHaveBeenCalledTimes(1);
    expect(await db.mensagem.count({ where: { leadId: id, autor: "bot" } })).toBe(0);
    const l = await ler(id);
    expect(l.bloqueadoPor).toBe("bot");
    expect(l.erroBot).toBeNull();
    expect(l.aguardandoHumano).toBe(false);
    // O histórico guardado continua válido: a ferramenta tem o resultado.
    const guardado = JSON.stringify(JSON.parse((await db.conversaApi.findUniqueOrThrow({ where: { leadId: id } })).mensagens));
    expect(guardado).toContain('"tool_result"');
  });

  it("WhatsApp: áudio e arquivo de contato bloqueado não são baixados nem transcritos (nenhuma chamada sai)", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "token-secreto");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456");
    vi.stubEnv("META_APP_SECRET", "segredo");
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "verificacao");
    vi.stubEnv("MODO_SIMULADOR", "0");
    await salvarChave("openai", "sk-openai-audio-0123456789abcdef");
    const id = await contato("+5588900000207");
    await bloquearContato(id, "bot");
    const chamadas = vi.spyOn(globalThis, "fetch");
    const payload = (mensagem: object) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { contacts: [{ wa_id: "5588900000207", profile: { name: "Fulano" } }], messages: [{ from: "5588900000207", ...mensagem }] } }] }] });
    await processarWebhook(payload({ id: "wamid.AUDIO", type: "audio", audio: { id: "a1" } }));
    await processarWebhook(payload({ id: "wamid.FOTO", type: "image", image: { id: "i1", mime_type: "image/jpeg" } }));
    expect(chamadas).not.toHaveBeenCalled();
    const textos = (await db.mensagem.findMany({ where: { leadId: id, idExterno: { not: null } }, orderBy: { enviadaEm: "asc" } })).map((m) => m.texto);
    expect(textos).toEqual(["[áudio de contato bloqueado: não foi transcrito]", "[arquivo de contato bloqueado: não foi baixado]"]);
    expect(await db.mensagem.count({ where: { leadId: id, midiaArquivo: { not: null } } })).toBe(0);
    expect((await ler(id)).arquivadoEm).not.toBeNull();
  });
});
