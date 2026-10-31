"use client";

import { useMemo, useState } from "react";
import { DESCRICAO_REGRAS_AGENDA } from "@/regras/agenda";
import { chaveDia, formatarDiaLongo, formatarHora, partesLocais } from "@/regras/tempo";
import { chamarApi, useAviso, useDados } from "../dados";
import { primeiraMaiuscula } from "../texto";
import { juntar } from "../estilos";
import { Botao, Carregando, EstadoVazio, Modal } from "../ui";

interface DadosLivres {
  consultores: { id: string; nome: string }[];
  livres: { inicio: string; consultorId: string }[];
}

// Agendar ou remarcar pela ficha (AGENDA-03). Só mostra horários livres.
export function AgendarVisita({ leadId, aberto, aoFechar, aoAgendar }: { leadId: string; aberto: boolean; aoFechar: () => void; aoAgendar: () => void }) {
  const avisar = useAviso();
  const { dados, carregando } = useDados<DadosLivres>(aberto ? `/api/agenda?visao=dia&livresPara=${leadId}` : null);
  const [escolhido, setEscolhido] = useState<{ inicio: string; consultorId: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const porDia = useMemo(() => {
    const mapa = new Map<string, { inicio: string; consultorId: string }[]>();
    dados?.livres?.forEach((l) => {
      const dia = chaveDia(new Date(l.inicio));
      mapa.set(dia, [...(mapa.get(dia) ?? []), l]);
    });
    return [...mapa];
  }, [dados]);

  const nomeConsultor = (id: string) => dados?.consultores.find((c) => c.id === id)?.nome ?? "";

  async function confirmar() {
    if (!escolhido) return;
    setSalvando(true);
    const d = new Date(escolhido.inicio);
    try {
      await chamarApi("/api/agenda", {
        method: "POST",
        json: { acao: "agendar", leadId, quando: { dia: chaveDia(d), hora: partesLocais(d).hora }, consultorId: escolhido.consultorId },
      });
      avisar("Visita agendada.");
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
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Agendar visita" largura="max-w-2xl">
      {carregando && !dados ? (
        <Carregando linhas={2} />
      ) : !porDia.length ? (
        <EstadoVazio titulo="Nenhum horário livre nos próximos 14 dias" />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-texto-suave">Horários livres (regras PROVISÓRIAS: {DESCRICAO_REGRAS_AGENDA}).</p>
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
              Confirmar visita
            </Botao>
          </div>
        </div>
      )}
    </Modal>
  );
}
