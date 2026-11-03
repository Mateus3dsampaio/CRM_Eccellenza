import { rota } from "@/lib/api";
import { agora } from "@/lib/relogio";
import { exigirUsuario } from "@/lib/sessao";
import { versaoAtual } from "@/lib/versao";
import { avisarPrazosVermelhos, avisarRetornos } from "@/servicos/alertas";

export const dynamic = "force-dynamic";

// As telas consultam a versão a cada poucos segundos e recarregam os dados quando muda (KAN-05).
export const GET = rota(async () => {
  await exigirUsuario();
  // O tempo passa sem ninguém mexer em nada: é aqui que o prazo vermelho de um lead esperando é notado (ESP-09).
  // Se a checagem falhar, a atualização das telas não pode parar junto.
  await avisarPrazosVermelhos().catch((erro) => console.error("[versao] falha ao checar prazos de espera:", erro));
  await avisarRetornos().catch((erro) => console.error("[versao] falha ao checar retornos:", erro));
  return { versao: await versaoAtual(), agora: (await agora()).toISOString() };
});
