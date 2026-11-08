// Gera docs/contrato-do-bot.md (tarefa 38). Uso: npm run contrato:bot
// Rode sempre que mudar ferramenta, aviso que o bot recebe, regra automática ou o Manual do CRM.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { montarContratoDoBot } from "../src/bot/contrato";

const destino = path.join(process.cwd(), "docs", "contrato-do-bot.md");
writeFileSync(destino, montarContratoDoBot(), "utf8");
console.log(`Contrato do bot gerado em ${path.relative(process.cwd(), destino)}`);
