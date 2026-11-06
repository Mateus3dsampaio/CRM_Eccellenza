"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { formatarDataHora, formatarDiaSemana } from "@/regras/tempo";
import { chamarApi, useAviso, useDados } from "../dados";
import { Botao, Modal } from "../ui";

const LIMITE_SALTO_GRANDE_HORAS = 24 * 7; // de +7 dias para cima pede confirmação

const PASSOS: { horas: number; minutos?: number; rotulo: string }[] = [
  { horas: 0, minutos: 15, rotulo: "+15 min" },
  { horas: 0, minutos: 30, rotulo: "+30 min" },
  { horas: 1, rotulo: "+1 hora" },
  { horas: 24, rotulo: "+1 dia" },
  { horas: 72, rotulo: "+3 dias" },
  { horas: 96, rotulo: "+4 dias" },
  { horas: 24 * 7, rotulo: "+7 dias" },
  { horas: 24 * 30, rotulo: "+30 dias" },
];

// Relógio simulado (RET-04): avança o tempo e roda as rotinas (retomada, "Parou de responder", exclusão de arquivados).
export function Relogio() {
  const avisar = useAviso();
  const { dados, recarregar } = useDados<{ agora: string; deslocamentoHoras: number; registros: { id: string; texto: string }[] }>("/api/relogio");
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<(typeof PASSOS)[number] | null>(null);

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
        <Clock className="size-4 text-marca-texto" aria-hidden />
        Relógio do simulador
      </h2>
      <div className="rounded-controle bg-marca-suave p-3">
        <p className="text-2xl font-semibold tabular-nums text-marca-texto">{agora ? formatarDataHora(agora) : "--"}</p>
        <p className="text-xs text-texto-suave">
          {agora && `${formatarDiaSemana(agora)} · `}
          {dados?.deslocamentoHoras ? `${dados.deslocamentoHoras} h à frente do horário real` : "horário real"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PASSOS.map((p) => (
          <Botao key={p.horas} onClick={() => (p.horas >= LIMITE_SALTO_GRANDE_HORAS ? setConfirmar(p) : mudar(p.minutos ? { minutos: p.minutos } : { horas: p.horas }))} disabled={ocupado} className="whitespace-nowrap px-2">
            {p.rotulo}
          </Botao>
        ))}
      </div>
      <p className="text-xs text-texto-fraco">Presença (tarefa 35): ao passar do horário de fechamento da loja todos os vendedores ficam offline; depois da abertura, use +15 min e +30 min para ver a fila ser repartida e o aviso de quem não ficou online.</p>
      <p className="text-xs text-texto-fraco">O relógio só anda para a frente. Para recomeçar do zero, rode <code>npm run seed</code>.</p>
      <p className="text-xs text-texto-fraco">Regras: retomada após 3 dias sem resposta (só cards no &quot;Novo&quot; com o bot atendendo); 4 dias depois vai para &quot;Perdido&quot; com o motivo &quot;Parou de responder&quot; (PROVISÓRIO); arquivados excluídos em 30 dias.</p>
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
      <Modal aberto={!!confirmar} aoFechar={() => setConfirmar(null)} titulo={`Avançar o relógio ${confirmar?.rotulo ?? ""}?`} largura="max-w-md">
        <p className="text-sm text-texto-suave">O relógio só anda para a frente. As rotinas rodam: retomadas, &quot;Parou de responder&quot; e exclusão de arquivados com mais de 30 dias. Para voltar, só recomeçando os dados de teste.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setConfirmar(null)}>Cancelar</Botao>
          <Botao
            onClick={() => {
              const passo = confirmar!;
              setConfirmar(null);
              void mudar({ horas: passo.horas });
            }}
          >
            Avançar {confirmar?.rotulo}
          </Botao>
        </div>
      </Modal>
    </aside>
  );
}
