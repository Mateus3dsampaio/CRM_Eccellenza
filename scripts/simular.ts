// Conversa com o bot pelo terminal, sem a tela (CHAT-02). O sistema precisa estar rodando (npm run dev).
// Uso:
//   npm run simular -- mensagem <telefone> "<texto>" [--nome "Nome"] [--imagem caminho.png]
//   npm run simular -- lead <telefone>
//   npm run simular -- relogio <horas>
//   npm run simular -- agenda
import { readFile } from "node:fs/promises";

const BASE = process.env.CRM_URL ?? "http://127.0.0.1:3000";

function opcao(args: string[], nome: string): string | undefined {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const [acao, ...resto] = process.argv.slice(2);
  let corpo: Record<string, unknown>;
  switch (acao) {
    case "mensagem": {
      const [telefone, texto] = resto;
      const imagem = opcao(resto, "imagem");
      corpo = { acao, telefone, texto: texto?.startsWith("--") ? undefined : texto, nome: opcao(resto, "nome") };
      if (imagem) {
        corpo.imagemBase64 = (await readFile(imagem)).toString("base64");
        corpo.imagemTipo = imagem.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      }
      break;
    }
    case "lead":
      corpo = { acao, telefone: resto[0] };
      break;
    case "relogio":
      corpo = { acao, horas: Number(resto[0]) };
      break;
    case "agenda":
      corpo = { acao };
      break;
    default:
      console.log("Ações: mensagem <telefone> \"texto\" [--nome N] [--imagem arq] | lead <telefone> | relogio <horas> | agenda");
      process.exit(1);
  }
  const resposta = await fetch(`${BASE}/api/teste`, { method: "POST", headers: { "Content-Type": "application/json", "x-crm-teste": "simulador" }, body: JSON.stringify(corpo) });
  const json = await resposta.json();
  if (acao === "mensagem" && resposta.ok) {
    for (const r of json.respostas ?? []) console.log(`BOT: ${r}\n`);
    if (!json.respostas?.length) console.log("(bot não respondeu)");
    if (json.erro) console.log(`ERRO DO BOT: ${json.erro}`);
  } else {
    console.log(JSON.stringify(json, null, 2));
  }
  if (!resposta.ok) process.exit(1);
}

main().catch((erro) => {
  console.error("Falha ao falar com o sistema. Ele está rodando (npm run dev)?", erro instanceof Error ? erro.message : "");
  process.exit(1);
});
