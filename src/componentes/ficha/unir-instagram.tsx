"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { chamarApi, useAviso } from "../dados";
import { Botao, Modal, classeEntrada } from "../ui";
import { juntar } from "../estilos";

interface Candidato {
  id: string;
  nome: string;
  telefone: string;
  etapa: string;
  arquivado: boolean;
}

/**
 * Une o contato do Instagram (sem telefone) com o lead do WhatsApp do mesmo cliente (tarefa 47).
 * O vendedor procura pelo nome ou telefone, escolhe e confirma. Depois o card que fica é o do WhatsApp.
 */
export function UnirInstagram({ leadId, aoUnir }: { leadId: string; aoUnir: (leadFinalId: string) => void }) {
  const avisar = useAviso();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [escolhido, setEscolhido] = useState<Candidato | null>(null);
  const [unindo, setUnindo] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    const espera = setTimeout(async () => {
      try {
        const r = await chamarApi<{ candidatos: Candidato[] }>(`/api/leads/${leadId}/unir?busca=${encodeURIComponent(busca)}`);
        if (ativo) setCandidatos(r.candidatos);
      } catch {
        if (ativo) setCandidatos([]);
      }
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [aberto, busca, leadId]);

  function fechar() {
    setAberto(false);
    setEscolhido(null);
    setBusca("");
  }

  async function unir() {
    if (!escolhido) return;
    setUnindo(true);
    try {
      const r = await chamarApi<{ leadId: string }>(`/api/leads/${leadId}/unir`, { method: "POST", json: { leadWhatsappId: escolhido.id } });
      avisar("Contatos unidos. A conversa do Instagram agora está no lead do WhatsApp.");
      fechar();
      aoUnir(r.leadId);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível unir.", "erro");
    } finally {
      setUnindo(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="tecla inline-flex items-center gap-1 rounded-controle px-2 py-0.5 text-xs font-medium text-marca" title="Este contato do Instagram já falou pelo WhatsApp? Una os dois.">
        <Link2 className="size-3.5" aria-hidden />
        Unir com WhatsApp
      </button>
      <Modal aberto={aberto} aoFechar={fechar} titulo="Unir com lead do WhatsApp" largura="max-w-md">
        {!escolhido ? (
          <>
            <p className="text-sm text-texto-suave">Procure o mesmo cliente entre os leads do WhatsApp (nome ou telefone). As mensagens, notas, medidas e visitas deste contato passam para ele.</p>
            <input className={juntar(classeEntrada, "mt-3 w-full")} placeholder="Nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
            <ul className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto">
              {candidatos.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setEscolhido(c)} className="tecla flex w-full items-center justify-between gap-3 rounded-controle px-3 py-2 text-left text-sm">
                    <span className="truncate font-medium">{c.nome}</span>
                    <span className="shrink-0 text-xs text-texto-suave">{c.telefone}{c.arquivado ? " · arquivado" : ""}</span>
                  </button>
                </li>
              ))}
              {!candidatos.length && <li className="px-3 py-2 text-sm text-texto-suave">Nenhum lead do WhatsApp encontrado.</li>}
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm">Unir com <strong>{escolhido.nome}</strong> ({escolhido.telefone})?</p>
            <p className="mt-2 text-sm text-texto-suave">Este contato do Instagram deixa de existir como card separado. A etapa, o consultor e a ficha que ficam são os do lead do WhatsApp. Não dá para desfazer.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Botao variante="fantasma" onClick={() => setEscolhido(null)}>Voltar</Botao>
              <Botao variante="primario" carregando={unindo} onClick={unir}>Unir</Botao>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
