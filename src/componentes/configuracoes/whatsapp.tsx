"use client";

import { MessageCircle } from "lucide-react";
import { formatarDataHora } from "@/regras/tempo";
import { useDados } from "../dados";
import { juntar } from "../estilos";

interface Situacao {
  configurado: boolean;
  simulador: boolean;
  faltando: string[];
  logs: { id: number; quando: string; tipo: string; resumo: string; ok: boolean }[];
}

/** Situação do WhatsApp (só admin): modo, o que falta preencher e o que a Meta mandou por último. */
export function WhatsappConfig() {
  const { dados } = useDados<Situacao>("/api/configuracoes/whatsapp");
  const endereco = typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "/api/whatsapp/webhook";
  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 luz-marca-fio">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <MessageCircle className="size-4 text-texto-suave" aria-hidden /> WhatsApp
      </h2>
      {!dados ? (
        <p className="text-sm text-texto-suave">Carregando…</p>
      ) : (
        <>
          <p className={juntar("mb-3 rounded-controle px-3 py-2 text-sm", dados.configurado ? "bg-sucesso-suave text-sucesso" : "bg-aviso-suave text-aviso")}>
            {dados.configurado && dados.simulador
              ? "As chaves da Meta estão preenchidas, mas o modo simulador está ligado: nada sai pelo WhatsApp de verdade. (Em produção, apague a variável MODO_SIMULADOR.)"
              : dados.configurado
              ? "WhatsApp real ligado: as mensagens saem e chegam pela Meta."
              : dados.simulador
                ? "Modo simulado: nenhuma mensagem real sai. Para ligar o WhatsApp real, preencha as variáveis abaixo no servidor."
                : "WhatsApp real ainda não configurado: as mensagens NÃO estão sendo enviadas. Preencha as variáveis abaixo no servidor."}
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
          <p className="mb-3 break-all rounded-controle bg-superficie-suave px-3 py-2 font-mono text-xs">{endereco}</p>
          <p className="mb-1 text-sm font-medium">Últimos avisos da Meta</p>
          {dados.logs.length === 0 ? (
            <p className="text-sm text-texto-fraco">Nada recebido ainda.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-borda overflow-y-auto text-xs">
              {dados.logs.map((l) => (
                <li key={l.id} className="flex gap-2 py-1.5">
                  <span className="shrink-0 text-texto-fraco">{formatarDataHora(new Date(l.quando))}</span>
                  <span className={juntar("min-w-0 break-words", !l.ok && "text-alerta")}>{l.resumo}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
