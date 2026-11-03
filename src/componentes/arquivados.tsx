"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { DIAS_ARQUIVADO_ATE_EXCLUIR } from "@/regras/limpeza";
import { DIA, formatarData } from "@/regras/tempo";
import { chamarApi, useAviso, useDados, useVersao } from "./dados";
import { AvisoMidias } from "./midias/aviso-midias";
import { Avatar, Botao, Carregando, EstadoErro, EstadoVazio, Modal } from "./ui";
import { usePode } from "./usuario";

interface Arquivado { id: string; nome: string; telefone: string; cidade: string | null; avatarCor: number; arquivadoEm: string; previa: string | null }

// Lista de arquivados: consultar, restaurar e (só o admin) excluir (LIMP-03, LIMP-05).
export function Arquivados() {
  const { dados, erro, carregando, recarregar } = useDados<{ leads: Arquivado[] }>("/api/arquivados");
  const { agora } = useVersao();
  const avisar = useAviso();
  const podeExcluir = usePode("excluir_lead");
  const [excluir, setExcluir] = useState<Arquivado | null>(null);

  async function restaurar(id: string) {
    try {
      await chamarApi(`/api/leads/${id}`, { method: "PATCH", json: { restaurar: true } });
      avisar("Lead restaurado ao kanban.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível restaurar.", "erro");
    } finally {
      await recarregar();
    }
  }

  function diasRestantes(arquivadoEm: string) {
    const base = agora ? new Date(agora).getTime() : new Date(arquivadoEm).getTime();
    return Math.max(0, DIAS_ARQUIVADO_ATE_EXCLUIR - Math.floor((base - new Date(arquivadoEm).getTime()) / DIA));
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="sr-only">Arquivados</h1>
        <p className="text-sm text-texto-suave">Leads arquivados saem do kanban e são excluídos de vez {DIAS_ARQUIVADO_ATE_EXCLUIR} dias depois, com mensagens e mídias.</p>
      </div>
      {carregando && !dados ? (
        <Carregando linhas={3} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : !dados?.leads.length ? (
        <EstadoVazio titulo="Nenhum lead arquivado" icone={<Archive className="size-6 text-texto-fraco" aria-hidden />} />
      ) : (
        <ul className="space-y-2">
          {dados.leads.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-card border border-borda bg-superficie p-3 shadow-card">
              <Avatar nome={l.nome} cor={l.avatarCor} />
              <Link href={`/lead/${l.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.nome}</p>
                <p className="truncate text-xs text-texto-suave">
                  {l.telefone}
                  {l.cidade && ` · ${l.cidade}`} · arquivado em {formatarData(new Date(l.arquivadoEm))} · excluído em {diasRestantes(l.arquivadoEm)} dia(s)
                </p>
              </Link>
              <div className="flex gap-2">
                <Botao onClick={() => restaurar(l.id)} icone={<ArchiveRestore className="size-4" aria-hidden />}>
                  Restaurar
                </Botao>
                {podeExcluir && (
                  <Botao variante="fantasma" className="ml-3 text-alerta hover:bg-alerta-suave hover:text-alerta" onClick={() => setExcluir(l)} icone={<Trash2 className="size-4" aria-hidden />}>
                    Excluir
                  </Botao>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal aberto={!!excluir} aoFechar={() => setExcluir(null)} titulo="Excluir de vez" largura="max-w-md">
        <p className="text-sm text-texto-suave">Excluir {excluir?.nome}? Mensagens, fotos, vídeos e PDFs também serão apagados. Não dá para desfazer.</p>
        {excluir && <AvisoMidias alvo={{ ids: [excluir.id] }} />}
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setExcluir(null)}>Cancelar</Botao>
          <Botao
            variante="perigo"
            onClick={async () => {
              try {
                await chamarApi("/api/leads/acoes", { method: "POST", json: { acao: "excluir", ids: [excluir!.id] } });
                avisar("Lead excluído.");
              } catch (e) {
                avisar(e instanceof Error ? e.message : "Não foi possível excluir.", "erro");
              } finally {
                setExcluir(null);
                await recarregar();
              }
            }}
          >
            Excluir
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
