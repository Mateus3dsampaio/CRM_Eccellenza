"use client";

import { useState } from "react";
import { lerDataHoraLocal, NOTA_LEMBRETE_MAX, partirDataHoraLocal } from "@/regras/vendas";
import type { FichaLead } from "@/servicos/consultas";
import { juntar } from "../estilos";
import { Botao, Campo, classeEntrada, Modal } from "../ui";

/**
 * Janela do lembrete (tarefa 22): data e hora para voltar a falar com o cliente, com nota opcional. Vale em qualquer etapa
 * aberta e aparece em "Retornos de hoje" no dia. Em Negociação é o próximo contato. Quem mostra o lembrete é o bloco
 * "Próximo passo" (`proximo-passo.tsx`); quem abre esta janela é `useAcoesDoLead`.
 */
export function JanelaLembrete({ ficha, obrigatorio, aoFechar, salvar }: { ficha: FichaLead; obrigatorio: boolean; aoFechar: () => void; salvar: (corpo: object, sucesso?: string) => Promise<boolean> }) {
  const inicio = partirDataHoraLocal(ficha.proximoContatoEm);
  const [data, setData] = useState(inicio.data);
  const [hora, setHora] = useState(inicio.hora || "09:00");
  const [nota, setNota] = useState(ficha.lembreteNota ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    const quando = lerDataHoraLocal(data, hora);
    if (!quando) return setErro("Preencha a data e a hora do lembrete.");
    setSalvando(true);
    const ok = await salvar({ venda: { proximoContatoEm: quando.toISOString(), lembreteNota: nota.trim() || null } }, "Lembrete salvo. Ele aparece em Retornos de hoje no dia.");
    setSalvando(false);
    if (ok) aoFechar();
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={ficha.proximoContatoEm ? "Editar lembrete" : "Novo lembrete"} largura="max-w-md">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void confirmar();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data">
            <input type="date" className={classeEntrada} value={data} onChange={(e) => setData(e.target.value)} required />
          </Campo>
          <Campo rotulo="Hora">
            <input type="time" className={classeEntrada} value={hora} onChange={(e) => setHora(e.target.value)} required />
          </Campo>
        </div>
        <Campo rotulo="Nota (opcional)" dica={obrigatorio ? "Em Negociação o próximo contato é obrigatório: dá para trocar a data, não apagar." : undefined}>
          <textarea className={juntar(classeEntrada, "h-20 resize-none py-2")} maxLength={NOTA_LEMBRETE_MAX} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: pediu para chamar depois do dia 15" />
        </Campo>
        {erro && (
          <p className="text-sm text-alerta" role="alert">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" carregando={salvando}>
            Salvar lembrete
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
