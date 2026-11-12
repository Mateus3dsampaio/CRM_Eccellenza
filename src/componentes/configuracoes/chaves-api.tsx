"use client";

import { AudioLines, KeyRound, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";
import { ROTULOS_CHAVE, VARIAVEL_DA_CHAVE, type TipoChave } from "@/regras/chaves-api";
import type { SituacaoChaves } from "@/servicos/chaves-api";
import type { ListaDeModelos } from "@/servicos/modelos-ia";
import type { ConfigDoBot, ProvedorBot } from "@/servicos/provedor-bot";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Botao, classeEntrada } from "../ui";

const NOMES_IA: Record<ProvedorBot, string> = { claude: "Claude (Anthropic)", openai: "GPT (OpenAI)" };
const CHAVE_DO_PROVEDOR: Record<ProvedorBot, TipoChave> = { claude: "anthropic", openai: "openai" };
const AJUDA: Record<TipoChave, string> = {
  anthropic: "Pegue em console.anthropic.com.",
  openai: "Pegue em platform.openai.com. A mesma chave serve para o GPT no texto e para a transcrição de áudio.",
};

/**
 * Configurações > Chaves de API (só admin): qual IA atende o texto e com qual modelo, e a transcrição de áudio (sempre OpenAI).
 * As chaves aparecem em pontinhos e nunca voltam inteiras do servidor.
 */
export function ChavesApi() {
  const { dados: chaves, recarregar: recarregarChaves } = useDados<SituacaoChaves>("/api/configuracoes/chaves");
  const { dados: bot, recarregar: recarregarBot } = useDados<ConfigDoBot>("/api/configuracoes/provedor-bot");

  return (
    <div className="grid gap-4">
      {chaves && !chaves.podeSalvar && (
        <p className="rounded-controle bg-aviso-suave px-3 py-2 text-sm text-aviso">
          Para salvar chaves por aqui, defina a variável <code>CHAVE_MESTRA</code> no Railway (um texto longo e secreto) e reinicie. Enquanto isso, valem as variáveis de ambiente.
        </p>
      )}

      <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <MessageSquareText className="size-4 text-texto-suave" aria-hidden /> Atendimento por texto
        </h2>
        <p className="mb-4 text-sm text-texto-suave">Qual IA conversa com os clientes. A troca vale a partir da próxima mensagem; conversas em andamento continuam de onde estavam.</p>
        {bot ? <EscolhaDaIa bot={bot} chaves={chaves} aoMudar={recarregarBot} aoMudarChave={recarregarChaves} /> : <p className="text-sm text-texto-suave">Carregando…</p>}
      </section>

      <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <AudioLines className="size-4 text-texto-suave" aria-hidden /> Transcrição de áudio
        </h2>
        <p className="mb-4 text-sm text-texto-suave">Transforma o áudio do cliente em texto para o bot ler. Sempre pela OpenAI. O áudio não fica guardado, só o texto.</p>
        <CampoChave tipo="openai" situacao={chaves?.chaves.openai} podeSalvar={chaves?.podeSalvar ?? false} aoMudar={recarregarChaves} />
      </section>
    </div>
  );
}

function EscolhaDaIa({ bot, chaves, aoMudar, aoMudarChave }: { bot: ConfigDoBot; chaves: SituacaoChaves | null; aoMudar: () => void; aoMudarChave: () => void }) {
  const avisar = useAviso();
  // A aba só mostra a lista da empresa; quem atende muda ao escolher um modelo.
  const [aba, setAba] = useState<ProvedorBot>(bot.provedor);
  const [salvando, setSalvando] = useState(false);
  const modeloEmUso = bot.provedor === "claude" ? bot.modeloClaude : bot.modeloOpenai;

  async function escolher(provedor: ProvedorBot, modelo: string) {
    setSalvando(true);
    try {
      await chamarApi("/api/configuracoes/provedor-bot", { method: "PUT", json: { provedor, ...(provedor === "claude" ? { modeloClaude: modelo } : { modeloOpenai: modelo }) } });
      avisar(`Atendimento por texto: ${NOMES_IA[provedor]}, modelo ${modelo}.`);
      aoMudar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível salvar.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm">
        Atendendo agora: <strong>{NOMES_IA[bot.provedor]}</strong> · <code className="text-xs text-texto-suave">{modeloEmUso}</code>
      </p>

      <div role="tablist" aria-label="Empresa da IA" className="flex flex-wrap gap-2">
        {(["claude", "openai"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            id={`aba-ia-${p}`}
            aria-selected={aba === p}
            aria-controls="lista-modelos"
            onClick={() => setAba(p)}
            className={juntar("rounded-controle border px-4 py-2 text-sm font-medium transition", aba === p ? "border-marca bg-marca-suave text-marca-texto" : "border-borda-forte text-texto-suave hover:text-texto")}
          >
            {NOMES_IA[p]}
          </button>
        ))}
      </div>

      <ListaModelos key={aba} provedor={aba} bot={bot} salvando={salvando} aoEscolher={(m) => escolher(aba, m)} />

      {aba === "openai" && (
        <p className="rounded-controle bg-aviso-suave px-3 py-2 text-xs text-aviso">Com o GPT, as conversas dos clientes passam a ser enviadas à OpenAI (fora do Brasil). Atualize e aprove a política de privacidade antes de usar com clientes reais.</p>
      )}

      <CampoChave tipo={CHAVE_DO_PROVEDOR[aba]} situacao={chaves?.chaves[CHAVE_DO_PROVEDOR[aba]]} podeSalvar={chaves?.podeSalvar ?? false} aoMudar={aoMudarChave} />
    </div>
  );
}

/** Lista buscada uma vez ao abrir a aba (não acompanha as atualizações automáticas da tela, para não chamar a empresa toda hora). */
function ListaModelos({ provedor, bot, salvando, aoEscolher }: { provedor: ProvedorBot; bot: ConfigDoBot; salvando: boolean; aoEscolher: (modelo: string) => void }) {
  const [lista, setLista] = useState<ListaDeModelos | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    chamarApi<ListaDeModelos>(`/api/configuracoes/modelos-ia?provedor=${provedor}`)
      .then((r) => vivo && setLista(r))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não consegui carregar a lista."));
    return () => {
      vivo = false;
    };
  }, [provedor]);

  const salvoAqui = provedor === "claude" ? bot.modeloClaude : bot.modeloOpenai;
  const emUso = bot.provedor === provedor ? salvoAqui : null;

  return (
    <div id="lista-modelos" role="tabpanel" aria-labelledby={`aba-ia-${provedor}`} className="grid gap-2">
      <p className="rotulo-secao">Modelo</p>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      {!lista && !erro && <p className="text-sm text-texto-suave">Buscando os modelos da sua conta…</p>}
      {lista && (
        <div role="radiogroup" aria-label={`Modelos ${NOMES_IA[provedor]}`} className="grid gap-2">
          {lista.modelos.map((m) => {
            const marcado = m.id === (emUso ?? "");
            return (
              <label
                key={m.id}
                className={juntar(
                  "grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-controle border px-3.5 py-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-marca-texto",
                  marcado ? "border-marca bg-marca-suave" : "border-borda bg-coluna hover:border-borda-forte",
                  salvando && "pointer-events-none opacity-60",
                )}
              >
                <input type="radio" name={`modelo-${provedor}`} checked={marcado} onChange={() => aoEscolher(m.id)} className="accent-marca" />
                <span className="min-w-0">
                  <span className="font-semibold">{m.nome}</span> {m.nome !== m.id && <code className="text-xs text-texto-fraco">{m.id}</code>}
                  <span className="mt-0.5 block text-xs text-texto-suave">{m.descricao}</span>
                </span>
                {marcado ? (
                  <span className="rounded-full bg-sucesso-suave px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-sucesso">Em uso</span>
                ) : m.id === salvoAqui && bot.provedor !== provedor ? (
                  <span className="rounded-full bg-superficie-suave px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-texto-suave">Escolhido</span>
                ) : (
                  <span />
                )}
              </label>
            );
          })}
        </div>
      )}
      {lista && (
        <p className={juntar("text-xs", lista.aviso ? "text-aviso" : "text-texto-fraco")}>
          {lista.aviso ?? `Lista buscada na sua conta ${provedor === "claude" ? "Anthropic" : "OpenAI"}.`}
          {provedor === "openai" && " O GPT no atendimento ainda não foi testado com o bot real."}
        </p>
      )}
    </div>
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
      <label htmlFor={`chave-${tipo}`} className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="size-3.5 text-texto-suave" aria-hidden /> {ROTULOS_CHAVE[tipo]}
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
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id={`chave-${tipo}`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={situacao?.configurada ? "Cole uma nova chave para trocar" : "Cole a chave aqui"}
          className={`${classeEntrada} min-w-0 flex-1`}
        />
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
