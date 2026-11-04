"use client";

import { CalendarClock, LayoutDashboard, Shuffle, Timer } from "lucide-react";
import { useState } from "react";
import { MODOS_DISTRIBUICAO, type ModoDistribuicao } from "@/regras/distribuicao";
import { NOMES_DIAS, type RegrasAgenda } from "@/regras/agenda";
import type { PrazosEspera } from "@/regras/espera";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Abas } from "../entalhe/abas";
import { Botao, Campo, Carregando, EstadoErro, classeEntrada } from "../ui";
import { EquipeConfig, type Membro } from "./equipe";
import { ExportarDesempenho } from "./exportar-desempenho";
import { InstrucoesAtendimento } from "./instrucoes";
import { Armazenamento } from "./armazenamento";
import { ChavesApi } from "./chaves-api";
import { UsoDoBot } from "./uso-bot";
import { VendasConfig } from "./vendas";
import { WhatsappConfig } from "./whatsapp";

interface Dados {
  equipe: Membro[];
  distribuicao: ModoDistribuicao;
  naFila: number;
  prazosEspera: PrazosEspera;
  regrasAgenda: RegrasAgenda;
  periodoExportacao: { de: string; ate: string };
}

type AbaConfig = "geral" | "vendas" | "instrucoes" | "api" | "exportar";

const ABAS: { codigo: AbaConfig; rotulo: string }[] = [
  { codigo: "geral", rotulo: "Geral" },
  { codigo: "vendas", rotulo: "Vendas" },
  { codigo: "instrucoes", rotulo: "Instruções de atendimento" },
  { codigo: "api", rotulo: "Chave API" },
  { codigo: "exportar", rotulo: "Exportar desempenho" },
];

export function Configuracoes() {
  const avisar = useAviso();
  const { dados, erro, carregando, recarregar } = useDados<Dados>("/api/configuracoes");
  const [aba, setAba] = useState<AbaConfig>("geral");

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
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="sr-only">Configurações</h1>
        <p className="text-sm text-texto-suave">Só o administrador vê esta tela.</p>
      </div>

      <Abas itens={ABAS} valor={aba} aoMudar={setAba} rotuloAria="Seções das configurações" />

      {aba === "vendas" ? (
        <VendasConfig />
      ) : aba === "instrucoes" ? (
        <InstrucoesAtendimento />
      ) : aba === "api" ? (
        <div className="space-y-4">
          <ChavesApi />
          <UsoDoBot />
          <WhatsappConfig />
        </div>
      ) : aba === "exportar" ? (
        dados ? <ExportarDesempenho equipe={dados.equipe} periodoPadrao={dados.periodoExportacao} /> : <Carregando linhas={2} />
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

            <EquipeConfig equipe={dados.equipe} recarregar={recarregar} />

            <Armazenamento />

            <section className="rounded-painel border border-dashed border-borda-forte bg-superficie p-4 opacity-80">
              <LayoutDashboard className="mb-2 size-5 text-texto-suave" aria-hidden />
              <h2 className="text-sm font-semibold">Layout da ficha do lead</h2>
              <p className="mt-1 text-xs text-texto-suave">Abra qualquer lead e use &quot;Personalizar layout&quot;. O que você salvar vale para todos.</p>
            </section>
          </>
        )
      )}
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
      <div className="mt-3">
        <Botao onClick={salvar} disabled={!mudou || salvando}>
          {salvando ? "Salvando..." : "Salvar prazos"}
        </Botao>
      </div>
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
  function mudarNumero(campo: "duracaoMin" | "visitasPorHorario" | "diasAFrente", valor: string) {
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

  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <CalendarClock className="size-4 text-texto-suave" aria-hidden /> Regras da agenda de visitas
      </h2>
      <p className="mb-3 text-sm text-texto-suave">
        Valem para o bot e para a agenda. O bot não conhece estes números: ele só oferece os horários livres que o sistema devolve. O próximo horário é sempre o próximo dia aberto.{" "}
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
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Duração da visita (min)">
          <input type="number" inputMode="numeric" min={30} max={240} step={15} value={rascunho.duracaoMin} onChange={(e) => mudarNumero("duracaoMin", e.target.value)} className={classeEntrada} />
        </Campo>
        <Campo rotulo="Visitas ao mesmo tempo na loja">
          <input type="number" inputMode="numeric" min={1} max={10} value={rascunho.visitasPorHorario} onChange={(e) => mudarNumero("visitasPorHorario", e.target.value)} className={classeEntrada} />
        </Campo>
        <Campo rotulo="Marcar até quantos dias à frente">
          <input type="number" inputMode="numeric" min={1} max={90} value={rascunho.diasAFrente} onChange={(e) => mudarNumero("diasAFrente", e.target.value)} className={classeEntrada} />
        </Campo>
      </div>
      <div className="mt-3">
        <Botao onClick={salvar} disabled={!mudou || salvando}>
          {salvando ? "Salvando..." : "Salvar regras da agenda"}
        </Botao>
      </div>
    </section>
  );
}
