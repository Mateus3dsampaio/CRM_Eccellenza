import { db } from "@/lib/db";
import { motivoDeRecusaDaMidia, TAMANHO_MAXIMO, tipoImagemValido } from "@/lib/midias";
import { lerConfigInstagram, type ConfigInstagram } from "@/lib/instagram-config";
import { marcarMudanca } from "@/lib/versao";
import { agora } from "@/lib/relogio";
import { limiteDoTipo, tipoMidiaAceito } from "@/regras/midia";
import { AUDIO_NAO_PROCESSADO, AUDIO_NAO_TRANSCRITO, PREFIXO_AUDIO } from "@/regras/whatsapp";
import { enderecoDeMidiaPermitido, extrairEventosInstagram, INSTAGRAM_MIDIA_NAO_BAIXADA, type MensagemInstagram } from "@/regras/instagram";
import { ARQUIVO_DE_BLOQUEADO, AUDIO_DE_BLOQUEADO } from "./bloqueio";
import { ErroConversa, receberMensagemCliente } from "./conversa";
import { LIMITE_AUDIO_BYTES, tipoAudioAceito, transcreverAudio, transcricaoConfigurada } from "./transcricao";
import { registrarLogWebhook } from "./whatsapp";

// Integração com a API de mensagens do Instagram (Meta, tarefa 47). Nada aqui roda sem as variáveis de ambiente.
// Reaproveita a caixa de entrada de eventos e o log do WhatsApp (`servicos/whatsapp.ts`): o corpo traz `object: "instagram"`.

const TEMPO_LIMITE_MS = 15_000;
const fim = (id: string) => id.slice(-4);

export interface ResultadoEnvioInstagram {
  ok: boolean;
  id?: string;
  erro?: string;
}

/** Envia texto ao cliente (só dentro da janela de 24h: quem chama confere). Nunca lança. */
export async function enviarPeloInstagram(params: { para: string; texto: string }): Promise<ResultadoEnvioInstagram> {
  const cfg = lerConfigInstagram();
  if (!cfg) return { ok: false, erro: "Instagram não configurado" };
  try {
    const resposta = await fetch(`https://graph.facebook.com/${cfg.versaoApi}/${encodeURIComponent(cfg.contaId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      // Instagram aceita até 1000 caracteres por mensagem.
      body: JSON.stringify({ recipient: { id: params.para }, message: { text: params.texto.slice(0, 1000) } }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    const json = (await resposta.json().catch(() => ({}))) as { message_id?: string; error?: { code?: number } };
    if (!resposta.ok || !json.message_id) {
      // Só o código do erro vai para o log: a mensagem da Meta pode trazer dados do cliente.
      const erro = `a Meta recusou o envio (HTTP ${resposta.status}, código ${json.error?.code ?? "?"})`;
      await registrarLogWebhook("envio", `Instagram …${fim(params.para)}: ${erro}`, false);
      return { ok: false, erro };
    }
    return { ok: true, id: json.message_id };
  } catch {
    await registrarLogWebhook("envio", `Instagram …${fim(params.para)}: sem resposta da Meta`, false);
    return { ok: false, erro: "sem resposta da Meta" };
  }
}

/** Nome e @usuário do cliente (a Meta não manda no webhook). Melhor esforço: sem isso o lead aparece só como "Contato do Instagram". */
async function buscarPerfil(cfg: ConfigInstagram, igsid: string): Promise<{ nome: string | null; usuario: string | null }> {
  try {
    const r = await fetch(`https://graph.facebook.com/${cfg.versaoApi}/${encodeURIComponent(igsid)}?fields=name,username`, { headers: { Authorization: `Bearer ${cfg.token}` }, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (!r.ok) return { nome: null, usuario: null };
    const j = (await r.json()) as { name?: string; username?: string };
    return { nome: j.name?.trim() || null, usuario: j.username?.trim() || null };
  } catch {
    return { nome: null, usuario: null };
  }
}

/** Baixa o arquivo que o cliente mandou. O endereço vem do webhook: só servidor da Meta, https, sem redirecionamento e SEM o token (é endereço público). */
async function baixarMidiaInstagram(url: string, tipoMidia: "image" | "video" | "audio"): Promise<{ dados: Buffer; tipo: string } | null> {
  if (!enderecoDeMidiaPermitido(url)) return null;
  try {
    const arquivo = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (!arquivo.ok) return null;
    const tipo = (arquivo.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const aceito = tipoMidia === "audio" ? tipoAudioAceito(tipo) : tipoMidia === "image" ? tipoImagemValido(tipo) : tipoMidiaAceito(tipo);
    if (!aceito) return null;
    const limite = tipoMidia === "audio" ? LIMITE_AUDIO_BYTES : tipoMidia === "image" ? TAMANHO_MAXIMO : limiteDoTipo(tipo);
    const declarado = Number(arquivo.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > limite) return null;
    const dados = Buffer.from(await arquivo.arrayBuffer());
    if (dados.length > limite) return null;
    return { dados, tipo };
  } catch {
    return null;
  }
}

async function textoDoAudio(m: MensagemInstagram): Promise<string> {
  if (!m.midiaUrl || !(await transcricaoConfigurada())) return m.texto ?? "[o cliente enviou um áudio, que o sistema ainda não consegue ouvir]";
  const audio = await baixarMidiaInstagram(m.midiaUrl, "audio");
  if (!audio) return AUDIO_NAO_PROCESSADO;
  const falado = await transcreverAudio(audio.dados, audio.tipo);
  if (!falado) {
    await registrarLogWebhook("mensagem", `Áudio do Instagram …${fim(m.igsid)} não pôde ser transcrito`, false);
    return AUDIO_NAO_TRANSCRITO;
  }
  await registrarLogWebhook("mensagem", `Áudio do Instagram …${fim(m.igsid)} transcrito (${Math.ceil(audio.dados.length / 1024)} KB)`);
  return `${PREFIXO_AUDIO}${falado}`;
}

async function aplicarMensagemInstagram(m: MensagemInstagram, cfg: ConfigInstagram | null) {
  if (await db.mensagem.findUnique({ where: { idExterno: m.idExterno }, select: { id: true } })) {
    await registrarLogWebhook("mensagem", `Mensagem repetida do Instagram …${fim(m.igsid)} ignorada`);
    return;
  }
  const lead = await db.lead.findUnique({ where: { igsid: m.igsid }, select: { bloqueadoEm: true, nomePerfil: true, igUsuario: true } });
  let texto = m.texto;
  let midia: { dados: Buffer; tipo: string; nome: string | null } | null = null;
  if (lead?.bloqueadoEm) {
    // Contato bloqueado (tarefa 44): não gasta transcrição nem espaço.
    if (m.tipoMidia === "audio") texto = AUDIO_DE_BLOQUEADO;
    else if (m.midiaUrl) texto = [texto, ARQUIVO_DE_BLOQUEADO].filter(Boolean).join(" ");
  } else if (m.tipoMidia === "audio") {
    texto = await textoDoAudio(m);
  } else if (m.midiaUrl && m.tipoMidia) {
    const arquivo = await baixarMidiaInstagram(m.midiaUrl, m.tipoMidia);
    if (arquivo && !motivoDeRecusaDaMidia(arquivo.dados, arquivo.tipo, null)) midia = { ...arquivo, nome: null };
    else texto = [texto, INSTAGRAM_MIDIA_NAO_BAIXADA].filter(Boolean).join(" ");
  }
  // Lead novo (ou ainda sem nome): busca o perfil uma vez. Sem permissão ou sem rede, segue sem nome.
  let perfil: { nome: string | null; usuario: string | null } = { nome: null, usuario: null };
  if (cfg && (!lead || !lead.nomePerfil || !lead.igUsuario) && !lead?.bloqueadoEm) perfil = await buscarPerfil(cfg, m.igsid);
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      await receberMensagemCliente({ instagram: { igsid: m.igsid, usuario: perfil.usuario }, nomePerfil: perfil.nome, texto, midia, idExterno: m.idExterno });
      await registrarLogWebhook("mensagem", `Mensagem do Instagram (${m.tipo}) de …${fim(m.igsid)} recebida`);
      return;
    } catch (erro) {
      const conflito = typeof erro === "object" && erro !== null && (erro as { code?: string }).code === "P2002";
      if (conflito && (await db.mensagem.findUnique({ where: { idExterno: m.idExterno }, select: { id: true } }))) return;
      if (conflito && tentativa === 1) continue; // cliente novo mandando 2 mensagens quase juntas
      if (erro instanceof ErroConversa) {
        await registrarLogWebhook("erro", `Mensagem do Instagram …${fim(m.igsid)} não processada: ${erro.message}`, false);
        return;
      }
      throw erro;
    }
  }
}

/** O cliente abriu a conversa no Instagram: a mensagem da loja vira "lida" (nunca volta de "lido"). */
async function aplicarLeitura(idExterno: string) {
  const atual = await db.mensagem.findUnique({ where: { idExterno } });
  if (!atual || atual.status === "lido" || atual.status === "falhou") return;
  const quando = await agora();
  await db.mensagem.update({ where: { id: atual.id }, data: { status: "lido", lidaEm: quando, entregueEm: atual.entregueEm ?? quando } });
  await marcarMudanca();
}

/** Lê e aplica um payload do Instagram. Lança em erro inesperado (quem chama decide se tenta de novo). */
export async function processarCorpoInstagram(payload: unknown): Promise<void> {
  const cfg = lerConfigInstagram();
  const eventos = extrairEventosInstagram(payload, cfg?.contaId);
  for (const l of eventos.leituras) await aplicarLeitura(l.idExterno);
  for (const m of eventos.mensagens) await aplicarMensagemInstagram(m, cfg);
}
