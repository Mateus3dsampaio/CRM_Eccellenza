import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// Roda o public/sw.js numa "casca" de service worker falsa para conferir o que ele faz ao receber um aviso e ao clicar nele.
const codigo = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

interface Janela {
  url: string;
  visibilityState: string;
  focused: boolean;
  focus: () => Promise<void>;
  navigate?: (u: string) => Promise<void>;
}

function montar(janelas: Janela[], userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130") {
  const ouvintes: Record<string, (e: unknown) => void> = {};
  const mostradas: { titulo: string; opcoes: Record<string, unknown> }[] = [];
  const abertas: string[] = [];
  const self = {
    location: { origin: "https://crm.exemplo.com" },
    navigator: { userAgent },
    addEventListener: (nome: string, fn: (e: unknown) => void) => (ouvintes[nome] = fn),
    skipWaiting: () => undefined,
    clients: { claim: () => Promise.resolve(), matchAll: async () => janelas, openWindow: async (u: string) => void abertas.push(u) },
    registration: { showNotification: async (titulo: string, opcoes: Record<string, unknown>) => void mostradas.push({ titulo, opcoes }) },
  };
  vm.runInNewContext(codigo, { self, URL });
  const esperar = async (nome: string, evento: Record<string, unknown>) => {
    const promessas: Promise<unknown>[] = [];
    ouvintes[nome]({ ...evento, waitUntil: (p: Promise<unknown>) => promessas.push(p) });
    await Promise.all(promessas);
  };
  return { mostradas, abertas, esperar };
}

const aviso = { titulo: "Ana Souza", corpo: "Oi, quero uma cozinha", tag: "alerta-3", url: "/lead/L1" };
const dados = (o: object) => ({ data: { json: () => o } });

describe("service worker dos avisos", () => {
  it("com o CRM fechado ou minimizado mostra o cartão: nome, trecho, marca e ícone", async () => {
    const sw = montar([{ url: "https://crm.exemplo.com/", visibilityState: "hidden", focused: false, focus: async () => undefined }]);
    await sw.esperar("push", dados(aviso));
    expect(sw.mostradas).toHaveLength(1);
    expect(sw.mostradas[0].titulo).toBe("Ana Souza");
    expect(sw.mostradas[0].opcoes).toMatchObject({ body: "Oi, quero uma cozinha", tag: "alerta-3", icon: "/icone-192.png", data: { url: "/lead/L1" } });
  });

  it("com o CRM na frente (visível e com foco) não mostra: o aviso aparece dentro do CRM", async () => {
    const sw = montar([{ url: "https://crm.exemplo.com/", visibilityState: "visible", focused: true, focus: async () => undefined }]);
    await sw.esperar("push", dados(aviso));
    expect(sw.mostradas).toHaveLength(0);
  });

  it("no iPhone mostra o cartão mesmo com o CRM na frente (a Apple corta os avisos que não viram cartão)", async () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
    const sw = montar([{ url: "https://crm.exemplo.com/", visibilityState: "visible", focused: true, focus: async () => undefined }], iphone);
    await sw.esperar("push", dados(aviso));
    expect(sw.mostradas).toHaveLength(1);
  });

  it("aviso sem dados legíveis ainda mostra um cartão genérico (o navegador exige cartão a cada push)", async () => {
    const sw = montar([]);
    await sw.esperar("push", { data: { json: () => { throw new Error("lixo"); } } });
    expect(sw.mostradas[0].titulo).toBe("Eccellenza");
  });

  it("clicar leva à conversa: usa a janela aberta ou abre uma nova", async () => {
    let foco = 0;
    const navegou: string[] = [];
    const comJanela = montar([{ url: "https://crm.exemplo.com/kanban", visibilityState: "hidden", focused: false, focus: async () => void foco++, navigate: async (u) => void navegou.push(u) }]);
    const fechou: string[] = [];
    await comJanela.esperar("notificationclick", { notification: { close: () => fechou.push("x"), data: { url: "/lead/L1" } } });
    expect(fechou).toHaveLength(1);
    expect(foco).toBe(1);
    expect(navegou).toEqual(["https://crm.exemplo.com/lead/L1"]);

    const semJanela = montar([]);
    await semJanela.esperar("notificationclick", { notification: { close: () => undefined, data: { url: "/lead/L1" } } });
    expect(semJanela.abertas).toEqual(["https://crm.exemplo.com/lead/L1"]);
  });
});
