"use client";

import { useDados } from "../dados";
import { juntar } from "../estilos";
import { IconeInstagram } from "../icone-canal";

interface Situacao {
  configurado: boolean;
  simulador: boolean;
  faltando: string[];
}

/** Situação do Instagram (só admin): modo e o que falta preencher. Os avisos da Meta aparecem junto com os do WhatsApp. */
export function InstagramConfig() {
  const { dados } = useDados<Situacao>("/api/configuracoes/instagram");
  const endereco = typeof window !== "undefined" ? `${window.location.origin}/api/instagram/webhook` : "/api/instagram/webhook";
  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 luz-marca-fio">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <IconeInstagram className="size-4 text-texto-suave" /> Instagram
      </h2>
      {!dados ? (
        <p className="text-sm text-texto-suave">Carregando…</p>
      ) : (
        <>
          <p className={juntar("mb-3 rounded-controle px-3 py-2 text-sm", dados.configurado && !dados.simulador ? "bg-sucesso-suave text-sucesso" : "bg-aviso-suave text-aviso")}>
            {dados.configurado && dados.simulador
              ? "As chaves estão preenchidas, mas o modo simulador está ligado: nada sai pelo Instagram de verdade."
              : dados.configurado
                ? "Instagram real ligado: as mensagens diretas chegam e saem pela Meta. Só dá para responder dentro das 24h depois da mensagem do cliente."
                : "Instagram ainda não configurado: mensagens diretas não chegam ao CRM. Preencha as variáveis abaixo no servidor."}
          </p>
          {dados.faltando.length > 0 && (
            <div className="mb-3 text-sm">
              <p className="mb-1 text-texto-suave">Variáveis que faltam (nome apenas; o valor você cola no Railway):</p>
              <ul className="flex flex-wrap gap-2">
                {dados.faltando.map((v) => (
                  <li key={v} className="rounded-pilula bg-superficie-suave px-2.5 py-1 font-mono text-xs">
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mb-1 text-sm text-texto-suave">Endereço do webhook para cadastrar na Meta:</p>
          <p className="break-all rounded-controle bg-superficie-suave px-3 py-2 font-mono text-xs">{endereco}</p>
        </>
      )}
    </section>
  );
}
