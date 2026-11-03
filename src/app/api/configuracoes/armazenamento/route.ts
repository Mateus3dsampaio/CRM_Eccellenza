import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { armazenamento } from "@/servicos/midias";

export const dynamic = "force-dynamic";

// Espaço que as mídias ocupam no disco (só admin).
export const GET = rota(async () => {
  await exigirUsuario("configurar");
  return armazenamento();
});
