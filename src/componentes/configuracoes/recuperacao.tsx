"use client";

import { MessageCircleReply } from "lucide-react";
import { useState } from "react";
import { TEXTO_PRIMEIRA_PADRAO, TEXTO_SEGUNDA_PADRAO, type RegrasRecuperacao } from "@/regras/recuperacao";
import { juntar } from "../estilos";
import { classeEntrada } from "../ui";
import { useBlocoSalvavel } from "./barra-salvar";

/**
 * Configurações > Recuperação de leads. Cliente que abre a conversa e some recebe até 2 mensagens de texto fixo (só
 * dentro da janela de 24h da Meta) e, depois, o lead vai para Perdido. Os números de fábrica são PROVISÓRIOS.
 */
export function RecuperacaoDeLeads({ regras, aoSalvar }: { regras: RegrasRecuperacao; aoSalvar: (r: RegrasRecuperacao) => Promise<void> }) {
  const [rascunho, setRascunho] = useState<RegrasRecuperacao>(regras);
  const [salvando, setSalvando] = useState(false);
  const mudou = JSON.stringify(rascunho) !== JSON.stringify(regras);

  async function salvar() {
    setSalvando(true);
    try {
      await aoSalvar(rascunho);
    } finally {
      setSalvando(false);
    }
  }
  useBlocoSalvavel("recuperacao", { mudou, salvar, descartar: () => setRascunho(regras) });

  const desligado = !rascunho.ligado;
  const numero = (campo: "primeiraMin" | "segundaHoras" | "horarioInicio" | "horarioFim" | "perdidoHoras", rotulo: string, min: number, max: number) => (
    <input type="number" inputMode="numeric" min={min} max={max} disabled={desligado} aria-label={rotulo} value={rascunho[campo]} onChange={(e) => setRascunho((r) => ({ ...r, [campo]: Number(e.target.value) }))} className={juntar(classeEntrada, "w-24!")} />
  );

  return (
    <div className="space-y-4">
      <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <MessageCircleReply className="size-4 text-texto-suave" aria-hidden /> Recuperação de leads
        </h2>
        <p className="mb-3 text-sm text-texto-suave">
          Quando o cliente abre a conversa e para de responder, o sistema manda até 2 mensagens automáticas, só dentro da janela de 24h do WhatsApp, e depois move o lead para Perdido. Se o cliente responder, tudo que estava pendente é cancelado. Cada lead recebe isso uma vez só. Não vale para quem pediu PARAR, para lead já passado ao consultor, em Perdido ou Fechado.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={rascunho.ligado} onChange={(e) => setRascunho((r) => ({ ...r, ligado: e.target.checked }))} />
          Recuperação de leads ligada
        </label>
        {desligado && <p className="mt-2 text-xs text-texto-suave">Desligada: nenhuma mensagem sai e nenhum lead é movido por esta regra.</p>}
      </section>

      <section className={juntar("rounded-painel border border-borda bg-superficie p-5 shadow-painel", desligado && "opacity-60")}>
        <h3 className="mb-2 text-sm font-semibold">1ª mensagem</h3>
        <label className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span>Enviar após</span>
          {numero("primeiraMin", "Minutos até a 1ª mensagem", 1, 1380)}
          <span>min sem resposta (contados da nossa última mensagem)</span>
        </label>
        <textarea aria-label="Texto da 1ª mensagem" disabled={desligado} rows={3} maxLength={1000} value={rascunho.primeiraTexto} onChange={(e) => setRascunho((r) => ({ ...r, primeiraTexto: e.target.value }))} className={juntar(classeEntrada, "w-full")} />
        <button type="button" disabled={desligado} onClick={() => setRascunho((r) => ({ ...r, primeiraTexto: TEXTO_PRIMEIRA_PADRAO }))} className="mt-1 text-xs text-texto-suave underline disabled:opacity-50">
          Voltar ao texto original
        </button>

        <h3 className="mb-2 mt-5 text-sm font-semibold">2ª mensagem</h3>
        <div className="mb-3 space-y-2" role="radiogroup" aria-label="Quando enviar a 2ª mensagem">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input type="radio" name="segundaModo" disabled={desligado} checked={rascunho.segundaModo === "horas"} onChange={() => setRascunho((r) => ({ ...r, segundaModo: "horas" }))} />
            <span>Após</span>
            {numero("segundaHoras", "Horas até a 2ª mensagem", 1, 23)}
            <span>horas da 1ª mensagem</span>
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input type="radio" name="segundaModo" disabled={desligado} checked={rascunho.segundaModo === "dia_seguinte"} onChange={() => setRascunho((r) => ({ ...r, segundaModo: "dia_seguinte" }))} />
            <span>No dia seguinte às</span>
            <input type="time" disabled={desligado} aria-label="Horário da 2ª mensagem no dia seguinte" value={rascunho.segundaHora} onChange={(e) => setRascunho((r) => ({ ...r, segundaHora: e.target.value }))} className={juntar(classeEntrada, "w-32!")} />
          </label>
        </div>
        <textarea aria-label="Texto da 2ª mensagem" disabled={desligado} rows={3} maxLength={1000} value={rascunho.segundaTexto} onChange={(e) => setRascunho((r) => ({ ...r, segundaTexto: e.target.value }))} className={juntar(classeEntrada, "w-full")} />
        <button type="button" disabled={desligado} onClick={() => setRascunho((r) => ({ ...r, segundaTexto: TEXTO_SEGUNDA_PADRAO }))} className="mt-1 text-xs text-texto-suave underline disabled:opacity-50">
          Voltar ao texto original
        </button>
        <p className="mt-2 text-xs text-texto-fraco">
          Use <code>{"{nome}"}</code> onde entra o primeiro nome do cliente. Sem nome na ficha, &quot;Oi, {"{nome}"}!&quot; vira &quot;Oi!&quot;. Se o horário da 2ª mensagem cair depois do fim da janela de 24h, ela é antecipada para o fim do mesmo dia; se nem assim couber, não é enviada.
        </p>

        <h3 className="mb-2 mt-5 text-sm font-semibold">Horário permitido de envio</h3>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span>Das</span>
          {numero("horarioInicio", "Hora em que o envio começa", 0, 23)}
          <span>h às</span>
          {numero("horarioFim", "Hora em que o envio termina", 1, 24)}
          <span>h (horário de Fortaleza)</span>
        </label>
        <p className="mt-1 text-xs text-texto-fraco">Fora desse horário a mensagem espera o próximo horário permitido, desde que ainda esteja dentro da janela de 24h.</p>

        <h3 className="mb-2 mt-5 text-sm font-semibold">Mover para Perdido</h3>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span>Mover para Perdido após</span>
          {numero("perdidoHoras", "Horas da 2ª mensagem até Perdido", 1, 72)}
          <span>horas da 2ª mensagem, sem resposta (motivo &quot;Sem resposta (automático)&quot;)</span>
        </label>
        <p className="mt-1 text-xs text-texto-fraco">Conta em relógio corrido, sem respeitar o horário permitido. Só move se a 2ª mensagem foi realmente enviada. Se o cliente escrever depois, o card volta para a coluna em que estava.</p>
        {salvando && <p className="mt-3 text-xs text-texto-fraco">Salvando...</p>}
      </section>
    </div>
  );
}
