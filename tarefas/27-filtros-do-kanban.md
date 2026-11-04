# Tarefa 27 – Filtros do kanban em popover com chips

Série de layout (23–33). **Status: a fazer.**

## Problema
A linha de filtros já tem busca, "Esperando resposta", chips de consultor, zoom, Filtros e Selecionar. Clicar em "Filtros" abre uma segunda linha inteira com dois selects e "Limpar filtros". Dois níveis para pouca coisa.

## O que fazer
- "Filtros" abre um **popover ancorado no botão** (etiqueta, cidade; e consultor para quem não é admin). Fecha com Esc e clique fora.
- Filtro escolhido vira um **chip com "x"** ao lado da busca ("Etiqueta: Arquiteto ×", "Cidade: Crato ×"). O botão "Filtros" mostra a contagem ("Filtros · 2") como hoje.
- Zoom (−/100%/+) sai da linha principal: vira um ícone de lupa/porcentagem que abre o mesmo controle, ou entra no popover de filtros como "Tamanho dos cards". Escolha a que ficar mais limpa.
- Ordem da linha: busca · Esperando resposta (N) · chips de consultor (Todos/Beatriz/Rafael) · chips de filtros ativos · … · Filtros · Selecionar.
- Celular: popover vira folha de baixo (bottom sheet) com os mesmos campos.

## Onde mexer
`src/componentes/kanban/quadro.tsx` (barra de filtros) e `src/componentes/ui.tsx` se precisar de um `Popover` genérico (reaproveitar nas tarefas 26 e 28).

## Testes
- Tela: abrir Filtros, escolher cidade, popover fecha, chip aparece, "x" tira o filtro e o contador volta a zero.

## Pronto quando
A barra de filtros é uma linha só, e dá para ver quais filtros estão ligados sem abrir nada.
