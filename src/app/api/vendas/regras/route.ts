import { rota } from "@/lib/api";
import { exigeRetorno } from "@/regras/vendas";
import { exigirUsuario } from "@/lib/sessao";
import { exigirContatoNegociacao, motivosDePerda } from "@/servicos/vendas";

export const dynamic = "force-dynamic";

// Regras de vendas que a tela precisa para montar a janela de mover e o destaque do card. Qualquer usuário logado lê.
export const GET = rota(async () => {
  await exigirUsuario();
  const exigirNegociacao = await exigirContatoNegociacao();
  return { exigirContatoNegociacao: exigirNegociacao, retornoObrigatorio: { orcamento: exigeRetorno("orcamento"), negociacao: exigirNegociacao }, motivos: await motivosDePerda() };
});
