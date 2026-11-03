import type { Metadata } from "next";
import { secoesPrivacidade } from "@/regras/privacidade";

export const metadata: Metadata = { title: "Política de privacidade – Eccellenza" };
export const dynamic = "force-dynamic"; // lê as variáveis de ambiente quando a página é pedida

// Página PÚBLICA (a Meta e os clientes precisam abrir sem login). Texto em regras/privacidade.ts.
export default function PaginaPrivacidade() {
  const rascunho = process.env.PRIVACIDADE_APROVADA !== "1";
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Política de privacidade</h1>
      <p className="mt-1 text-sm text-texto-suave">Eccellenza – móveis planejados Italínea, Juazeiro do Norte (CE)</p>
      {rascunho && (
        <p className="mt-4 rounded-controle bg-aviso-suave px-3 py-2 text-sm text-aviso" role="note">
          Rascunho: este texto ainda não foi aprovado pela loja. Os trechos entre colchetes serão preenchidos.
        </p>
      )}
      <div className="mt-6 space-y-6">
        {secoesPrivacidade(process.env.PRIVACIDADE_CONTATO).map((s) => (
          <section key={s.titulo}>
            <h2 className="text-lg font-semibold">{s.titulo}</h2>
            {s.paragrafos.map((p) => (
              <p key={p} className="mt-2 leading-relaxed text-texto-suave">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
