"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { TIPOS_CHAVE, ROTULOS_CHAVE, VARIAVEL_DA_CHAVE, type TipoChave } from "@/regras/chaves-api";
import type { SituacaoChaves } from "@/servicos/chaves-api";
import type { ConfigDoBot, ProvedorBot } from "@/servicos/provedor-bot";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Botao, classeEntrada } from "../ui";

const AJUDA: Record<TipoChave, string> = {
  texto: "Usada pelo bot para conversar com os clientes. Pegue em console.anthropic.com.",
  audio: "Usada para transformar áudio do cliente em texto. Pegue em platform.openai.com.",
};

/** Cartão "Chaves de API" (só admin). A chave aparece em pontinhos e nunca volta inteira do servidor. */
export function ChavesApi() {
  const { dados, recarregar } = useDados<SituacaoChaves>("/api/configuracoes/chaves");
  const { dados: bot, recarregar: recarregarBot } = useDados<ConfigDoBot>("/api/configuracoes/provedor-bot");
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
      {bot && <EscolhaDaIa bot={bot} aoMudar={recarregarBot} />}
      <div className="grid gap-4 md:grid-cols-2">
        {TIPOS_CHAVE.map((tipo) => (
          <CampoChave key={tipo} tipo={tipo} situacao={dados?.chaves[tipo]} podeSalvar={dados?.podeSalvar ?? false} aoMudar={recarregar} textoConfigurado={!!dados?.chaves.texto.configurada} />
        ))}
      </div>
    </section>
  );
}

function CampoChave({ tipo, situacao, podeSalvar, aoMudar, textoConfigurado }: { tipo: TipoChave; textoConfigurado: boolean; situacao?: SituacaoChaves["chaves"][TipoChave]; podeSalvar: boolean; aoMudar: () => void }) {
  const avisar = useAviso();
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function executar(metodo: "PUT" | "DELETE" | "POST", mensagem: string) {
    setSalvando(true);
    try {
      const json = metodo === "PUT" ? { tipo, chave: valor } : metodo === "POST" ? { de: "texto", para: tipo } : { tipo };
      await chamarApi("/api/configuracoes/chaves", { method: metodo, json });
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
        {tipo === "audio" && textoConfigurado && (
          <Botao variante="secundario" onClick={() => executar("POST", "Chave do texto copiada para o áudio.")} disabled={salvando || !podeSalvar}>
            Usar a mesma do texto
          </Botao>
        )}
        {situacao?.origem === "tela" && (
          <Botao variante="secundario" onClick={() => executar("DELETE", "Chave removida.")} disabled={salvando}>
            Remover
          </Botao>
        )}
      </div>
    </div>
  );
}

const NOMES_IA: Record<ProvedorBot, string> = { claude: "Claude (Anthropic)", openai: "GPT (OpenAI)" };

/** Qual IA atende o texto. Trocar vale na próxima mensagem; conversas em andamento continuam de onde estavam. */
function EscolhaDaIa({ bot, aoMudar }: { bot: ConfigDoBot; aoMudar: () => void }) {
  const avisar = useAviso();
  const [modelo, setModelo] = useState(bot.modeloOpenai);

  async function salvar(provedor: ProvedorBot) {
    try {
      await chamarApi("/api/configuracoes/provedor-bot", { method: "PUT", json: { provedor, modeloOpenai: modelo } });
      avisar(`Atendimento por texto: ${NOMES_IA[provedor]}.`);
      aoMudar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível salvar.", "erro");
    }
  }

  return (
    <div className="mb-4 rounded-controle bg-superficie-suave p-3">
      <p className="text-sm font-semibold">Qual IA atende o texto</p>
      <div role="radiogroup" aria-label="IA do atendimento por texto" className="mt-2 flex flex-wrap gap-2">
        {(["claude", "openai"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={bot.provedor === p}
            onClick={() => bot.provedor !== p && salvar(p)}
            className={juntar("rounded-controle border px-3 py-2 text-sm transition", bot.provedor === p ? "border-marca bg-marca-suave text-marca-texto" : "border-borda hover:border-borda-forte")}
          >
            {NOMES_IA[p]}
          </button>
        ))}
      </div>
      <label htmlFor="modelo-openai" className="mt-3 block text-xs text-texto-suave">
        Modelo do GPT (provisório, ainda não testado com o bot real; confira o nome no painel da OpenAI)
      </label>
      <div className="mt-1 flex gap-2">
        <input id="modelo-openai" value={modelo} onChange={(e) => setModelo(e.target.value)} className={`${classeEntrada} w-64`} spellCheck={false} />
        <Botao onClick={() => salvar(bot.provedor)} disabled={modelo.trim() === bot.modeloOpenai}>
          Salvar modelo
        </Botao>
      </div>
      {bot.provedor === "openai" && (
        <p className="mt-2 text-xs text-aviso">Com o GPT, as conversas dos clientes passam a ser enviadas à OpenAI (fora do Brasil). Atualize e aprove a política de privacidade antes de usar com clientes reais.</p>
      )}
    </div>
  );
}
