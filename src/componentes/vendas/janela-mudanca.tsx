"use client";

import CurrencyInput from "react-currency-input-field";
import { useState } from "react";
import { type CodigoEtapa } from "@/regras/etapas";
import { useNomesEtapas } from "../etapas";
import { faltaParaMover, lerDataHoraLocal, partirDataHoraLocal } from "@/regras/vendas";
import { regrasParaConferir, retornoObrigatorio, useRegrasVendas } from "./regras";
import { Botao, Campo, classeEntrada, Modal } from "../ui";

/** Dados de venda como a API recebe (data em ISO, dinheiro em centavos). */
export interface VendaParaApi {
  proximoContatoEm?: string;
  valorOrcamento?: number | null;
  valorFechado?: number;
  motivoPerda?: string;
  concorrente?: string;
}

export interface ValoresAtuais {
  proximoContatoEm?: string | null;
  valorOrcamento?: number | null;
  valorFechado?: number | null;
  motivoPerda?: string | null;
  concorrente?: string | null;
}

/** Campo de dinheiro (R$ 1.621,00). Trabalha em centavos. */
export function CampoDinheiro({ valor, aoMudar, placeholder = "R$ 0,00" }: { valor: number | null; aoMudar: (centavos: number | null) => void; placeholder?: string }) {
  return (
    <CurrencyInput
      className={classeEntrada}
      prefix="R$ "
      groupSeparator="."
      decimalSeparator=","
      decimalScale={2}
      decimalsLimit={2}
      allowNegativeValue={false}
      inputMode="decimal"
      placeholder={placeholder}
      defaultValue={valor === null ? undefined : valor / 100}
      onValueChange={(_v, _n, valores) => aoMudar(valores?.float == null ? null : Math.round(valores.float * 100))}
    />
  );
}

/** Janela que pede o que a etapa exige (próximo contato, valor fechado, motivo da perda). Cancelar não move nada. */
export function JanelaMudanca({
  etapa,
  quantidade = 1,
  atuais = {},
  aoConfirmar,
  aoCancelar,
}: {
  etapa: CodigoEtapa;
  quantidade?: number;
  atuais?: ValoresAtuais;
  aoConfirmar: (venda: VendaParaApi) => void;
  aoCancelar: () => void;
}) {
  const nomesEtapas = useNomesEtapas();
  const inicio = partirDataHoraLocal(atuais.proximoContatoEm);
  const [data, setData] = useState(inicio.data);
  const [hora, setHora] = useState(inicio.hora);
  const [valorOrcamento, setValorOrcamento] = useState<number | null>(atuais.valorOrcamento ?? null);
  const [valorFechado, setValorFechado] = useState<number | null>(atuais.valorFechado ?? null);
  const [motivo, setMotivo] = useState(atuais.motivoPerda ?? "");
  const [concorrente, setConcorrente] = useState(atuais.concorrente ?? "");
  const [erro, setErro] = useState("");

  const regras = useRegrasVendas();
  // Só Negociação pede o próximo contato ao mover; nas outras etapas o lembrete é anotado na ficha (tarefa 22).
  const comRetorno = etapa === "negociacao";
  // Valor do orçamento só faz sentido depois da apresentação (Negociação); em qualificação ainda não há orçamento.
  const comValor = etapa === "negociacao";
  const retornoExigido = retornoObrigatorio(regras, etapa);
  // Motivos que dá para escolher agora (o que o lead já tem continua na lista, mesmo desativado).
  const motivosDisponiveis = regras.motivos.filter((m) => m.ativo || m.codigo === atuais.motivoPerda);
  const perguntaDoMotivo = motivosDisponiveis.find((m) => m.codigo === motivo)?.pergunta ?? null;

  function confirmar() {
    const quando = lerDataHoraLocal(data, hora);
    // Retorno opcional (Negociação com o interruptor desligado): pode ficar vazio, mas não pela metade.
    if (comRetorno && !retornoExigido && (data || hora) && !quando) return setErro("Preencha a data e a hora do próximo contato, ou deixe os dois em branco.");
    const falta = faltaParaMover(etapa, { proximoContatoEm: quando, valorFechado, motivoPerda: motivo, concorrente }, regrasParaConferir(regras, atuais.motivoPerda));
    if (falta) return setErro(falta);
    if (comRetorno) aoConfirmar({ ...(quando ? { proximoContatoEm: quando.toISOString() } : {}), ...(comValor && valorOrcamento ? { valorOrcamento } : {}) });
    else if (etapa === "fechado") aoConfirmar({ valorFechado: valorFechado as number });
    else aoConfirmar({ motivoPerda: motivo, ...(perguntaDoMotivo ? { concorrente: concorrente.trim() } : {}) });
  }

  return (
    <Modal aberto aoFechar={aoCancelar} titulo={`Mover para "${nomesEtapas.nome(etapa)}"`} largura="max-w-md">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          confirmar();
        }}
      >
        {quantidade > 1 && <p className="text-sm text-texto-suave">Vale para os {quantidade} leads selecionados.</p>}

        {comRetorno && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo={retornoExigido ? "Próximo contato em" : "Próximo contato em (opcional)"}>
                <input type="date" className={classeEntrada} value={data} onChange={(e) => setData(e.target.value)} required={retornoExigido} />
              </Campo>
              <Campo rotulo="Hora">
                <input type="time" className={classeEntrada} value={hora} onChange={(e) => setHora(e.target.value)} required={retornoExigido} />
              </Campo>
            </div>
            {comValor && (
              <Campo rotulo="Valor do orçamento (opcional)">
                <CampoDinheiro valor={valorOrcamento} aoMudar={setValorOrcamento} />
              </Campo>
            )}
          </>
        )}

        {etapa === "fechado" && (
          <Campo rotulo="Valor fechado">
            <CampoDinheiro valor={valorFechado} aoMudar={setValorFechado} />
          </Campo>
        )}

        {etapa === "perdido" && (
          <>
            <Campo rotulo="Motivo da perda">
              <select className={classeEntrada} value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
                <option value="">Escolha...</option>
                {motivosDisponiveis.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </Campo>
            {perguntaDoMotivo && (
              <Campo rotulo={perguntaDoMotivo}>
                <input className={classeEntrada} value={concorrente} maxLength={120} onChange={(e) => setConcorrente(e.target.value)} required />
              </Campo>
            )}
          </>
        )}

        {erro && (
          <p role="alert" className="text-sm text-alerta">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Botao type="button" variante="fantasma" onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario">
            Mover
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
