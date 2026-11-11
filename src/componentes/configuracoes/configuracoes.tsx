"use client";

import { CalendarClock, HardDrive, MessageCircleReply, MessageSquareReply, UserCheck, KeyRound, LayoutDashboard, MessageSquareText, Palette, Shuffle, SlidersHorizontal, Tag, Timer, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Pilula } from "../entalhe/pilula";
import { MODOS_DISTRIBUICAO, type ModoDistribuicao } from "@/regras/distribuicao";
import { NOMES_DIAS, type RegrasAgenda } from "@/regras/agenda";
import { MODELOS_SEM_COMPROMISSO } from "@/regras/modelos";
import type { RegrasPresenca } from "@/regras/presenca";
import type { RegrasRecuperacao } from "@/regras/recuperacao";
import type { RegrasRetorno } from "@/regras/retorno-fechada";
import type { PrazosEspera } from "@/regras/espera";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Campo, Carregando, EstadoErro, classeEntrada } from "../ui";
import { EquipeConfig, type Membro } from "./equipe";
import { MetasApresentacaoConfig } from "./metas-apresentacao";
import { RecuperacaoDeLeads } from "./recuperacao";
import { InstrucoesAtendimento } from "./instrucoes";
import { Armazenamento } from "./armazenamento";
import { ChavesApi } from "./chaves-api";
import { Temas } from "./temas";
import { ProvedorBarraSalvar, useBarraSalvar, useBlocoSalvavel } from "./barra-salvar";
import { UsoDoBot } from "./uso-bot";
import { VendasConfig } from "./vendas";
import { WhatsappConfig } from "./whatsapp";

interface Dados {
  equipe: Membro[];
  distribuicao: ModoDistribuicao;
  naFila: number;
  prazosEspera: PrazosEspera;
  regrasAgenda: RegrasAgenda;
  regrasPresenca: RegrasPresenca;
  regrasRetorno: RegrasRetorno;
  regrasRecuperacao: RegrasRecuperacao;
  metasApresentacao?: Record<string, number>;
  periodoExportacao: { de: string; ate: string };
}

type Secao = "geral" | "equipe" | "vendas" | "recuperacao" | "instrucoes" | "api" | "armazenamento" | "temas";

// Seções (tarefa 31): submenu vertical à esquerda; a URL guarda a seção (?secao=) para F5 voltar no lugar.
const SECOES: { codigo: Secao; rotulo: string; icone: typeof Shuffle }[] = [
  { codigo: "geral", rotulo: "Geral", icone: SlidersHorizontal },
  { codigo: "equipe", rotulo: "Equipe", icone: Users },
  { codigo: "vendas", rotulo: "Vendas", icone: Tag },
  { codigo: "recuperacao", rotulo: "Recuperação de leads", icone: MessageCircleReply },
  { codigo: "instrucoes", rotulo: "Instruções de atendimento", icone: MessageSquareText },
  { codigo: "api", rotulo: "Chaves de API", icone: KeyRound },
  { codigo: "armazenamento", rotulo: "Armazenamento", icone: HardDrive },
  { codigo: "temas", rotulo: "Temas", icone: Palette },
];

export function Configuracoes() {
  return (
    <ProvedorBarraSalvar>
      <ConfiguracoesComBarra />
    </ProvedorBarraSalvar>
  );
}

function ConfiguracoesComBarra() {
  const avisar = useAviso();
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const { pedirSaida } = useBarraSalvar();
  const { dados, erro, carregando, recarregar } = useDados<Dados>("/api/configuracoes");
  const secaoDaUrl = params.get("secao");
  const aba: Secao = SECOES.some((s) => s.codigo === secaoDaUrl) ? (secaoDaUrl as Secao) : "geral";
  const raizMenu = useRef<HTMLDivElement>(null);
  const botoesMenu = useRef<(HTMLButtonElement | null)[]>([]);
  const irPara = (codigo: Secao) => pedirSaida(() => router.replace(`${caminho}?secao=${codigo}`, { scroll: false }));

  async function chamar(url: string, metodo: string, json: object, sucesso: string) {
    try {
      await chamarApi(url, { method: metodo, json });
      avisar(sucesso);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível salvar.", "erro");
    } finally {
      await recarregar();
    }
  }

  return (
    <div data-config-raiz className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 p-4 pb-24 md:min-h-[calc(100dvh-var(--spacing-topo))] md:flex-row md:items-start">
      <h1 className="sr-only">Configurações</h1>
      <nav aria-label="Seções das configurações" className="md:sticky md:top-[calc(var(--spacing-topo)+1rem)] md:w-60 md:shrink-0">
        <div ref={raizMenu} role="tablist" aria-orientation="vertical" className="rolagem-fina relative flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {/* No computador a pílula de mola anda de uma opção à outra; no celular (menu na horizontal) fica o fundo fixo. */}
          <div className="hidden md:contents">
            <Pilula raiz={raizMenu} itens={botoesMenu} indice={SECOES.findIndex((s) => s.codigo === aba)} variante="marca" eixo="y" />
          </div>
          {SECOES.map((s, i) => {
            const Icone = s.icone;
            const ativo = s.codigo === aba;
            return (
              <button
                key={s.codigo}
                ref={(el) => {
                  botoesMenu.current[i] = el;
                }}
                role="tab"
                aria-selected={ativo}
                onClick={() => irPara(s.codigo)}
                className={juntar(
                  "relative flex min-h-toque shrink-0 items-center gap-3 rounded-controle px-3 text-left text-sm font-medium transition-colors",
                  ativo ? "afundado text-sobre-marca md:bg-none md:shadow-none" : "text-texto-suave hover:bg-superficie hover:text-texto",
                )}
              >
                <Icone className="size-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{s.rotulo}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 hidden px-3 text-xs text-texto-fraco md:block">Só o administrador vê esta tela.</p>
      </nav>

      <div className="min-w-0 flex-1 space-y-4" role="tabpanel">
      {aba === "vendas" ? (
        <VendasConfig />
      ) : aba === "recuperacao" ? (
        dados ? (
          <RecuperacaoDeLeads regras={dados.regrasRecuperacao} aoSalvar={(r) => chamar("/api/configuracoes/recuperacao", "PUT", r, "Recuperação de leads salva.")} />
        ) : (
          <Carregando linhas={3} />
        )
      ) : aba === "instrucoes" ? (
        <InstrucoesAtendimento />
      ) : aba === "api" ? (
        <div className="space-y-4">
          <ChavesApi />
          <UsoDoBot />
          <WhatsappConfig />
        </div>
      ) : aba === "temas" ? (
        <Temas />
      ) : aba === "armazenamento" ? (
        <Armazenamento />
      ) : aba === "equipe" ? (
        dados ? (
          <>
            <EquipeConfig equipe={dados.equipe} recarregar={recarregar} />
            <MetasApresentacaoConfig equipe={dados.equipe} metas={dados.metasApresentacao ?? {}} recarregar={recarregar} />
          </>
        ) : (
          <Carregando linhas={3} />
        )
      ) : carregando && !dados ? (
        <Carregando linhas={4} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : (
        dados && (
          <>
            <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
              <h2 className="mb-1 flex items-center gap-2 font-semibold">
                <Shuffle className="size-4 text-texto-suave" aria-hidden /> Distribuição de leads
              </h2>
              <p className="mb-3 text-sm text-texto-suave">Vale quando o bot passa o lead (ou agenda a visita) e ele ainda não tem consultor. Quem está em almoço não recebe.</p>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Modo de distribuição">
                {MODOS_DISTRIBUICAO.map((m) => {
                  const ativo = dados.distribuicao === m.codigo;
                  return (
                    <button
                      key={m.codigo}
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => !ativo && chamar("/api/configuracoes/distribuicao", "PUT", { modo: m.codigo }, `Distribuição: ${m.nome}.`)}
                      className={juntar("rounded-controle border p-3 text-left transition", ativo ? "border-marca bg-marca-suave" : "border-borda hover:border-borda-forte")}
                    >
                      <p className={juntar("text-sm font-semibold", ativo && "text-marca-texto")}>{m.nome}</p>
                      <p className="mt-1 text-xs text-texto-suave">{m.descricao}</p>
                    </button>
                  );
                })}
              </div>
              {dados.naFila > 0 && (
                <p className="mt-3 rounded-controle bg-aviso-suave px-3 py-2 text-sm text-aviso">
                  {dados.naFila} {dados.naFila === 1 ? "lead está" : "leads estão"} na fila, sem consultor, porque ninguém estava online. O primeiro consultor que voltar recebe.
                </p>
              )}
            </section>

            <PrazosDeEspera prazos={dados.prazosEspera} aoSalvar={(p) => chamar("/api/configuracoes/prazos-espera", "PUT", p, "Prazos de espera salvos.")} />

            <RegrasDaAgenda regras={dados.regrasAgenda} aoSalvar={(r) => chamar("/api/configuracoes/agenda", "PUT", r, "Regras da agenda salvas.")} />

            <PresencaEFila regras={dados.regrasPresenca} aoSalvar={(r) => chamar("/api/configuracoes/presenca", "PUT", r, "Presença e fila salvos.")} />

            <RetornoComLojaFechada regras={dados.regrasRetorno} aoSalvar={(r) => chamar("/api/configuracoes/retorno-fechada", "PUT", r, "Retorno com a loja fechada salvo.")} />

            <section className="rounded-painel border border-dashed border-borda-forte bg-superficie p-4 opacity-80">
              <LayoutDashboard className="mb-2 size-5 text-texto-suave" aria-hidden />
              <h2 className="text-sm font-semibold">Layout da ficha do lead</h2>
              <p className="mt-1 text-xs text-texto-suave">Abra qualquer lead e use &quot;Personalizar layout&quot;. O que você salvar vale para todos.</p>
            </section>
          </>
        )
      )}
      </div>
    </div>
  );
}

function PrazosDeEspera({ prazos, aoSalvar }: { prazos: PrazosEspera; aoSalvar: (p: PrazosEspera) => Promise<void> }) {
  const [amarelo, setAmarelo] = useState(String(prazos.amarelo));
  const [vermelho, setVermelho] = useState(String(prazos.vermelho));
  const [salvando, setSalvando] = useState(false);
  const mudou = amarelo !== String(prazos.amarelo) || vermelho !== String(prazos.vermelho);

  async function salvar() {
    setSalvando(true);
    try {
      await aoSalvar({ amarelo: Number(amarelo), vermelho: Number(vermelho) });
    } finally {
      setSalvando(false);
    }
  }
  // Salvar fica na barra do rodapé (tarefa 31).
  useBlocoSalvavel("prazos", {
    mudou,
    salvar,
    descartar: () => {
      setAmarelo(String(prazos.amarelo));
      setVermelho(String(prazos.vermelho));
    },
  });

  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Timer className="size-4 text-texto-suave" aria-hidden /> Prazos de espera do cliente
      </h2>
      <p className="mb-3 text-sm text-texto-suave">
        Quando o cliente espera um consultor, o card muda de cor conforme o tempo. Valores em minutos.{" "}
        <span className="rounded-pilula bg-aviso-suave px-2 py-0.5 text-xs font-medium text-aviso">Provisório</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Fica amarelo depois de (min)">
          <input type="number" inputMode="numeric" min={1} max={1440} value={amarelo} onChange={(e) => setAmarelo(e.target.value)} className={classeEntrada} />
        </Campo>
        <Campo rotulo="Fica vermelho depois de (min)" dica="O administrador também é avisado quando um lead passa deste prazo.">
          <input type="number" inputMode="numeric" min={1} max={1440} value={vermelho} onChange={(e) => setVermelho(e.target.value)} className={classeEntrada} />
        </Campo>
      </div>
      {salvando && <p className="mt-3 text-xs text-texto-fraco">Salvando...</p>}
    </section>
  );
}

function RegrasDaAgenda({ regras, aoSalvar }: { regras: RegrasAgenda; aoSalvar: (r: RegrasAgenda) => Promise<void> }) {
  const [rascunho, setRascunho] = useState<RegrasAgenda>(regras);
  const [salvando, setSalvando] = useState(false);
  const mudou = JSON.stringify(rascunho) !== JSON.stringify(regras);
  // Segunda a sábado, depois domingo.
  const ordem = [1, 2, 3, 4, 5, 6, 0];

  function mudarDia(dia: number, faixa: { abre: number; fecha: number } | null) {
    setRascunho((r) => ({ ...r, horario: r.horario.map((h, i) => (i === dia ? faixa : h)) }));
  }
  function mudarNumero(campo: "duracaoMin" | "duracaoMedicaoMin" | "visitasPorHorario" | "diasAFrente", valor: string) {
    setRascunho((r) => ({ ...r, [campo]: Number(valor) }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await aoSalvar(rascunho);
    } finally {
      setSalvando(false);
    }
  }
  useBlocoSalvavel("agenda", { mudou, salvar, descartar: () => setRascunho(regras) });

  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <CalendarClock className="size-4 text-texto-suave" aria-hidden /> Regras da agenda
      </h2>
      <p className="mb-3 text-sm text-texto-suave">
        Valem para visitas à loja, medições e apresentações. Nenhum compromisso pode coincidir com outro do mesmo consultor; a medição não ocupa vaga na loja. O bot não agenda: quem marca é o consultor.{" "}
        <span className="rounded-pilula bg-aviso-suave px-2 py-0.5 text-xs font-medium text-aviso">Provisório</span>
      </p>
      <ul className="divide-y divide-borda">
        {ordem.map((dia) => {
          const faixa = rascunho.horario[dia];
          return (
            <li key={dia} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <label className="flex w-36 items-center gap-2 font-medium">
                <input type="checkbox" checked={faixa !== null} onChange={(e) => mudarDia(dia, e.target.checked ? { abre: 8, fecha: 12 } : null)} />
                {NOMES_DIAS[dia]}
              </label>
              {faixa ? (
                <span className="flex items-center gap-2">
                  das
                  <input type="number" min={0} max={23} aria-label={`${NOMES_DIAS[dia]}: abre às`} value={faixa.abre} onChange={(e) => mudarDia(dia, { ...faixa, abre: Number(e.target.value) })} className={juntar(classeEntrada, "w-20")} />
                  às
                  <input type="number" min={1} max={24} aria-label={`${NOMES_DIAS[dia]}: fecha às`} value={faixa.fecha} onChange={(e) => mudarDia(dia, { ...faixa, fecha: Number(e.target.value) })} className={juntar(classeEntrada, "w-20")} />
                  h
                </span>
              ) : (
                <span className="text-texto-fraco">Fechado</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo rotulo="Visita e apresentação (min)">
          <input type="number" inputMode="numeric" min={30} max={240} step={15} value={rascunho.duracaoMin} onChange={(e) => mudarNumero("duracaoMin", e.target.value)} className={classeEntrada} />
        </Campo>
        <Campo rotulo="Medição (min)">
          <input type="number" inputMode="numeric" min={30} max={480} step={15} value={rascunho.duracaoMedicaoMin} onChange={(e) => mudarNumero("duracaoMedicaoMin", e.target.value)} className={classeEntrada} />
        </Campo>
        <Campo rotulo="Visitas ao mesmo tempo na loja">
          <input type="number" inputMode="numeric" min={1} max={10} value={rascunho.visitasPorHorario} onChange={(e) => mudarNumero("visitasPorHorario", e.target.value)} className={classeEntrada} />
        </Campo>
        <Campo rotulo="Marcar até quantos dias à frente">
          <input type="number" inputMode="numeric" min={1} max={90} value={rascunho.diasAFrente} onChange={(e) => mudarNumero("diasAFrente", e.target.value)} className={classeEntrada} />
        </Campo>
      </div>
      {salvando && <p className="mt-3 text-xs text-texto-fraco">Salvando...</p>}
    </section>
  );
}

/** Cartão "Presença e fila" (tarefa 35): vendedor offline no fechamento, fila da loja fechada e aviso de quem não chegou. O horário da loja vem da agenda. */
function PresencaEFila({ regras, aoSalvar }: { regras: RegrasPresenca; aoSalvar: (r: RegrasPresenca) => Promise<void> }) {
  const [rascunho, setRascunho] = useState<RegrasPresenca>(regras);
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
  useBlocoSalvavel("presenca", { mudou, salvar, descartar: () => setRascunho(regras) });

  const minutos = (campo: "repartirMin" | "verificarMin" | "avisoCedoMin", rotulo: string, desligado: boolean, sufixo: string) => (
    <label className={juntar("flex items-center gap-2 text-sm", desligado && "opacity-50")}>
      <span className="w-56">{rotulo}</span>
      <input type="number" inputMode="numeric" min={0} max={240} disabled={desligado} aria-label={rotulo} value={rascunho[campo]} onChange={(e) => setRascunho((r) => ({ ...r, [campo]: Number(e.target.value) }))} className={juntar(classeEntrada, "w-24")} />
      {sufixo}
    </label>
  );
  const interruptor = (campo: "desligarNoFechamento" | "repartirFila" | "verificarPresenca", rotulo: string) => (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={rascunho[campo]} onChange={(e) => setRascunho((r) => ({ ...r, [campo]: e.target.checked }))} />
      {rotulo}
    </label>
  );

  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <UserCheck className="size-4 text-texto-suave" aria-hidden /> Presença e fila
      </h2>
      <p className="mb-3 text-sm text-texto-suave">
        Vale com a loja fechada (fora do horário da agenda, fins de semana incluídos). Ao chegar, o vendedor clica em &quot;Ficar online&quot;; quem não clicar não recebe lead. Lead que chega com a loja fechada é atendido pelo bot e espera na fila.
      </p>
      <div className="space-y-3">
        {interruptor("desligarNoFechamento", "Desligar vendedores no fechamento da loja")}
        <div className="space-y-2">
          {interruptor("repartirFila", "Repartir a fila acumulada com a loja fechada")}
          <div className="pl-6">{minutos("repartirMin", "Quando repartir", !rascunho.repartirFila, "min depois da abertura")}</div>
        </div>
        <div className="space-y-2">
          {interruptor("verificarPresenca", "Verificar presença de quem tem compromisso")}
          <div className="space-y-2 pl-6">
            {minutos("verificarMin", "Quando verificar", !rascunho.verificarPresenca, "min depois da abertura")}
            {minutos("avisoCedoMin", "Aviso de compromisso cedo", !rascunho.verificarPresenca, "min antes do compromisso")}
            <label className={juntar("flex items-center gap-2 text-sm", !rascunho.verificarPresenca && "opacity-50")}>
              <span className="w-56">Quem recebe o aviso de ausência</span>
              <select disabled={!rascunho.verificarPresenca} aria-label="Quem recebe o aviso de ausência" value={rascunho.quemRecebe} onChange={(e) => setRascunho((r) => ({ ...r, quemRecebe: e.target.value as RegrasPresenca["quemRecebe"] }))} className={juntar(classeEntrada, "w-48")}>
                <option value="todos">Todos</option>
                <option value="admin">Só o administrador</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      {salvando && <p className="mt-3 text-xs text-texto-fraco">Salvando...</p>}
    </section>
  );
}

/** Cartão "Retorno com a loja fechada" (tarefa 36). O horário da loja, o texto do modelo e "só envia com dono online" são fixos. */
function RetornoComLojaFechada({ regras, aoSalvar }: { regras: RegrasRetorno; aoSalvar: (r: RegrasRetorno) => Promise<void> }) {
  const [rascunho, setRascunho] = useState<RegrasRetorno>(regras);
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
  useBlocoSalvavel("retorno-fechada", { mudou, salvar, descartar: () => setRascunho(regras) });

  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <MessageSquareReply className="size-4 text-texto-suave" aria-hidden /> Retorno com a loja fechada
      </h2>
      <p className="mb-3 text-sm text-texto-suave">
        Cliente que chega com a loja fechada tem a janela de 24h da Meta fechada antes de a loja abrir. No horário do retorno marcado pelo bot, sai um modelo aprovado, só se o lead tiver dono online (senão passa para quem está online; se ninguém estiver, o modelo espera e todos recebem aviso).
      </p>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={rascunho.automatico} onChange={(e) => setRascunho((r) => ({ ...r, automatico: e.target.checked }))} />
          Enviar o modelo de retorno automaticamente
        </label>
        {!rascunho.automatico && <p className="pl-6 text-xs text-texto-suave">Desligado: o vendedor recebe o aviso do retorno e envia o modelo pela conversa.</p>}
        <div className={juntar("space-y-2 pl-6", !rascunho.automatico && "opacity-50")}>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-56">Qual modelo usar</span>
            <select disabled={!rascunho.automatico} aria-label="Qual modelo usar" value={rascunho.modelo} onChange={(e) => setRascunho((r) => ({ ...r, modelo: e.target.value }))} className={juntar(classeEntrada, "w-72")}>
              {MODELOS_SEM_COMPROMISSO.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-56">Sem horário escolhido pelo cliente, enviar</span>
            <input type="number" inputMode="numeric" min={0} max={240} disabled={!rascunho.automatico} aria-label="Minutos depois da abertura" value={rascunho.semHorarioMin} onChange={(e) => setRascunho((r) => ({ ...r, semHorarioMin: Number(e.target.value) }))} className={juntar(classeEntrada, "w-24")} />
            min depois da abertura
          </label>
        </div>
      </div>
      {salvando && <p className="mt-3 text-xs text-texto-fraco">Salvando...</p>}
    </section>
  );
}
