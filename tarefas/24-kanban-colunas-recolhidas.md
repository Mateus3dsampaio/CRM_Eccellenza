# Tarefa 24 – Kanban: todas as colunas úteis na tela

Série de layout (23–33). **Status: feito em 04/11/2026.** Decisões na implementação: em 1440 com o menu aberto, 5 colunas de 280px não cabem de jeito nenhum (sobram ~1190px úteis); a saída foi coluna de 264px + zoom **automático** ("Ajustar à tela", ícone ao lado do −/+, padrão para quem nunca mexeu no zoom), que encolhe até 75% para as colunas abertas caberem. Em 1440 fica em 79% com as 7 colunas visíveis; em 1280 fica em 75% e só Fechado/Perdido ficam na rolagem. Quem preferir texto maior aperta + (vira zoom fixo, como antes). Colunas recolhidas só no computador; a escolha fica salva por pessoa.

## Problema
Em 1440×900 só 4 das 7 colunas aparecem. Negociação (onde está o dinheiro), Fechado e Perdido ficam escondidas na rolagem horizontal.

## O que fazer
- **Fechado e Perdido viram colunas recolhidas**: uma faixa vertical fina (~44px) com o nome escrito na vertical e o contador. Clique expande a coluna no lugar; clicar de novo recolhe. A escolha fica salva por pessoa (`localStorage`), igual ao menu encolhido.
- Arrastar um card por cima de uma coluna recolhida expande ela sozinha enquanto o card está em cima (para soltar lá).
- Largura mínima das colunas abertas um pouco menor (≈280px) para IA atendendo, Em qualificação, Medição, Apresentação e Negociação caberem juntas em 1440; em 1280 pode sobrar rolagem só da última.
- Manter o zoom existente (`zoom.ts`); ele continua valendo.
- Celular: sem mudança (já usa abas por etapa).

## Onde mexer
`src/componentes/kanban/quadro.tsx` (colunas) e tokens de largura em `src/componentes/estilos.ts` / tokens CSS.

## Testes e documentação
- Teste de tela: em 1440×900 as 5 colunas abertas aparecem sem rolagem; Fechado e Perdido aparecem recolhidas com contador; clique expande.
- `docs/mapa-do-codigo.md` se houver arquivo novo; `docs/design.md` (parte 1) ganha uma linha sobre colunas recolhidas.

## Pronto quando
Abrindo o kanban em 1440×900 dá para ver Negociação sem rolar, e o total de Fechado/Perdido continua visível.
