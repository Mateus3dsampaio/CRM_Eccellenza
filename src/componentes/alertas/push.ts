import { chamarApi } from "../dados";

// Avisos com o CRM fechado ou minimizado (Web Push). Funciona no Chrome e no Edge do Windows (instalado como app ou aberto no navegador).
// No iPhone só vale com o CRM instalado na tela de início (iOS 16.4 ou mais novo).

const chaveFlag = (usuarioId: string) => `crm-push-${usuarioId}`;

/** iPhone ou iPad (o iPad novo se apresenta como Mac, mas tem tela de toque). */
export function ehIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function pushSuportado(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function chaveParaBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const preenchido = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(preenchido);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/** Endereço do navegador no serviço de push, ou null se este navegador não está assinado. */
export async function enderecoDoPush(): Promise<string | null> {
  if (!pushSuportado()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
  } catch {
    return null;
  }
}

export async function pushLigadoNesteNavegador(usuarioId: string): Promise<boolean> {
  try {
    if (localStorage.getItem(chaveFlag(usuarioId)) !== "1") return false;
  } catch {
    return false;
  }
  const endpoint = await enderecoDoPush();
  if (!endpoint) return false;
  const r = await chamarApi<{ ativo: boolean }>(`/api/push?endpoint=${encodeURIComponent(endpoint)}`).catch(() => null);
  return !!r?.ativo;
}

/** Pede permissão (se precisar), assina o navegador e avisa o servidor. Lança com uma frase pronta para mostrar. */
export async function ativarPush(usuarioId: string): Promise<void> {
  if (!pushSuportado()) throw new Error("Este navegador não permite avisos com o CRM fechado.");
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission !== "granted")
    throw new Error(
      ehIphone()
        ? "As notificações estão bloqueadas. No iPhone, abra Ajustes > Notificações > Eccellenza e ligue \"Permitir Notificações\"."
        : "As notificações estão bloqueadas neste navegador. Clique no cadeado ao lado do endereço do site e permita.",
    );
  const { chavePublica } = await chamarApi<{ chavePublica: string }>("/api/push");
  const reg = await registro();
  const opcoes = { userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) };
  let assinatura: PushSubscription;
  try {
    assinatura = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe(opcoes));
    // Se o servidor trocou de chave, a assinatura antiga não vale mais: refaz.
    const chaveAtual = assinatura.options.applicationServerKey;
    if (chaveAtual && new Uint8Array(chaveAtual).join() !== opcoes.applicationServerKey.join()) {
      await assinatura.unsubscribe();
      assinatura = await reg.pushManager.subscribe(opcoes);
    }
  } catch {
    throw new Error("Não consegui ligar os avisos neste navegador. Tente de novo em instantes.");
  }
  await chamarApi("/api/push", { method: "POST", json: assinatura.toJSON() });
  try {
    localStorage.setItem(chaveFlag(usuarioId), "1");
  } catch {
    // Sem armazenamento: vale até fechar o navegador.
  }
}

/** Desliga neste navegador: avisa o servidor e cancela a assinatura. */
export async function desativarPush(usuarioId: string): Promise<void> {
  const endpoint = await enderecoDoPush();
  if (endpoint) await chamarApi("/api/push", { method: "DELETE", json: { endpoint } }).catch(() => undefined);
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
    localStorage.removeItem(chaveFlag(usuarioId));
  } catch {
    // Já estava desligado.
  }
}

/**
 * Ao sair do CRM, este navegador deixa de receber os avisos desta pessoa (outra pessoa pode usar o mesmo computador).
 * A assinatura do navegador continua; ao entrar de novo, quem tinha ligado volta a receber sem pedir nada.
 */
export async function pausarPushAoSair(): Promise<void> {
  const endpoint = await enderecoDoPush();
  if (endpoint) await chamarApi("/api/push", { method: "DELETE", json: { endpoint } }).catch(() => undefined);
}

/** Ao abrir o CRM: quem já tinha ligado neste navegador volta a ser assinado no servidor (cobre sair e entrar, ou o navegador ter trocado o endereço). */
export async function renovarPushSeLigado(usuarioId: string): Promise<void> {
  try {
    if (localStorage.getItem(chaveFlag(usuarioId)) !== "1" || !pushSuportado() || Notification.permission !== "granted") return;
    await ativarPush(usuarioId);
  } catch {
    // Silencioso: a pessoa vê o estado no sino.
  }
}
