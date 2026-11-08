import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { usarManualDoCodigo } from "@/servicos/instrucoes";

// Volta o Manual do CRM para o texto do código (tarefa 38). O texto da tela fica como versão anterior.
export const POST = rota(async () => {
  await exigirUsuario("configurar");
  return { instrucao: await usarManualDoCodigo() };
});
