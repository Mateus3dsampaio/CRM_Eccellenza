"use client";

import { LayoutDashboard, Shuffle, UtensilsCrossed, Users } from "lucide-react";
import { useDados } from "../dados";
import { Carregando, EstadoErro } from "../ui";

interface Dados {
  equipe: { id: string; nome: string; login: string; perfil: string; ativo: boolean }[];
}

// Próximas opções do painel (etapas combinadas com o Mateus). Entram aqui conforme forem prontas.
const EM_BREVE: { titulo: string; texto: string; icone: typeof Shuffle; pronto?: boolean }[] = [
  { titulo: "Distribuição de leads", texto: "Rodízio: o primeiro lead vai para o vendedor 1, o segundo para o vendedor 2, e assim por diante.", icone: Shuffle },
  { titulo: "Horário de almoço", texto: "Quem sai para o almoço deixa de receber leads novos até voltar.", icone: UtensilsCrossed },
  { titulo: "Layout da ficha do lead", texto: "Pronto: abra qualquer lead e use \"Personalizar layout\". O que você salvar vale para todos.", icone: LayoutDashboard, pronto: true },
];

export function Configuracoes() {
  const { dados, erro, carregando, recarregar } = useDados<Dados>("/api/configuracoes");
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-texto-suave">Só o administrador vê esta tela.</p>
      </div>

      <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Users className="size-4 text-texto-suave" aria-hidden /> Equipe
        </h2>
        {carregando && !dados ? (
          <Carregando linhas={3} />
        ) : erro && !dados ? (
          <EstadoErro texto={erro} aoTentar={recarregar} />
        ) : (
          <ul className="divide-y divide-borda">
            {dados?.equipe.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{u.nome}</p>
                  <p className="text-xs text-texto-fraco">Login: {u.login}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-pilula bg-marca-suave px-2.5 py-1 font-medium text-marca">{u.perfil === "admin" ? "Administrador" : "Consultor"}</span>
                  {!u.ativo && <span className="rounded-pilula bg-superficie-suave px-2.5 py-1 text-texto-suave">Inativo</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {EM_BREVE.map(({ titulo, texto, icone: Icone, pronto }) => (
          <section key={titulo} className="rounded-painel border border-dashed border-borda-forte bg-superficie p-4 opacity-80">
            <Icone className="mb-2 size-5 text-texto-suave" aria-hidden />
            <h2 className="text-sm font-semibold">{titulo}</h2>
            <p className="mt-1 text-xs text-texto-suave">{texto}</p>
            <p className="mt-2 text-xs font-medium text-texto-fraco">{pronto ? "Disponível" : "Em breve"}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
