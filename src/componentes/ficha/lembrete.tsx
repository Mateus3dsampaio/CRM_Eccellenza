"use client";

import { useState } from "react";
import { BellRing, Check, Pencil, Plus } from "lucide-react";
import { formatarVisitaCurta } from "@/regras/tempo";
import { ETAPAS_COM_RETORNO, lerDataHoraLocal, NOTA_LEMBRETE_MAX, partirDataHoraLocal, situacaoDoRetorno } from "@/regras/vendas";
import type { FichaLead } from "@/servicos/consultas";
import { juntar } from "../estilos";
import { useAgoraDoServidor } from "../espera";
import { CLASSE_TEXTO_RETORNO } from "../retornos";
import { Botao, Campo, classeEntrada, Modal } from "../ui";
import { usePode } from "../usuario";
import { retornoObrigatorio, useRegrasVendas } from "../vendas/regras";

/**
 * Lembrete do lead (tarefa 22): data e hora para voltar a falar com o cliente (ex.: "pediu para chamar daqui a 30 dias"),
 * com nota opcional. Vale em qualquer etapa aberta e aparece em "Retornos de hoje" no dia. Em Negociação é o próximo contato.
 */
export function Lembrete({ ficha, salvar }: { ficha: FichaLead; salvar: (corpo: object, sucesso?: string) => Promise<boolean> }) {
  const podeEditar = usePode("editar_lead");
  const regras = useRegrasVendas();
  const agora = useAgoraDoServidor();
  const [editando, setEditando] = useState(false);
  if (!(ETAPAS_COM_RETORNO as string[]).includes(ficha.etapa)) return null;
  const obrigatorio = retornoObrigatorio(regras, ficha.etapa);
  const situacao = situacaoDoRetorno(ficha.proximoContatoEm, agora);

  return (
    <div className="sm:col-span-2 rounded-controle bg-superficie-suave p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium">
          <BellRing className="size-4 text-texto-suave" aria-hidden />
          {ficha.etapa === "negociacao" ? "Próximo contato" : "Lembrete"}
        </p>
        {podeEditar && (
          <div className="flex gap-1">
            {ficha.proximoContatoEm && !obrigatorio && (
              <Botao variante="fantasma" icone={<Check className="size-4" aria-hidden />} onClick={() => void salvar({ venda: { proximoContatoEm: null } }, "Lembrete concluído.")}>
                Concluir
              </Botao>
            )}
            <Botao variante="fantasma" icone={ficha.proximoContatoEm ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />} onClick={() => setEditando(true)}>
              {ficha.proximoContatoEm ? "Editar" : "Adicionar lembrete"}
            </Botao>
          </div>
        )}
      </div>
      {ficha.proximoContatoEm ? (
        <div className="mt-1">
          <p className={juntar("text-sm font-medium", CLASSE_TEXTO_RETORNO[situacao])}>
            {formatarVisitaCurta(new Date(ficha.proximoContatoEm))}
            {situacao === "atrasado" && " · atrasado"}
            {situacao === "hoje" && " · hoje"}
          </p>
          {ficha.lembreteNota && <p className="mt-0.5 whitespace-pre-line text-sm text-texto-suave">{ficha.lembreteNota}</p>}
        </div>
      ) : (
        <p className="mt-1 text-sm text-texto-suave">{obrigatorio ? "Defina o próximo contato." : "Nenhum lembrete. Use para o cliente que pediu contato mais para frente: ele aparece em Retornos de hoje no dia."}</p>
      )}
      {editando && <JanelaLembrete ficha={ficha} obrigatorio={obrigatorio} aoFechar={() => setEditando(false)} salvar={salvar} />}
    </div>
  );
}

function JanelaLembrete({ ficha, obrigatorio, aoFechar, salvar }: { ficha: FichaLead; obrigatorio: boolean; aoFechar: () => void; salvar: (corpo: object, sucesso?: string) => Promise<boolean> }) {
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
