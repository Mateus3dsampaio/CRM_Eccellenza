"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { lerPreferencias, textoDoAlerta, tituloDaAba, type AlertaTela, type PreferenciasAlertas } from "@/regras/alertas";
import { chamarApi, useAviso, useVersao } from "../dados";
import { useAguardando } from "../espera";
import { useUsuario } from "../usuario";
import { liberarSom, tocarSom } from "./som";

export type PermissaoNotificacao = NotificationPermission | "indisponivel";

interface ContextoAlertas {
  preferencias: PreferenciasAlertas;
  permissao: PermissaoNotificacao;
  definirSom: (ligado: boolean) => void;
  definirNotificacoes: (ligado: boolean) => void;
  pedirPermissao: () => Promise<void>;
  testar: () => void;
}

const Contexto = createContext<ContextoAlertas | null>(null);
export function useAlertas(): ContextoAlertas {
  const c = useContext(Contexto);
  if (!c) throw new Error("Avisos fora do provedor.");
  return c;
}

const MAXIMO_NOTIFICACOES = 4;

function lerPermissao(): PermissaoNotificacao {
  return typeof Notification === "undefined" ? "indisponivel" : Notification.permission;
}

/**
 * Som, notificação do navegador e número na aba (ESP-01 a ESP-04).
 * Busca os avisos novos sempre que a versão dos dados muda. Só funciona com o CRM aberto numa aba do navegador.
 */
export function ProvedorAlertas({ children }: { children: ReactNode }) {
  const usuario = useUsuario();
  const router = useRouter();
  const caminho = usePathname();
  const avisarNaTela = useAviso();
  const { versao } = useVersao();
  const { leads } = useAguardando();
  const chavePreferencias = `crm-alertas-${usuario.id}`;

  const [preferencias, setPreferencias] = useState<PreferenciasAlertas>({ som: true, notificacoes: true });
  const [permissao, setPermissao] = useState<PermissaoNotificacao>("indisponivel");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- lê o que o navegador guardou, só depois de abrir a tela */
    try {
      setPreferencias(lerPreferencias(localStorage.getItem(chavePreferencias)));
    } catch {
      // Sem armazenamento (janela privada etc.): vale o padrão.
    }
    setPermissao(lerPermissao());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [chavePreferencias]);

  const gravar = useCallback(
    (novas: PreferenciasAlertas) => {
      setPreferencias(novas);
      try {
        localStorage.setItem(chavePreferencias, JSON.stringify(novas));
      } catch {
        // Continua valendo até fechar a aba.
      }
    },
    [chavePreferencias],
  );

  // Valores mais novos para o código que roda fora do ciclo da tela.
  const vivo = useRef({ preferencias, caminho, permissao });
  useEffect(() => {
    vivo.current = { preferencias, caminho, permissao };
  });

  // O navegador só deixa tocar som depois de uma interação: prepara na primeira.
  useEffect(() => {
    const liberar = () => liberarSom();
    window.addEventListener("pointerdown", liberar, { once: true });
    window.addEventListener("keydown", liberar, { once: true });
    return () => {
      window.removeEventListener("pointerdown", liberar);
      window.removeEventListener("keydown", liberar);
    };
  }, []);

  const mostrar = useCallback(
    (a: AlertaTela, naTela: boolean) => {
      const { titulo, corpo } = textoDoAlerta(a, usuario.id);
      if (naTela) {
        avisarNaTela(corpo ? `${titulo}: ${corpo}` : titulo);
        return;
      }
      const atual = vivo.current;
      if (!atual.preferencias.notificacoes || lerPermissao() !== "granted") return;
      try {
        const n = new Notification(titulo, { body: corpo, tag: `alerta-${a.id}`, silent: true });
        n.onclick = () => {
          window.focus();
          router.push(`/lead/${a.leadId}`);
          n.close();
        };
      } catch {
        // Alguns navegadores só aceitam notificação por service worker: sem aviso do sistema, o som e a aba continuam.
      }
    },
    [avisarNaTela, router, usuario.id],
  );

  const tratar = useCallback(
    (novos: AlertaTela[]) => {
      const atual = vivo.current;
      // Olhando a tela agora? Então o aviso aparece dentro do CRM; senão vai para o sistema (Windows).
      const olhando = document.visibilityState === "visible" && document.hasFocus();
      // Quem já está com a conversa daquele lead aberta não precisa de aviso dele.
      const relevantes = novos.filter((a) => !(olhando && atual.caminho === `/lead/${a.leadId}`));
      if (!relevantes.length) return;
      if (atual.preferencias.som && relevantes.some((a) => a.tipo === "mensagem")) tocarSom();
      relevantes.slice(0, MAXIMO_NOTIFICACOES).forEach((a) => mostrar(a, olhando));
      const sobra = relevantes.length - MAXIMO_NOTIFICACOES;
      if (sobra > 0 && olhando) avisarNaTela(`E mais ${sobra} ${sobra === 1 ? "aviso" : "avisos"}.`);
    },
    [mostrar, avisarNaTela],
  );

  // Busca os avisos novos quando a versão dos dados muda. A primeira busca só marca o ponto de partida.
  const cursor = useRef<number | null>(null);
  const buscando = useRef(false);
  const repetir = useRef(false);
  useEffect(() => {
    let ativo = true;
    async function buscar() {
      if (buscando.current) {
        repetir.current = true;
        return;
      }
      buscando.current = true;
      try {
        do {
          repetir.current = false;
          const primeira = cursor.current === null;
          const r = await chamarApi<{ eventos: AlertaTela[]; ultimoId: number }>(primeira ? "/api/alertas" : `/api/alertas?depois=${cursor.current}`);
          cursor.current = r.ultimoId;
          if (ativo && !primeira && r.eventos.length) tratar(r.eventos);
        } while (repetir.current && ativo);
      } catch {
        // Sem conexão: tenta de novo na próxima mudança.
      } finally {
        buscando.current = false;
      }
    }
    void buscar();
    return () => {
      ativo = false;
    };
  }, [versao, tratar]);

  // Número de leads esperando na aba: "(3) CRM Eccellenza". O Next troca o título ao navegar, então reaplica quando ele mudar.
  const esperando = leads.length;
  useEffect(() => {
    const aplicar = () => {
      const novo = tituloDaAba(document.title, esperando);
      if (document.title !== novo) document.title = novo;
    };
    aplicar();
    const observador = new MutationObserver(aplicar);
    observador.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observador.disconnect();
  }, [esperando]);

  const pedirPermissao = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    try {
      setPermissao(await Notification.requestPermission());
    } catch {
      setPermissao(lerPermissao());
    }
  }, []);

  const valor = useMemo<ContextoAlertas>(
    () => ({
      preferencias,
      permissao,
      definirSom: (som) => gravar({ ...preferencias, som }),
      definirNotificacoes: (notificacoes) => gravar({ ...preferencias, notificacoes }),
      pedirPermissao,
      testar: () => {
        liberarSom();
        if (preferencias.som) tocarSom();
        if (preferencias.notificacoes && lerPermissao() === "granted") {
          try {
            new Notification("Teste de aviso", { body: "Se você viu isto, as notificações estão funcionando.", silent: true });
          } catch {
            // Sem notificação do sistema neste navegador.
          }
        }
        avisarNaTela("Teste de aviso: o som toca e a notificação aparece mesmo com outra aba na frente.");
      },
    }),
    [preferencias, permissao, gravar, pedirPermissao, avisarNaTela],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
