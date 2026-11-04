"use client";

import { useMemo, useState } from "react";
import { REGRAS_AGENDA_PADRAO, descreverRegrasAgenda, type RegrasAgenda, type TipoCompromisso } from "@/regras/agenda";
import { chaveDia, formatarDiaLongo, formatarHora, partesLocais } from "@/regras/tempo";
import { chamarApi, useAviso, useDados } from "../dados";
import { primeiraMaiuscula } from "../texto";
import { juntar } from "../estilos";
import { Botao, Carregando, EstadoVazio, Modal } from "../ui";
import { useUsuario } from "../usuario";

interface DadosLivres {
  regras: RegrasAgenda;
  consultores: { id: string; nome: string }[];
  livres: { inicio: string; consultorId: string }[];
}

// Textos de cada compromisso (tarefa 21).
const TEXTOS: Record<TipoCompromisso, { titulo: string; ok: string; botao: string; dica?: string }> = {
  visita: { titulo: "Agendar visita à loja", ok: "Visita agendada.", botao: "Confirmar visita", dica: "Cliente vem conhecer a loja ou passar o projeto: o card continua na coluna em que está." },
  medicao: { titulo: "Agendar medição na casa do cliente", ok: "Medição agendada. O card foi para Medição agendada.", botao: "Confirmar medição", dica: "A medição ocupa a agenda do consultor e não ocupa a loja." },
  apresentacao: { titulo: "Agendar apresentação na loja", ok: "Apresentação agendada. O card foi para Apresentação agendada.", botao: "Confirmar apresentação" },
};

// Agendar ou remarcar pela ficha ou ao arrastar o card (AGENDA-03). Só mostra horários livres do tipo escolhido.
export function AgendarVisita({ leadId, aberto, aoFechar, aoAgendar, tipo = "visita" }: { leadId: string; aberto: boolean; aoFechar: () => void; aoAgendar: () => void; tipo?: TipoCompromisso }) {
  const textos = TEXTOS[tipo];
  const avisar = useAviso();
  const usuario = useUsuario();
  const { dados, carregando } = useDados<DadosLivres>(aberto ? `/api/agenda?visao=dia&livresPara=${leadId}&tipo=${tipo}` : null);
  const [escolhido, setEscolhido] = useState<{ inicio: string; consultorId: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const porDia = useMemo(() => {
    const mapa = new Map<string, { inicio: string; consultorId: string }[]>();
    dados?.livres?.forEach((l) => {
      // Consultor só agenda na própria agenda; o admin agenda em qualquer uma.
      if (usuario.perfil !== "admin" && l.consultorId !== usuario.id) return;
      const dia = chaveDia(new Date(l.inicio));
      mapa.set(dia, [...(mapa.get(dia) ?? []), l]);
    });
    return [...mapa];
  }, [dados, usuario]);

  const nomeConsultor = (id: string) => dados?.consultores.find((c) => c.id === id)?.nome ?? "";

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
      aoFechar();
      setEscolhido(null);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível agendar.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={textos.titulo} largura="max-w-2xl">
      {carregando && !dados ? (
        <Carregando linhas={2} />
      ) : !porDia.length ? (
        <EstadoVazio titulo="Nenhum horário livre nos próximos 14 dias" />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-texto-suave">Horários livres ({descreverRegrasAgenda(dados?.regras ?? REGRAS_AGENDA_PADRAO)}).</p>
          {textos.dica && <p className="text-sm text-texto-suave">{textos.dica}</p>}
          <div className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
            {porDia.map(([dia, vagas]) => (
              <div key={dia}>
                <p className="mb-1.5 text-sm font-semibold">{primeiraMaiuscula(formatarDiaLongo(new Date(vagas[0].inicio)))}</p>
                <div className="flex flex-wrap gap-2">
                  {vagas.map((v) => {
                    const ativo = escolhido?.inicio === v.inicio;
                    return (
                      <button
                        key={v.inicio}
                        onClick={() => setEscolhido(v)}
                        aria-pressed={ativo}
                        className={juntar(
                          "min-h-toque rounded-controle border px-3 text-sm transition",
                          ativo ? "border-marca bg-marca text-sobre-marca" : "border-borda bg-superficie hover:border-marca",
                        )}
                      >
                        {formatarHora(new Date(v.inicio))} <span className={juntar("text-xs", ativo ? "text-sobre-marca/80" : "text-texto-fraco")}>· {nomeConsultor(v.consultorId)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Botao variante="fantasma" onClick={aoFechar}>
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
