import { Suspense } from "react";
import { redirect } from "next/navigation";
import { modoSimulador } from "@/lib/modo";
import { usuarioAtual } from "@/lib/sessao";
import { Cabecalho } from "@/componentes/cabecalho";
import { MenuLateral } from "@/componentes/menu-lateral";
import { ProvedorAvisos, ProvedorVersao } from "@/componentes/dados";
import { ProvedorAlertas } from "@/componentes/alertas/provedor";
import { ProvedorEspera } from "@/componentes/espera";
import { ProvedorRetornos } from "@/componentes/retornos";
import { ProvedorEtapas } from "@/componentes/etapas";
import { ProvedorVendas } from "@/componentes/vendas/regras";
import { ProvedorUsuario } from "@/componentes/usuario";
import { ProvedorGaveta } from "@/componentes/ficha/gaveta";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  const simulador = modoSimulador();
  return (
    <ProvedorUsuario usuario={usuario}>
      <ProvedorVersao>
        <ProvedorAvisos>
          <ProvedorEspera>
            <ProvedorVendas>
              <ProvedorEtapas>
              <ProvedorRetornos>
                <ProvedorAlertas>
                  {/* Gaveta do lead (?lead=ID) por cima de qualquer tela. Suspense: lê a URL no cliente. */}
                  <Suspense>
                  <ProvedorGaveta>
                  <div className="flex min-h-dvh">
                    <MenuLateral simulador={simulador} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Cabecalho simulador={simulador} />
                      <main className="flex min-h-0 flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
                    </div>
                  </div>
                  </ProvedorGaveta>
                  </Suspense>
                </ProvedorAlertas>
              </ProvedorRetornos>
              </ProvedorEtapas>
            </ProvedorVendas>
          </ProvedorEspera>
        </ProvedorAvisos>
      </ProvedorVersao>
    </ProvedorUsuario>
  );
}
