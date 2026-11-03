"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, Presentation } from "lucide-react";
import { REGRAS_AGENDA_PADRAO, descreverRegrasAgenda, horasDeInicio, type RegrasAgenda } from "@/regras/agenda";
import { DIA, chaveDia, formatarData, formatarDiaLongo, formatarDiaSemana, formatarHora, lerChaveDia, partesLocais, somarDias } from "@/regras/tempo";
import { chamarApi, useAviso, useDados } from "../dados";
import { primeiraMaiuscula } from "../texto";
import { COR_AVATAR, juntar } from "../estilos";
import { Botao, Campo, Carregando, EstadoErro, Modal, classeEntrada } from "../ui";
import { AgendarVisita } from "../ficha/agendar";
import { useUsuario } from "../usuario";

interface Visita { id: string; consultorId: string; inicio: string; fim: string; leadId: string; leadNome: string; cidade: string | null; tipo: "visita" | "apresentacao" }
interface Bloqueio { id: string; consultorId: string; inicio: string; fim: string; motivo: string | null }
interface DadosAgenda { visao: "dia" | "semana"; de: string; ate: string; agora: string; regras: RegrasAgenda; consultores: { id: string; nome: string }[]; visitas: Visita[]; bloqueios: Bloqueio[] }

// Grade de 8h às 20h (último quadro 19h–20h). Fora do horário da loja o quadro fica cinza e não aceita visita.

// Agenda própria (AGENDA-01/03): visão de dia e de semana, visitas e bloqueios por consultor.
export function Agenda() {
  const avisar = useAviso();
  const usuario = useUsuario();
  // Consultor vê todas as agendas, mas só altera a própria; o admin altera todas.
  const minha = (consultorId: string) => usuario.perfil === "admin" || usuario.id === consultorId;
  const [visao, setVisao] = useState<"dia" | "semana">("semana");
  // No celular a agenda abre na visão de dia.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende da largura da tela, só existe no navegador
    if (window.matchMedia("(max-width: 767px)").matches) setVisao("dia");
  }, []);
  const [data, setData] = useState<string | null>(null);
  const { dados, erro, carregando, recarregar } = useDados<DadosAgenda>(`/api/agenda?visao=${visao}${data ? `&data=${data}` : ""}`);
  const [visitaAberta, setVisitaAberta] = useState<Visita | null>(null);
  const [remarcar, setRemarcar] = useState<{ leadId: string; tipo: "visita" | "apresentacao" } | null>(null);
  const [bloqueio, setBloqueio] = useState<{ dia: string; hora: number; consultorId: string; horas: number; motivo: string } | null>(null);
  const [bloqueioAberto, setBloqueioAberto] = useState<Bloqueio | null>(null);
  // Filtro por consultor (só o admin vê os botões); null = todos.
  const [filtro, setFiltro] = useState<string | null>(null);

  const regras = dados?.regras ?? REGRAS_AGENDA_PADRAO;
  const descricaoRegras = descreverRegrasAgenda(regras);
  const abertos = regras.horario.flatMap((h) => (h ? [h] : []));
  const primeiraHora = Math.min(...abertos.map((h) => h.abre));
  const ultimaHora = Math.max(...abertos.map((h) => h.fecha));
  const horas = Array.from({ length: Math.max(1, ultimaHora - primeiraHora) }, (_, i) => primeiraHora + i);
  const base = dados ? new Date(dados.de) : null;
  const dias = base ? Array.from({ length: visao === "dia" ? 1 : 7 }, (_, i) => somarDias(base, i)).filter((d) => visao === "dia" || regras.horario[partesLocais(d).diaSemana] !== null) : [];
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
    const doFiltro = (consultorId: string) => !filtro || consultorId === filtro;
    return {
      visitas: dados?.visitas.filter((v) => mesmo(v.inicio) && doFiltro(v.consultorId)) ?? [],
      bloqueios: dados?.bloqueios.filter((b) => cobre(b) && doFiltro(b.consultorId)) ?? [],
    };
  }

  // "Hoje" vem do relógio do servidor (pode ser o relógio simulado), não do navegador.
  const hojeChave = dados ? chaveDia(new Date(dados.agora)) : "";

  const titulo = base ? (visao === "dia" ? formatarDiaLongo(base) : `Semana de ${formatarData(base)}`) : "";

  return (
    // No computador a agenda ocupa exatamente a altura da tela (a rolagem, se precisar, é só dentro da grade).
    <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-3 p-4 md:h-[calc(100dvh-var(--spacing-topo))] md:flex-none md:overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="sr-only">Agenda</h1>
        <div className="flex rounded-controle bg-superficie p-1 shadow-card" role="tablist" aria-label="Visão">
          {(["dia", "semana"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={visao === v} onClick={() => setVisao(v)} className={juntar("min-h-toque rounded-controle px-4 text-sm font-medium", visao === v ? "bg-marca-suave text-marca-texto" : "text-texto-suave hover:bg-superficie-suave")}>
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
        {usuario.perfil === "admin" ? (
          <div className="ml-auto flex flex-wrap items-center gap-1 rounded-controle bg-superficie p-1 shadow-card" role="group" aria-label="Filtrar por consultor">
            {[{ id: null, nome: "Todos" }, ...(dados?.consultores ?? [])].map((c) => (
              <button
                key={c.id ?? "todos"}
                onClick={() => setFiltro(c.id)}
                aria-pressed={filtro === c.id}
                className={juntar("inline-flex min-h-toque items-center gap-1.5 rounded-controle px-3 text-sm font-medium", filtro === c.id ? "bg-marca text-sobre-marca" : "text-texto-suave hover:bg-superficie-suave")}
              >
                {c.id && <span className={juntar("size-2.5 rounded-full", corConsultor(c.id))} aria-hidden />}
                {c.nome}
              </button>
            ))}
          </div>
        ) : (
          <div className="ml-auto flex flex-wrap gap-3 text-xs">
            {dados?.consultores.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span className={juntar("size-3 rounded-full", corConsultor(c.id))} aria-hidden /> {c.nome}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="truncate text-xs text-texto-fraco" title={descricaoRegras}>Regras da agenda (o administrador muda em Configurações): {descricaoRegras}. Clique no + de um horário para bloquear a agenda de um consultor.</p>

      {carregando && !dados ? (
        <Carregando linhas={4} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-painel border border-borda bg-superficie shadow-painel">
          <table className="h-full w-full min-w-[640px] table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 w-16 border-b border-borda bg-superficie p-2 text-left text-xs font-medium text-texto-fraco">Hora</th>
                {dias.map((d) => {
                  const ehHoje = chaveDia(d) === hojeChave;
                  return (
                    <th key={d.toISOString()} aria-current={ehHoje ? "date" : undefined} className={juntar("sticky top-0 z-10 border-b border-l border-borda p-2 text-left font-semibold", ehHoje ? "bg-marca-suave text-marca-texto" : "bg-superficie")}>
                      <span className="capitalize">{formatarDiaSemana(d)}</span> <span className={ehHoje ? "font-semibold" : "font-normal text-texto-suave"}>{formatarData(d).slice(0, 5)}</span>
                      {ehHoje && <span className="ml-1.5 rounded-pilula bg-marca px-2 py-0.5 text-[11px] font-medium text-sobre-marca">Hoje</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {horas.map((hora) => (
                <tr key={hora}>
                  <td className="border-b border-borda p-2 align-top text-xs text-texto-fraco">{hora}h</td>
                  {dias.map((d) => {
                    const aberto = horasDeInicio(partesLocais(d).diaSemana, regras).includes(hora);
                    const { visitas, bloqueios } = itensNoHorario(d, hora);
                    return (
                      <td key={d.toISOString()} className={juntar("group/celula h-9 overflow-hidden border-b border-l border-borda p-0.5 align-top", !aberto && "bg-superficie-suave", aberto && chaveDia(d) === hojeChave && "bg-marca-suave/40")}>
                        {aberto && (
                          <div className="flex h-full gap-0.5">
                            {visitas.map((v) => (
                              <button key={v.id} title={`${v.tipo === "apresentacao" ? "Apresentação na loja: " : ""}${v.leadNome} · ${nomeConsultor(v.consultorId)}`} onClick={() => setVisitaAberta(v)} className={v.tipo === "apresentacao" ? "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-controle border border-alerta bg-alerta px-2 text-left text-xs font-semibold text-sobre-cor shadow-card hover:brightness-95" : "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-controle bg-sucesso-suave px-2 text-left text-xs font-medium text-sucesso hover:brightness-95"}>
                                {v.tipo === "apresentacao" ? <Presentation className="size-3.5 shrink-0" aria-hidden /> : <span className={juntar("size-2 shrink-0 rounded-full", corConsultor(v.consultorId))} aria-hidden />}
                                <span className="truncate">{v.leadNome}</span>
                              </button>
                            ))}
                            {bloqueios.map((b) => (
                              <button key={b.id} title={`${nomeConsultor(b.consultorId)}: ${b.motivo ?? "bloqueado"}`} onClick={() => setBloqueioAberto(b)} className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-controle bg-superficie-suave px-2 text-left text-xs text-texto-suave hover:bg-borda">
                                <Lock className="size-3 shrink-0" aria-hidden />
                                <span className="truncate">{nomeConsultor(b.consultorId)}: {b.motivo ?? "bloqueado"}</span>
                              </button>
                            ))}
                            {visitas.length === 0 && (
                            <button
                              onClick={() => setBloqueio({ dia: chaveDia(d), hora, consultorId: usuario.perfil === "admin" ? (filtro ?? dados?.consultores[0]?.id ?? "") : usuario.id, horas: 1, motivo: "" })}
                              className={juntar("flex h-7 items-center justify-center rounded-controle text-texto-fraco opacity-0 [@media(hover:none)]:opacity-60 transition-opacity duration-150 hover:bg-superficie-suave hover:opacity-100 focus-visible:opacity-100 group-hover/celula:opacity-70", bloqueios.length ? "w-7 shrink-0" : "w-full")}
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

      <Modal aberto={!!visitaAberta} aoFechar={() => setVisitaAberta(null)} titulo={visitaAberta?.tipo === "apresentacao" ? "Apresentação na loja" : "Visita agendada"} largura="max-w-md">
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
              {minha(visitaAberta.consultorId) ? (
                <>
                  <Botao onClick={() => { setRemarcar({ leadId: visitaAberta.leadId, tipo: visitaAberta.tipo }); setVisitaAberta(null); }}>Remarcar</Botao>
                  <Botao variante="perigo" onClick={async () => (await post({ acao: "cancelar", visitaId: visitaAberta.id }, "Cancelado.")) && setVisitaAberta(null)}>{visitaAberta.tipo === "apresentacao" ? "Cancelar apresentação" : "Cancelar visita"}</Botao>
                </>
              ) : (
                <p className="self-center text-xs text-texto-fraco">Agenda de outro consultor: só visualização.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {remarcar && <AgendarVisita leadId={remarcar.leadId} tipo={remarcar.tipo} aberto aoFechar={() => setRemarcar(null)} aoAgendar={recarregar} />}

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
                {dados?.consultores.filter((c) => minha(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
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
            {minha(bloqueioAberto.consultorId) ? (
              <Botao variante="perigo" onClick={async () => (await post({ acao: "desbloquear", bloqueioId: bloqueioAberto.id }, "Bloqueio removido.")) && setBloqueioAberto(null)}>
                Remover bloqueio
              </Botao>
            ) : (
              <p className="text-xs text-texto-fraco">Agenda de outro consultor: só visualização.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
