import { instrucoesAtivas, textoDoManual } from "@/servicos/instrucoes";
import { ABERTURA_DO_PROMPT } from "./avisos";

// BOT-01: o prompt é montado a cada conversa. Tudo o que o bot deve seguir vem do banco e o admin edita em Configurações:
// as instruções numeradas (roteiro, coladas pelo Mateus) e, depois delas, o Manual do CRM (como usar as ferramentas).
// Aqui fica só a abertura fixa (texto em avisos.ts), que protege contra texto do cliente se passando por ordem do sistema e não deve ser editável pela tela.
export async function montarPromptSistema(): Promise<string> {
  const [instrucoes, manual] = await Promise.all([instrucoesAtivas(), textoDoManual()]);

  return [
    ...ABERTURA_DO_PROMPT,
    "",
    "# Instruções de atendimento",
    instrucoes.join("\n\n"),
    "",
    "# Manual do CRM",
    manual,
  ].join("\n");
}
