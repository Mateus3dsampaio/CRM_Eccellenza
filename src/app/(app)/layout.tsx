import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao";
import { Cabecalho } from "@/componentes/cabecalho";
import { ProvedorAvisos, ProvedorVersao } from "@/componentes/dados";
import { ProvedorAlertas } from "@/componentes/alertas/provedor";
import { ProvedorEspera } from "@/componentes/espera";
import { ProvedorRetornos } from "@/componentes/retornos";
import { ProvedorVendas } from "@/componentes/vendas/regras";
import { ProvedorUsuario } from "@/componentes/usuario";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return (
    <ProvedorUsuario usuario={usuario}>
      <ProvedorVersao>
        <ProvedorAvisos>
          <ProvedorEspera>
            <ProvedorVendas>
              <ProvedorRetornos>
                <ProvedorAlertas>
                  <div className="flex min-h-dvh flex-col">
                    <Cabecalho />
                    <main className="flex min-h-0 flex-1 flex-col pb-20 md:pb-0">{children}</main>
                  </div>
                </ProvedorAlertas>
              </ProvedorRetornos>
            </ProvedorVendas>
          </ProvedorEspera>
        </ProvedorAvisos>
      </ProvedorVersao>
    </ProvedorUsuario>
  );
}
