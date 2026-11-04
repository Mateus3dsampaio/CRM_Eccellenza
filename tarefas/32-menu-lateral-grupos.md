# Tarefa 32 – Menu lateral: ordem e grupos

Série de layout (23–33). **Status: feito em 04/11/2026.** O traço é desenhado acima do primeiro item de cada grupo (`.antes-traco` em `globals.css`); encolhido vira só um espaço maior. O indicador deslizante passou a medir a posição real do item ativo.

## O que fazer
- Ordem por frequência de uso, em três grupos separados por um traço fino:
  1. Kanban, Agenda, Painel, Galeria
  2. Arquivados
  3. Simulador (some em produção, como hoje)
  Configurações continua embaixo, junto de "Encolher menu".
- O indicador deslizante (`Entalhe`) continua funcionando entre grupos; o traço não conta como item.
- Com o menu encolhido, os traços viram espaçamento maior entre os grupos.
- Tooltip com o nome do item quando encolhido (já existe via `title`; só conferir).

## Onde mexer
`src/componentes/menu-lateral.tsx` (`LINKS` ganha o campo `grupo`), `src/componentes/entalhe/*` se a altura dos itens mudar.

## Testes
- Tela: os traços aparecem; o indicador pousa no item certo em cada grupo, aberto e encolhido.

## Pronto quando
O menu lê de cima para baixo como "trabalho do dia → arquivo → ferramenta de teste → configurações".
