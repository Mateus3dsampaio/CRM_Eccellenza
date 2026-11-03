"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { TIPOS_CHAVE, ROTULOS_CHAVE, VARIAVEL_DA_CHAVE, type TipoChave } from "@/regras/chaves-api";
import type { SituacaoChaves } from "@/servicos/chaves-api";
import { chamarApi, useAviso, useDados } from "../dados";
import { Botao, classeEntrada } from "../ui";

const AJUDA: Record<TipoChave, string> = {
  texto: "Usada pelo bot para conversar com os clientes. Pegue em console.anthropic.com.",
  audio: "Usada para transformar áudio do cliente em texto. Pegue em platform.openai.com.",
};

/** Cartão "Chaves de API" (só admin). A chave aparece em pontinhos e nunca volta inteira do servidor. */
export function ChavesApi() {
  const { dados, recarregar } = useDados<SituacaoChaves>("/api/configuracoes/chaves");
  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <KeyRound className="size-4 text-texto-suave" aria-hidden /> Chaves de API
      </h2>
      <p className="mb-3 text-sm text-texto-suave">
        Cole a chave e salve. Ela fica guardada criptografada e só os 4 últimos caracteres aparecem aqui. Se usar a mesma conta para os dois (por exemplo, OpenAI), cole a mesma chave nos dois campos.
      </p>
      {dados && !dados.podeSalvar && (
        <p className="mb-3 rounded-controle bg-aviso-suave px-3 py-2 text-sm text-aviso">
          Para salvar chaves por aqui, defina a variável <code>CHAVE_MESTRA</code> no Railway (um texto longo e secreto) e reinicie. Enquanto isso, valem as variáveis de ambiente.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {TIPOS_CHAVE.map((tipo) => (
          <CampoChave key={tipo} tipo={tipo} situacao={dados?.chaves[tipo]} podeSalvar={dados?.podeSalvar ?? false} aoMudar={recarregar} />
        ))}
      </div>
    </section>
  );
}

function CampoChave({ tipo, situacao, podeSalvar, aoMudar }: { tipo: TipoChave; situacao?: SituacaoChaves["chaves"][TipoChave]; podeSalvar: boolean; aoMudar: () => void }) {
  const avisar = useAviso();
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function executar(metodo: "PUT" | "DELETE", mensagem: string) {
    setSalvando(true);
    try {
      await chamarApi("/api/configuracoes/chaves", { method: metodo, json: metodo === "PUT" ? { tipo, chave: valor } : { tipo } });
      setValor("");
      avisar(mensagem);
      aoMudar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível salvar.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-controle bg-superficie-suave p-3">
      <label htmlFor={`chave-${tipo}`} className="text-sm font-semibold">
        {ROTULOS_CHAVE[tipo]}
      </label>
      <p className="mt-0.5 text-xs text-texto-suave">{AJUDA[tipo]}</p>
      <p className="mt-2 text-xs" aria-live="polite">
        {!situacao ? (
          "Carregando…"
        ) : situacao.configurada ? (
          <span className="text-sucesso">
            Configurada ••••{situacao.final} ({situacao.origem === "tela" ? "salva aqui" : `variável ${VARIAVEL_DA_CHAVE[tipo]}`})
          </span>
        ) : (
          <span className="text-aviso">Não configurada</span>
        )}
        {situacao?.ilegivel && <span className="ml-1 text-perigo">A chave salva aqui não pôde ser aberta (CHAVE_MESTRA mudou). Cole de novo.</span>}
      </p>
      <input
        id={`chave-${tipo}`}
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={situacao?.configurada ? "Cole uma nova chave para trocar" : "Cole a chave aqui"}
        className={`${classeEntrada} mt-2 w-full`}
      />
      <div className="mt-2 flex gap-2">
        <Botao onClick={() => executar("PUT", "Chave salva.")} disabled={salvando || !valor.trim() || !podeSalvar}>
          Salvar
        </Botao>
        {situacao?.origem === "tela" && (
          <Botao variante="secundario" onClick={() => executar("DELETE", "Chave removida.")} disabled={salvando}>
            Remover
          </Botao>
        )}
      </div>
    </div>
  );
}
