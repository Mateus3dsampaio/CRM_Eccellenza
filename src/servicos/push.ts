import webpush from "web-push";
import { db } from "@/lib/db";
import { cifrarChave, decifrarChave } from "@/lib/cifra";
import { agora } from "@/lib/relogio";
import { textoDoAlerta, type TipoAlerta } from "@/regras/alertas";
import { montarAvisoPush, quemRecebePush, type AvisoPush, type DestinoPush } from "@/regras/push";
import { segredoDeCifra } from "./chaves-api";
import { gravarConfig, lerConfig } from "./configuracoes";

// Avisos com o CRM fechado ou minimizado (Web Push). Ligado por cada pessoa no sino; vale por navegador.
// O aviso (nome do cliente + trecho da mensagem) sai criptografado para o navegador de destino: o Google, a Microsoft e a Mozilla
// só repassam, não conseguem ler.

const CHAVE_PUBLICA = "push_vapid_publica";
const CHAVE_PRIVADA = "push_vapid_privada";
// Contato exigido pelo protocolo (VAPID). Quem lê é o serviço de push do navegador, nunca o cliente.
// A Apple (iPhone) recusa contato inválido ou de domínio local (".local", "localhost") com 403 BadJwtToken; o Google e a Microsoft aceitam.
// Por isso o padrão é o endereço público do CRM no Railway (variável que o próprio Railway cria).
const CONTATO_LOCAL = "mailto:contato@example.com";

/** Contato VAPID: PUSH_CONTATO (mailto: ou https:), senão o endereço público do Railway, senão um mailto válido (só no computador). */
export function contatoVapid(): string {
  const manual = process.env.PUSH_CONTATO?.trim();
  if (manual && /^(mailto:[^@\s]+@[^@\s]+\.[^@\s]+|https:\/\/\S+)$/.test(manual)) return manual;
  const dominio = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (dominio && !/(^|\.)localhost$|\.local$/.test(dominio)) return `https://${dominio}`;
  return CONTATO_LOCAL;
}

export interface ChavesVapid {
  publica: string;
  privada: string;
}

let gerando: Promise<ChavesVapid | null> | null = null;

/**
 * As chaves do servidor para o push. Se as variáveis VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY existem, valem elas; senão o sistema
 * cria um par na primeira vez e guarda no banco (a privada criptografada com a CHAVE_MESTRA). Sem como guardar com segurança: null.
 */
export async function chavesVapid(): Promise<ChavesVapid | null> {
  const publicaEnv = process.env.VAPID_PUBLIC_KEY?.trim();
  const privadaEnv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (publicaEnv && privadaEnv) return { publica: publicaEnv, privada: privadaEnv };
  if (!gerando) {
    gerando = (async () => {
      const segredo = await segredoDeCifra().catch(() => null);
      if (!segredo) return null;
      const publica = await lerConfig(CHAVE_PUBLICA);
      const guardada = await lerConfig(CHAVE_PRIVADA);
      const privada = publica && guardada ? decifrarChave(guardada, segredo) : null;
      if (publica && privada) return { publica, privada };
      // Nada guardado (ou a CHAVE_MESTRA mudou): cria um par novo. Quem já tinha ligado precisa ligar de novo.
      const par = webpush.generateVAPIDKeys();
      await gravarConfig(CHAVE_PUBLICA, par.publicKey);
      await gravarConfig(CHAVE_PRIVADA, cifrarChave(par.privateKey, segredo));
      return { publica: par.publicKey, privada: par.privateKey };
    })().finally(() => {
      gerando = null;
    });
  }
  return gerando;
}

export interface AssinaturaRecebida {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Guarda (ou passa para esta pessoa) o navegador que aceitou receber avisos. */
export async function assinarPush(usuarioId: string, sub: AssinaturaRecebida): Promise<void> {
  const dados = { usuarioId, p256dh: sub.keys.p256dh, auth: sub.keys.auth };
  await db.assinaturaPush.upsert({ where: { endpoint: sub.endpoint }, create: { ...dados, endpoint: sub.endpoint, criadoEm: await agora() }, update: dados });
}

/** Tira o navegador da lista. Só a própria pessoa (ou o navegador que ela já não usa) cancela; nunca dá para cancelar o de outra. */
export async function cancelarPush(usuarioId: string, endpoint: string): Promise<void> {
  await db.assinaturaPush.deleteMany({ where: { endpoint, usuarioId } });
}

export async function pushAtivo(usuarioId: string, endpoint: string): Promise<boolean> {
  return (await db.assinaturaPush.count({ where: { endpoint, usuarioId } })) > 0;
}

interface AlertaParaPush {
  id: number;
  tipo: string;
  leadId: string;
  leadNome: string;
  consultorId: string | null;
  consultorNome: string | null;
  texto: string | null;
  paraTodos?: boolean;
}

type AssinaturaComUsuario = { id: number; endpoint: string; p256dh: string; auth: string };

/** Manda um aviso para um navegador. Devolve true se o serviço de push aceitou. Navegador que morreu (404/410) sai da lista. */
async function enviarParaNavegador(a: AssinaturaComUsuario, aviso: AvisoPush, chaves: ChavesVapid): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify(aviso), {
      vapidDetails: { subject: contatoVapid(), publicKey: chaves.publica, privateKey: chaves.privada },
      TTL: 60 * 60, // aviso que não chegou em 1 hora já não serve
      urgency: "high",
      timeout: 10_000,
    });
    return true;
  } catch (erro) {
    const status = (erro as { statusCode?: number }).statusCode;
    // 404/410: o navegador cancelou ou o endereço morreu. Tira da lista para não tentar para sempre.
    if (status === 404 || status === 410) await db.assinaturaPush.deleteMany({ where: { id: a.id } });
    else {
      // Motivo dado pelo serviço de push (ex.: "BadJwtToken" da Apple). Nunca contém chave; o endereço do navegador não vai para o log.
      const motivo = String((erro as { body?: unknown }).body ?? "").replace(/\s+/g, " ").slice(0, 120);
      const servico = (() => {
        try {
          return new URL(a.endpoint).host;
        } catch {
          return "?";
        }
      })();
      console.error(`[push] não consegui avisar um navegador em ${servico} (HTTP ${status ?? "?"}) ${motivo}`);
    }
    return false;
  }
}

/** Manda o aviso para os navegadores de quem deve receber (o dono do lead e os admins). Nunca lança: aviso que falha não pode derrubar o resto. */
export async function enviarPushDoAlerta(alerta: AlertaParaPush): Promise<number> {
  try {
    const chaves = await chavesVapid();
    if (!chaves) return 0;
    const assinaturas = await db.assinaturaPush.findMany({ include: { usuario: { select: { id: true, perfil: true, ativo: true } } } });
    const destinos: DestinoPush[] = assinaturas.filter((a) => a.usuario.ativo).map((a) => ({ usuarioId: a.usuario.id, perfil: a.usuario.perfil }));
    const quem = new Set(quemRecebePush({ tipo: alerta.tipo as TipoAlerta, consultorId: alerta.consultorId, paraTodos: alerta.paraTodos }, destinos));
    let enviados = 0;
    for (const a of assinaturas) {
      if (!quem.has(a.usuario.id)) continue;
      if (await enviarParaNavegador(a, montarAvisoPush({ ...alerta, tipo: alerta.tipo as TipoAlerta }, a.usuario.id, textoDoAlerta), chaves)) enviados++;
    }
    return enviados;
  } catch {
    console.error("[push] falha ao enviar avisos");
    return 0;
  }
}

/** Aviso de teste para os navegadores desta pessoa (o botão "Testar" do sino). Sai depois de `atrasoMs`, para dar tempo de minimizar o CRM. */
export async function enviarPushDeTeste(usuarioId: string, atrasoMs = 5000): Promise<number> {
  const chaves = await chavesVapid();
  if (!chaves) return 0;
  const minhas = await db.assinaturaPush.findMany({ where: { usuarioId } });
  if (!minhas.length) return 0;
  const aviso: AvisoPush = { titulo: "Teste de aviso", corpo: "Se você está vendo este cartão, os avisos com o CRM minimizado estão funcionando.", tag: "teste-push", url: "/" };
  const enviar = () => void Promise.all(minhas.map((a) => enviarParaNavegador(a, aviso, chaves)));
  if (atrasoMs > 0) setTimeout(enviar, atrasoMs).unref?.();
  else enviar();
  return minhas.length;
}
