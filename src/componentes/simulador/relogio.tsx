"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { formatarDataHora, formatarDiaSemana } from "@/regras/tempo";
import { chamarApi, useAviso, useDados } from "../dados";
import { Botao } from "../ui";

const PASSOS = [
  { horas: 1, rotulo: "+1 hora" },
  { horas: 24, rotulo: "+1 dia" },
  { horas: 72, rotulo: "+3 dias" },
  { horas: 96, rotulo: "+4 dias" },
  { horas: 24 * 7, rotulo: "+7 dias" },
  { horas: 24 * 30, rotulo: "+30 dias" },
];

// Relógio simulado (RET-04): avança o tempo e roda as rotinas (retomada, "Sem resposta", exclusão de arquivados).
export function Relogio() {
  const avisar = useAviso();
  const { dados, recarregar } = useDados<{ agora: string; deslocamentoHoras: number; registros: { id: string; texto: string }[] }>("/api/relogio");
  const [ocupado, setOcupado] = useState(false);

  async function mudar(corpo: object) {
    setOcupado(true);
    try {
      const r = await chamarApi<{ resultado: { retomadas: number; semResposta: number; excluidos: number } }>("/api/relogio", { method: "POST", json: corpo });
      const { retomadas, semResposta, excluidos } = r.resultado;
      avisar(retomadas || semResposta || excluidos ? `Rotinas: ${retomadas} retomada(s), ${semResposta} sem resposta, ${excluidos} excluído(s).` : "Tempo avançado. Nenhuma rotina disparou.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível mudar o relógio.", "erro");
    } finally {
      setOcupado(false);
      await recarregar();
    }
  }

  const agora = dados ? new Date(dados.agora) : null;

  return (
    <aside className="flex flex-col gap-3 rounded-painel border border-borda bg-superficie p-4 shadow-painel">
      <h2 className="flex items-center gap-2 font-semibold">
        <Clock className="size-4 text-marca" aria-hidden />
        Relógio do simulador
      </h2>
      <div className="rounded-controle bg-marca-suave p-3">
        <p className="text-2xl font-semibold tabular-nums text-marca">{agora ? formatarDataHora(agora) : "--"}</p>
        <p className="text-xs text-texto-suave">
          {agora && `${formatarDiaSemana(agora)} · `}
          {dados?.deslocamentoHoras ? `${dados.deslocamentoHoras} h à frente do horário real` : "horário real"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PASSOS.map((p) => (
          <Botao key={p.horas} onClick={() => mudar({ horas: p.horas })} disabled={ocupado} className="whitespace-nowrap px-2">
            {p.rotulo}
          </Botao>
        ))}
      </div>
      <p className="text-xs text-texto-fraco">O relógio só anda para a frente. Para recomeçar do zero, rode <code>npm run seed</code>.</p>
      <p className="text-xs text-texto-fraco">Regras: retomada após 3 dias sem resposta (só cards no &quot;Novo&quot; com o bot atendendo); &quot;Sem resposta&quot; 4 dias depois (PROVISÓRIO); arquivados excluídos em 30 dias.</p>
      <div>
        <h3 className="mb-2 text-sm font-semibold">O que aconteceu</h3>
        <ol className="rolagem-fina max-h-72 space-y-2 overflow-y-auto pr-1 text-xs text-texto-suave">
          {!dados?.registros.length && <li>Nada ainda.</li>}
          {dados?.registros.map((r) => (
            <li key={r.id} className="rounded-controle bg-superficie-suave p-2">
              {r.texto}
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
