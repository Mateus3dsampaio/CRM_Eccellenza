// Gera a imagem de teste de uma planta de cozinha com medidas (fictícia), usada pelo cliente-simulado.
// Uso: npx tsx scripts/gerar-planta.ts
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";

const html = `<!doctype html><html><body style="margin:0;background:#fff;font-family:Arial">
<svg width="800" height="560" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="800" height="560" fill="#fafafa"/>
  <text x="400" y="40" font-size="26" text-anchor="middle" font-weight="bold">PLANTA – COZINHA (sem escala)</text>
  <rect x="150" y="110" width="500" height="330" fill="none" stroke="#222" stroke-width="8"/>
  <rect x="160" y="120" width="480" height="60" fill="#d9d9d9" stroke="#555"/>
  <text x="400" y="157" font-size="18" text-anchor="middle">bancada da pia</text>
  <line x1="150" y1="90" x2="650" y2="90" stroke="#c00" stroke-width="2"/>
  <text x="400" y="82" font-size="24" text-anchor="middle" fill="#c00">3,20 m</text>
  <line x1="680" y1="110" x2="680" y2="440" stroke="#c00" stroke-width="2"/>
  <text x="725" y="282" font-size="24" text-anchor="middle" fill="#c00">2,10 m</text>
  <rect x="300" y="436" width="120" height="10" fill="#fff" stroke="#222"/>
  <text x="360" y="480" font-size="18" text-anchor="middle">porta</text>
  <text x="400" y="540" font-size="16" text-anchor="middle" fill="#666">Imagem fictícia para testes do simulador</text>
</svg></body></html>`;

async function main() {
  await mkdir("testes/imagens", { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 800, height: 560 } });
  await pagina.setContent(html);
  await pagina.screenshot({ path: "testes/imagens/planta-cozinha.png" });
  await navegador.close();
  console.log("Gerado: testes/imagens/planta-cozinha.png");
}

main();
