"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { DESCRICAO_REGRAS_AGENDA, horasDeInicio } from "@/regras/agenda";
import { DIA, chaveDia, formatarData, formatarDiaLongo, formatarDiaSemana, formatarHora, lerChaveDia, partesLocais, somarDias } from "@/regras/tempo";
import { chamarApi, useAviso, useDados } from "../dados";
import { primeiraMaiuscula } from "../texto";
import { COR_AVATAR, juntar } from "../estilos";
import { Botao, Campo, Carregando, EstadoErro, Modal, classeEntrada } from "../ui";
import { AgendarVisita } from "../ficha/agendar";

interface Visita { id: string; consultorId: string; inicio: string; fim: string; leadId: string; leadNome: string; cidade: string | null }
interface Bloqueio { id: string; consultorId: string; inicio: string; fim: string; motivo: string | null }
interface DadosAgenda { visao: "dia" | "semana"; de: string; ate: string; agora: string; consultores: { id: string; nome: string }[]; visitas: Visita[]; bloqueios: Bloqueio[] }

const HORAS = Array.from({ length: 10 }, (_, i) => 8 + i); // 8h às 17h (início das visitas)

// Agenda própria (AGENDA-01/03): visão de dia e de semana, visitas e bloqueios por consultor.
export function Agenda() {
  const avisar = useAviso();
  const [visao, setVisao] = useState<"dia" | "semana">("semana");
  // No celular a agenda abre na visão de dia.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende da largura da tela, só existe no navegador
    if (window.matchMedia("(max-width: 767px)").matches) setVisao("dia");
  }, []);
  const [data, setData] = useState<string | null>(null);
  const { dados, erro, carregando, recarregar } = useDados<DadosAgenda>(`/api/agenda?visao=${visao}${data ? `&data=${data}` : ""}`);
  const [visitaAberta, setVisitaAberta] = useState<Visita | null>(null);
  const [remarcar, setRemarcar] = useState<string | null>(null);
  const [bloqueio, setBloqueio] = useState<{ dia: string; hora: number; consultorId: string; horas: number; motivo: string } | null>(null);
  const [bloqueioAberto, setBloqueioAberto] = useState<Bloqueio | null>(null);

  const base = dados ? new Date(dados.de) : null;
  const dias = base ? Array.from({ length: visao === "dia" ? 1 : 7 }, (_, i) => somarDias(base, i)).filter((d) => visao === "dia" || partesLocais(d).diaSemana !== 0) : [];
  const corConsultor = (id: string) => COR_AVATAR[Math.max(0, dados?.consultores.findIndex((c) => c.id === id) ?? 0) % COR_AVATAR.length];
  const nomeConsultor = (id: string) => dados?.consultores.find((c) => c.id === id)?.nome ?? "";

  function navegar(sentido: number) {
    if (!base) return;
    setData(chaveDia(new Date(base.getTime() + sentido * (visao === "dia" ? 1 : 7) * DIA + 12 * 3600_000)));
  }

  async function post(corpo: object, sucesso: string) {
    try {
      await chamarApi("/api/agenda", { method: "POST", json: corpo });
      avisar(sucesso);
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível concluir.", "erro");
      return false;
    } finally {
      await recarregar();
    }
  }

  function itensNoHorario(dia: Date, hora: number) {
    const p = partesLocais(dia);
    const mesmo = (iso: string) => {
      const q = partesLocais(new Date(iso));
      return q.ano === p.ano && q.mes === p.mes && q.dia === p.dia && q.hora === hora;
    };
    const slot = lerChaveDia(chaveDia(dia))!.getTime() + hora * 3600_000;
    const cobre = (b: Bloqueio) => new Date(b.inicio).getTime() <= slot && slot < new Date(b.fim).getTime();
    return { visitas: dados?.visitas.filter((v) => mesmo(v.inicio)) ?? [], bloqueios: dados?.bloqueios.filter(cobre) ?? [] };
  }

  const titulo = base ? (visao === "dia" ? formatarDiaLongo(base) : `Semana de ${formatarData(base)}`) : "";

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold tracking-tight">Agenda</h1>
        <div className="flex rounded-controle bg-superficie p-1 shadow-card" role="tablist" aria-label="Visão">
          {(["dia", "semana"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={visao === v} onClick={() => setVisao(v)} className={juntar("min-h-toque rounded-controle px-4 text-sm font-medium", visao === v ? "bg-marca text-sobre-marca" : "text-texto-suave")}>
              {v === "dia" ? "Dia" : "Semana"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navegar(-1)} className="inline-flex size-toque items-center justify-center rounded-controle hover:bg-superficie" aria-label="Anterior">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button onClick={() => setData(null)} className="min-h-toque rounded-controle px-3 text-sm font-medium hover:bg-superficie">Hoje</button>
          <button onClick={() => navegar(1)} className="inline-flex size-toque items-center justify-center rounded-controle hover:bg-superficie" aria-label="Próximo">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <p className="font-medium text-texto-suave">{primeiraMaiuscula(titulo)}</p>
        <div className="ml-auto flex flex-wrap gap-3 text-xs">
          {dados?.consultores.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5">
              <span className={juntar("size-3 rounded-full", corConsultor(c.id))} aria-hidden /> {c.nome}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-texto-fraco">Regras PROVISÓRIAS (a confirmar com o Mateus): {DESCRICAO_REGRAS_AGENDA}. Clique no + de um horário para bloquear a agenda de um consultor.</p>

      {carregando && !dados ? (
        <Carregando linhas={4} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : (
        <div className="overflow-x-auto rounded-painel border border-borda bg-superficie shadow-painel">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-16 border-b border-borda p-2 text-left text-xs font-medium text-texto-fraco">Hora</th>
                {dias.map((d) => (
                  <th key={d.toISOString()} className="border-b border-l border-borda p-2 text-left font-semibold">
                    <span className="capitalize">{formatarDiaSemana(d)}</span> <span className="font-normal text-texto-suave">{formatarData(d).slice(0, 5)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HORAS.map((hora) => (
                <tr key={hora}>
                  <td className="border-b border-borda p-2 align-top text-xs text-texto-fraco">{hora}h</td>
                  {dias.map((d) => {
                    const aberto = horasDeInicio(partesLocais(d).diaSemana).includes(hora);
                    const { visitas, bloqueios } = itensNoHorario(d, hora);
                    return (
                      <td key={d.toISOString()} className={juntar("h-16 border-b border-l border-borda p-1 align-top", !aberto && "bg-superficie-suave")}>
                        {aberto && (
                          <div className="flex flex-col gap-1">
                            {visitas.map((v) => (
                              <button key={v.id} onClick={() => setVisitaAberta(v)} className="flex min-h-9 items-center gap-1.5 rounded-controle bg-sucesso-suave px-2 py-1 text-left text-xs font-medium text-sucesso hover:brightness-95">
                                <span className={juntar("size-2 shrink-0 rounded-full", corConsultor(v.consultorId))} aria-hidden />
                                <span className="truncate">{v.leadNome}</span>
                              </button>
                            ))}
                            {bloqueios.map((b) => (
                              <button key={b.id} onClick={() => setBloqueioAberto(b)} className="flex min-h-9 items-center gap-1.5 rounded-controle bg-superficie-suave px-2 py-1 text-left text-xs text-texto-suave hover:bg-borda">
                                <Lock className="size-3 shrink-0" aria-hidden />
                                <span className="truncate">{nomeConsultor(b.consultorId)}: {b.motivo ?? "bloqueado"}</span>
                              </button>
                            ))}
                            {visitas.length === 0 && (
                            <button
                              onClick={() => setBloqueio({ dia: chaveDia(d), hora, consultorId: dados?.consultores[0]?.id ?? "", horas: 1, motivo: "" })}
                              className="flex min-h-toque items-center justify-center rounded-controle text-texto-fraco opacity-60 hover:bg-superficie-suave hover:opacity-100"
                              aria-label={`Bloquear ${formatarDiaSemana(d)} ${hora}h`}
                            >
                              <Plus className="size-3.5" aria-hidden />
                            </button>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal aberto={!!visitaAberta} aoFechar={() => setVisitaAberta(null)} titulo="Visita agendada" largura="max-w-md">
        {visitaAberta && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-semibold">{visitaAberta.leadNome}</p>
              <p className="text-texto-suave">
                {primeiraMaiuscula(formatarDiaLongo(new Date(visitaAberta.inicio)))}, {formatarHora(new Date(visitaAberta.inicio))} · {nomeConsultor(visitaAberta.consultorId)}
                {visitaAberta.cidade && ` · ${visitaAberta.cidade}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/lead/${visitaAberta.leadId}`} className="inline-flex min-h-toque items-center rounded-controle border border-borda px-4 text-sm font-medium hover:bg-superficie-suave">Abrir ficha</Link>
              <Botao onClick={() => { setRemarcar(visitaAberta.leadId); setVisitaAberta(null); }}>Remarcar</Botao>
              <Botao variante="perigo" onClick={async () => (await post({ acao: "cancelar", visitaId: visitaAberta.id }, "Visita cancelada.")) && setVisitaAberta(null)}>Cancelar visita</Botao>
            </div>
          </div>
        )}
      </Modal>

      {remarcar && <AgendarVisita leadId={remarcar} aberto aoFechar={() => setRemarcar(null)} aoAgendar={recarregar} />}

      <Modal aberto={!!bloqueio} aoFechar={() => setBloqueio(null)} titulo="Bloquear horário" largura="max-w-md">
        {bloqueio && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await post({ acao: "bloquear", consultorId: bloqueio.consultorId, quando: { dia: bloqueio.dia, hora: bloqueio.hora }, horas: bloqueio.horas, motivo: bloqueio.motivo || undefined }, "Horário bloqueado.");
              if (ok) setBloqueio(null);
            }}
          >
            <p className="text-sm text-texto-suave">
              <span>{primeiraMaiuscula(formatarDiaLongo(lerChaveDia(bloqueio.dia)!))}</span>, a partir das {bloqueio.hora}h. O bot nunca oferece horários bloqueados.
            </p>
            <Campo rotulo="Consultor">
              <select className={classeEntrada} value={bloqueio.consultorId} onChange={(e) => setBloqueio({ ...bloqueio, consultorId: e.target.value })}>
                {dados?.consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Duração (horas)">
              <input type="number" min={1} max={12} className={classeEntrada} value={bloqueio.horas} onChange={(e) => setBloqueio({ ...bloqueio, horas: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} />
            </Campo>
            <Campo rotulo="Motivo (opcional)">
              <input className={classeEntrada} value={bloqueio.motivo} onChange={(e) => setBloqueio({ ...bloqueio, motivo: e.target.value })} placeholder="Ex.: medição externa" />
            </Campo>
            <Botao type="submit" variante="primario" icone={<Lock className="size-4" aria-hidden />}>Bloquear</Botao>
          </form>
        )}
      </Modal>

      <Modal aberto={!!bloqueioAberto} aoFechar={() => setBloqueioAberto(null)} titulo="Horário bloqueado" largura="max-w-md">
        {bloqueioAberto && (
          <div className="space-y-4 text-sm">
            <p>
              {nomeConsultor(bloqueioAberto.consultorId)} · {formatarHora(new Date(bloqueioAberto.inicio))} às {formatarHora(new Date(bloqueioAberto.fim))}
              {bloqueioAberto.motivo && ` · ${bloqueioAberto.motivo}`}
            </p>
            <Botao variante="perigo" onClick={async () => (await post({ acao: "desbloquear", bloqueioId: bloqueioAberto.id }, "Bloqueio removido.")) && setBloqueioAberto(null)}>
              Remover bloqueio
            </Botao>
          </div>
        )}
      </Modal>
    </div>
  );
}
