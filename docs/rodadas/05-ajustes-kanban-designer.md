# Rodada 05 – Ajustes do kanban a partir da revisão do designer

Origem: revisão do agente `designer` feita sobre prints (1440×900 e 1280×720). O Mateus aprovou os itens 1, 4 e 5.

## O que foi feito
- **Topo do quadro (item 1):** busca, "Esperando resposta", "Meus leads" / filtro de consultor, zoom, Filtros e Selecionar agora ficam numa linha só. O título "Atendimentos" ficou só para leitor de tela (`sr-only`). Em 1280×720 as colunas começam em y=141 (antes 253) e o primeiro card em y=223 (antes 336).
- **Nome do lead (item 5):** o nome aceita até 2 linhas e a linha de cima do card não reserva mais largura para o menu ⋮ (que fica no canto de baixo).
- **Sino repetido (parte do item 4):** o sino do card não aparece quando o card já mostra "esperando há X".

## Não feito (decisão do Mateus pendente)
- **Cor do card por espera (item 4, restante):** a revisão sugeriu fundo branco e faixa lateral, com rosa só acima de 24 h. Isso muda o ESP-08 (pedido dele). A causa do excesso de vermelho é que os prazos de **10 min (amarelo) e 30 min (vermelho) são PROVISÓRIOS**. Decisão do Mateus: ajustar os prazos em Configurações ou mudar o visual.

## Fora desta rodada (da revisão, não escolhidos)
Coreografia do arrasto (card flutuante 10% mais largo, origem sem tracejado, sem vão no destino), total em R$ e contador animado por coluna, card denso, menu ⋮ só no hover, hover animando `box-shadow`, estado "afundado" nos botões, degradês de rolagem, zoom que desloca a borda das colunas.

## Verificação
- `tsc --noEmit` e `eslint` limpos nos arquivos do kanban. `vitest`: 109 passam, 1 falha já existente (`testes/unit/mapa.test.ts` não acha `src/app/api/midias/[nome]/route.ts`; não relacionada).
- Prints novos conferidos nos dois tamanhos. Os revisores do `/ciclo` não foram chamados: a mudança é só de layout do kanban.
- O `designer` não tem Playwright nesta sessão; a revisão dele foi feita sobre prints tirados pelo orquestrador.
