# Tarefa 30 – Painel: grade que fecha

Série de layout (23–33). **Status: a fazer.**

## Problema
Nove cards pequenos em grade de 4 deixam um órfão sozinho na terceira linha. "Motivos de perda" ocupa um terço da linha de resultado e quase sempre está vazio.

## O que fazer
- Linha **Resultado**: dois cards grandes lado a lado, "Total em negociação" e "Total vendido", com o valor em R$ maior do que hoje. "Motivos de perda" desce para a grade de contadores como card normal (lista curta de motivos quando houver; "nenhum no período" quando não).
- Grade **Leads no período** em **3 colunas** (3×3 com os 9 contadores + motivos de perda = 10 → 3 linhas de 3 e uma de 1; então agrupar: mover "Clientes que faltaram" para a seção "Conversão da agenda", que fica com 3 cards e fecha a linha). Resultado: 3×3 em Leads no período e 1×3 em Conversão da agenda. Nenhum órfão.
- Comparações (+5 / −1) mantêm a cor pelo sentido bom/ruim, como hoje.
- O botão "Exportar desempenho" (hoje aba em Configurações, tarefa 31) aparece aqui no canto direito da linha de filtros, só para admin.

## Onde mexer
`src/componentes/painel/painel.tsx`; `src/componentes/configuracoes/exportar-desempenho.tsx` passa a ser usado pelo painel (ver tarefa 31).

## Testes
- Tela: em 1440 e 1280 nenhuma linha da grade tem card sozinho.

## Pronto quando
O painel cabe em blocos fechados, com os dois valores em R$ dominando a primeira linha.
