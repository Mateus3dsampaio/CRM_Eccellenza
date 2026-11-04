import { rota } from "@/lib/api";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { enviarPushDeTeste } from "@/servicos/push";

export const dynamic = "force-dynamic";

// "Testar" do sino: manda um aviso de teste, depois de 5 segundos, só para os navegadores de quem pediu.
export const POST = rota(async () => {
  const usuario = await exigirUsuario();
  const n = await enviarPushDeTeste(usuario.id);
  if (!n) throw new ErroHttp(400, "Este navegador ainda não está ligado nos avisos com o CRM fechado.");
  return { ok: true, segundos: 5 };
});
