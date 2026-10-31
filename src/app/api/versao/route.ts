import { rota } from "@/lib/api";
import { agora } from "@/lib/relogio";
import { exigirUsuario } from "@/lib/sessao";
import { versaoAtual } from "@/lib/versao";

export const dynamic = "force-dynamic";

// As telas consultam a versão a cada poucos segundos e recarregam os dados quando muda (KAN-05).
export const GET = rota(async () => {
  await exigirUsuario();
  return { versao: await versaoAtual(), agora: (await agora()).toISOString() };
});
