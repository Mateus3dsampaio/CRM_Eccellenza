"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { chamarApi, useAviso, useDados } from "../dados";
import { Botao, Campo, Carregando, Modal, classeEntrada } from "../ui";

interface Resumo {
  nome: string;
  resumo: string;
  leads: number;
  consultores: { id: string; nome: string; status: string }[];
}

/**
 * "Passar os de hoje para…" (tarefa 35): os leads com compromisso ou retorno hoje de quem não ficou online vão para o
 * vendedor escolhido. Ninguém passa compromisso sozinho: sempre uma pessoa escolhe aqui.
 */
export function JanelaPassarHoje({ deId, aoFechar }: { deId: string | null; aoFechar: () => void }) {
  return (
    <Modal aberto={!!deId} aoFechar={aoFechar} titulo="Passar os de hoje" largura="max-w-md">
      {deId && <Conteudo deId={deId} aoFechar={aoFechar} />}
    </Modal>
  );
}

function Conteudo({ deId, aoFechar }: { deId: string; aoFechar: () => void }) {
  const avisar = useAviso();
  const { dados, carregando } = useDados<Resumo>(`/api/equipe/passar-hoje?deId=${encodeURIComponent(deId)}`);
  const [paraId, setParaId] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (carregando && !dados) return <Carregando linhas={2} />;
  if (!dados) return <p className="text-sm text-texto-suave">Não foi possível carregar.</p>;

  async function passar() {
    setEnviando(true);
    try {
      const r = await chamarApi<{ passados: number; conflitos: string[] }>("/api/equipe/passar-hoje", { method: "POST", json: { deId, paraId } });
      const para = dados?.consultores.find((c) => c.id === paraId)?.nome ?? "o vendedor escolhido";
      avisar(r.conflitos.length ? `${r.passados} passado(s) para ${para}. Ficaram com ${dados?.nome} por bater com horário já ocupado: ${r.conflitos.join(", ")}.` : `${r.passados} lead(s) de hoje passado(s) para ${para}.`, r.conflitos.length ? "alerta" : "ok");
      aoFechar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível passar.", "erro");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-texto-suave">
        <strong className="text-texto">{dados.nome}</strong> tem hoje: {dados.resumo || "nada"}. Só os leads de hoje mudam de dono (com os compromissos de hoje); os outros ficam como estão.
      </p>
      <Campo rotulo="Passar para">
        <select value={paraId} onChange={(e) => setParaId(e.target.value)} className={classeEntrada}>
          <option value="">Escolha um vendedor</option>
          {dados.consultores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
              {c.status === "online" ? " (online)" : c.status === "almoco" ? " (em almoço)" : " (offline)"}
            </option>
          ))}
        </select>
      </Campo>
      <div className="flex justify-end gap-2">
        <Botao variante="fantasma" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao icone={<ArrowRightLeft className="size-4" aria-hidden />} disabled={!paraId || dados.leads === 0} carregando={enviando} onClick={passar}>
          Passar {dados.leads} {dados.leads === 1 ? "lead" : "leads"}
        </Botao>
      </div>
    </div>
  );
}
