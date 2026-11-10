"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Coins } from "lucide-react";
import { TEXTO_ESTIMATIVA } from "@/regras/apresentacao";
import { REGRAS_AGENDA_PADRAO, descreverRegrasAgenda, horasDeInicio, type RegrasAgenda, type TipoCompromisso } from "@/regras/agenda";
import { chaveDia, formatarDiaLongo, formatarDiaSemana, formatarHora, formatarVisitaCurta, lerChaveDia, partesLocais } from "@/regras/tempo";
import { chamarApi, useAviso, useDados } from "../dados";
import { primeiraMaiuscula } from "../texto";
import { juntar } from "../estilos";
import { Botao, Carregando, Modal } from "../ui";
import { useUsuario } from "../usuario";
import { Calendario, diaSemanaChave, somarDiasChave } from "./calendario";

interface DadosLivres {
  agora: string;
  regras: RegrasAgenda;
  consultores: { id: string; nome: string }[];
  /** Dia no centro da visão (o escolhido, ou o primeiro com horário livre). */
  centroLivres: string;
  /** Primeiro dia que pode ser marcado. */
  primeiroDia: string;
  /** Livres na véspera, no dia do centro e no dia seguinte. */
  livres: { inicio: string; consultorId: string }[];
  /** Apresentação de quem pulou a medição e ainda não confirmou a estimativa de valores: a tela pergunta antes de abrir a agenda. */
  estimativaPendente?: boolean;
}

type Vaga = { inicio: string; consultorId: string };

/** Até quantos meses à frente o calendário deixa escolher. */
const MESES_A_FRENTE = 12;

// Textos de cada compromisso (tarefa 21).
const TEXTOS: Record<TipoCompromisso, { titulo: string; ok: string; botao: string; dica?: string }> = {
  visita: { titulo: "Agendar visita à loja", ok: "Visita agendada.", botao: "Confirmar visita", dica: "Cliente vem conhecer a loja ou passar o projeto: o card continua na coluna em que está." },
  medicao: { titulo: "Agendar medição na casa do cliente", ok: "Medição agendada. O card foi para Medição agendada.", botao: "Confirmar medição", dica: "A medição ocupa a agenda do consultor e não ocupa a loja." },
  apresentacao: { titulo: "Agendar apresentação na loja", ok: "Apresentação agendada. O card foi para Apresentação agendada.", botao: "Confirmar apresentação" },
};

// Agendar ou remarcar pela ficha, pela agenda ou ao arrastar o card (AGENDA-03). Calendário para escolher o dia
// (qualquer data futura) e, ao lado, os horários livres do tipo na véspera, no dia escolhido e no dia seguinte.
export function AgendarVisita({ leadId, aberto, aoFechar, aoAgendar, tipo = "visita" }: { leadId: string; aberto: boolean; aoFechar: () => void; aoAgendar: () => void; tipo?: TipoCompromisso }) {
  const textos = TEXTOS[tipo];
  const avisar = useAviso();
  const usuario = useUsuario();
  const [dia, setDia] = useState<string | null>(null);
  const [mes, setMes] = useState<string | null>(null);
  const url = aberto ? `/api/agenda?visao=dia&livresPara=${leadId}&tipo=${tipo}${dia ? `&diaLivre=${dia}` : ""}` : null;
  const { dados, carregando } = useDados<DadosLivres>(url);
  const [escolhido, setEscolhido] = useState<Vaga | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [estimativaOk, setEstimativaOk] = useState(false);

  const centro = dia ?? dados?.centroLivres ?? null;
  // Enquanto chegam os horários do dia novo, os antigos ficam apagados (não somem de uma vez).
  const atualizando = !!dia && dados?.centroLivres !== dia;
  const regras = dados?.regras ?? REGRAS_AGENDA_PADRAO;
  const hoje = dados ? chaveDia(new Date(dados.agora)) : undefined;
  const maximo = hoje ? somarDiasChave(hoje, MESES_A_FRENTE * 31) : "9999-12-31";
  const fechado = (diaSemana: number) => horasDeInicio(diaSemana, regras, tipo).length === 0;

  const porDia = useMemo(() => {
    const mapa = new Map<string, Vaga[]>();
    dados?.livres?.forEach((l) => {
      // Consultor só agenda na própria agenda; o admin agenda em qualquer uma.
      if (usuario.perfil !== "admin" && l.consultorId !== usuario.id) return;
      const d = chaveDia(new Date(l.inicio));
      mapa.set(d, [...(mapa.get(d) ?? []), l]);
    });
    return mapa;
  }, [dados, usuario]);

  const nomeConsultor = (id: string) => dados?.consultores.find((c) => c.id === id)?.nome ?? "";

  function fechar() {
    setEstimativaOk(false);
    setDia(null);
    setMes(null);
    setEscolhido(null);
    aoFechar();
  }

  function irPara(novo: string) {
    setDia(novo);
    setMes(`${novo.slice(0, 7)}-01`);
  }

  async function confirmar() {
    if (!escolhido) return;
    setSalvando(true);
    const d = new Date(escolhido.inicio);
    try {
      await chamarApi("/api/agenda", {
        method: "POST",
        json: { acao: "agendar", leadId, quando: { dia: chaveDia(d), hora: partesLocais(d).hora }, consultorId: escolhido.consultorId, tipo },
      });
      avisar(textos.ok);
      aoAgendar();
      fechar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível agendar.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarEstimativa() {
    setSalvando(true);
    try {
      await chamarApi(`/api/leads/${leadId}/apresentacao`, { method: "POST", json: { acao: "estimativa_alinhada" } });
      setEstimativaOk(true);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível registrar.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  // Quem pulou a medição só marca a apresentação depois de confirmar a estimativa de valores (regra da loja).
  if (aberto && tipo === "apresentacao" && dados?.estimativaPendente && !estimativaOk) {
    return (
      <Modal aberto aoFechar={fechar} titulo={TEXTO_ESTIMATIVA.titulo} largura="max-w-md">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-aviso-suave text-aviso">
            <Coins className="size-5" aria-hidden />
          </span>
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{TEXTO_ESTIMATIVA.pergunta}</p>
            <p className="text-texto-suave">{TEXTO_ESTIMATIVA.regra}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={fechar}>
            {TEXTO_ESTIMATIVA.nao}
          </Botao>
          <Botao variante="primario" carregando={salvando} onClick={confirmarEstimativa}>
            {TEXTO_ESTIMATIVA.sim}
          </Botao>
        </div>
      </Modal>
    );
  }

  return (
    <Modal aberto={aberto} aoFechar={fechar} titulo={textos.titulo} largura="max-w-5xl">
      {(carregando && !dados) || !dados || !centro ? (
        <Carregando linhas={3} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-texto-suave">Horários livres ({descreverRegrasAgenda(regras)}).</p>
          {textos.dica && <p className="text-sm text-texto-suave">{textos.dica}</p>}
          <div className="grid gap-4 md:grid-cols-[17rem_1fr]">
            <div className="rounded-painel border border-borda bg-superficie-suave/40 p-3">
              <Calendario
                mes={mes ?? `${centro.slice(0, 7)}-01`}
                aoMudarMes={setMes}
                selecionado={centro}
                aoEscolher={setDia}
                minimo={dados.primeiroDia}
                maximo={maximo}
                hoje={hoje}
                fechado={fechado}
              />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{primeiraMaiuscula(formatarDiaLongo(lerChaveDia(centro) ?? new Date()))}</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => irPara(somarDiasChave(centro, -1))}
                    disabled={somarDiasChave(centro, -1) < dados.primeiroDia}
                    aria-label="Dia anterior"
                    className="inline-flex size-9 items-center justify-center rounded-controle text-texto-suave transition hover:bg-superficie-suave disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <button
                    onClick={() => irPara(somarDiasChave(centro, 1))}
                    disabled={somarDiasChave(centro, 1) > maximo}
                    aria-label="Próximo dia"
                    className="inline-flex size-9 items-center justify-center rounded-controle text-texto-suave transition hover:bg-superficie-suave disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                </div>
              </div>
              <div key={centro} className={juntar("grid animate-surgir gap-2 sm:grid-cols-3", atualizando && "pointer-events-none opacity-50 transition-opacity")} aria-busy={atualizando}>
                {[-1, 0, 1].map((desloc) => {
                  const d = somarDiasChave(centro, desloc);
                  return (
                    <ColunaDia
                      key={d}
                      dia={d}
                      principal={desloc === 0}
                      vagas={porDia.get(d) ?? []}
                      motivoVazio={d < dados.primeiroDia ? (d === hoje ? "Não há mais horário hoje" : "Dia já passou") : fechado(diaSemanaChave(d)) ? "Loja fechada" : "Sem horário livre"}
                      escolhido={escolhido}
                      aoEscolher={setEscolhido}
                      aoAbrirDia={desloc === 0 ? undefined : () => irPara(d)}
                      nomeConsultor={nomeConsultor}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borda pt-4">
            <p className="mr-auto text-sm text-texto-suave" aria-live="polite">
              {escolhido ? (
                <>
                  Escolhido: <span className="font-semibold text-texto">{formatarVisitaCurta(new Date(escolhido.inicio))}</span> com {nomeConsultor(escolhido.consultorId)}
                </>
              ) : (
                "Escolha um horário."
              )}
            </p>
            <Botao variante="fantasma" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao variante="primario" disabled={!escolhido} carregando={salvando} onClick={confirmar}>
              {textos.botao}
            </Botao>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ColunaDia({
  dia,
  principal,
  vagas,
  motivoVazio,
  escolhido,
  aoEscolher,
  aoAbrirDia,
  nomeConsultor,
}: {
  dia: string;
  principal: boolean;
  vagas: Vaga[];
  motivoVazio: string;
  escolhido: Vaga | null;
  aoEscolher: (v: Vaga) => void;
  aoAbrirDia?: () => void;
  nomeConsultor: (id: string) => string;
}) {
  const data = lerChaveDia(dia) ?? new Date();
  const titulo = `${primeiraMaiuscula(formatarDiaSemana(data))}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  return (
    <section
      aria-label={titulo}
      className={juntar("flex min-w-0 flex-col rounded-painel border p-2.5 transition", principal ? "border-marca/60 bg-marca/5 shadow-sm" : "border-borda bg-superficie")}
    >
      {aoAbrirDia ? (
        <button onClick={aoAbrirDia} className="mb-2 rounded-controle px-1 text-left text-sm font-semibold text-texto-suave transition hover:text-marca" title="Ver este dia no centro">
          {titulo}
        </button>
      ) : (
        <p className="mb-2 px-1 text-sm font-semibold text-marca">{titulo}</p>
      )}
      {vagas.length ? (
        <div className="max-h-[45dvh] space-y-1.5 overflow-y-auto pr-0.5">
          {vagas.map((v) => {
            const ativo = escolhido?.inicio === v.inicio && escolhido.consultorId === v.consultorId;
            return (
              <button
                key={`${v.inicio}|${v.consultorId}`}
                onClick={() => aoEscolher(v)}
                aria-pressed={ativo}
                className={juntar(
                  "flex min-h-toque w-full items-center justify-between gap-2 rounded-controle border px-3 text-sm transition",
                  ativo ? "border-marca bg-marca text-sobre-marca" : "border-borda bg-superficie hover:border-marca",
                )}
              >
                <span className="font-medium tabular-nums">{formatarHora(new Date(v.inicio))}</span>
                <span className={juntar("truncate text-xs", ativo ? "text-sobre-marca/80" : "text-texto-fraco")}>{nomeConsultor(v.consultorId)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center px-2 py-6 text-center text-sm text-texto-fraco">{motivoVazio}</p>
      )}
    </section>
  );
}
