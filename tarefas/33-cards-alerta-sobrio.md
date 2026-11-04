# Tarefa 33 – Cards do kanban: alerta de espera mais sóbrio

Série de layout (23–33). Fazer por último. **Status: código feito em 04/11/2026, SEM print antes/depois e sem teste de tela** (o Mateus pediu para parar). Critério do crítico (`idsCriticosDaColuna` em `regras/espera.ts`, PROVISÓRIO): o vermelho que espera há mais tempo na coluna, ou qualquer um com 24 h+. Falta: conferir o visual no kanban e rodar `npm run test:tela`. O Mateus aprovou em 04/11/2026, mas o visual final é dele: entregar prints "antes e depois" para ele bater o martelo antes de dar como pronta.

## Problema
Card inteiro vermelho quando o cliente espera além do prazo. Com três assim na mesma coluna, a coluna grita e os cards normais somem.

## O que fazer
- **Amarelo** (passou do primeiro prazo): borda esquerda grossa amarela + badge "esperando há 12 min" amarelo. Fundo do card normal.
- **Vermelho** (passou do segundo prazo): borda esquerda grossa vermelha + badge vermelho + sombra levemente avermelhada. Fundo normal.
- **Vermelho crítico** (o mais atrasado da coluna, ou acima de 24 h – escolher um critério e deixar em `regras/limite-bot.ts` ou `regras/espera.ts`, documentado): mantém o fundo vermelho de hoje. Assim o pior caso continua saltando aos olhos.
- Os prazos (10/30 min, Configurações > Geral) continuam os mesmos.
- Guardar as cores novas nos tokens; nada solto no código.
- Gravar prints antes/depois em `docs/rodadas/` para a decisão do Mateus.

## Onde mexer
`src/componentes/kanban/card.tsx`, tokens em `src/app/globals.css` / `src/componentes/estilos.ts`, regra do "crítico" em `src/regras/`.

## Testes
- Unitário da regra do crítico.
- Tela: coluna com três cards atrasados mostra só um com fundo vermelho.

## Pronto quando
Uma coluna com vários atrasos continua legível, e o Mateus escolheu o visual pelos prints.
