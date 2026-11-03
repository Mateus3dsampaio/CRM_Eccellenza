# Rodada 06 – Ajustes em todas as telas (revisão do designer sobre prints)

Origem: revisão do `designer` em login, kanban, ficha, agenda, painel, arquivados, configurações e simulador (prints 1440×900 e 1280×720). O Mateus liberou a **etapa 2** e aprovou a ficha lado a lado. Pelo `docs/design.md`, a etapa 2 começa com 2 direções visuais em prints para o Mateus escolher; isso fica para a rodada seguinte.

## Rodada A – feito
- **Painel:** "Resultado" (total em negociação, vendido, motivos de perda) agora vem primeiro; seções com título. A variação diz "+2 em relação ao período anterior (era 1)". A cor segue o sentido bom/ruim de cada indicador. **PROVISÓRIO (Mateus confirmar):** só "Sem resposta" é pior ao subir; "Curiosos" e "Outras cidades" ficam neutros. "Total vendido" só fica verde quando maior que zero. Largura igual à da agenda.
- **Ações destrutivas:** Excluir na ficha e em Arquivados virou botão discreto em vermelho e afastado; lixeira da aba Vendas afastada e com tooltips em todos os ícones; relógio do simulador pede confirmação a partir de +7 dias.
- **Ficha:** padrão passa a conversa à esquerda e ficha à direita; o campo de resposta aparece sem rolar em 1280×720. Layouts já personalizados pelo admin continuam valendo.
- **Agenda:** coluna de hoje destacada (relógio do servidor); "+" de bloquear só no hover (sempre visível em tela de toque).
- **Menu e abas:** em telas médias o item ativo mostra o nome e todos têm tooltip; abas do painel, da agenda e da ficha (celular) usam o mesmo "ativo" claro do menu.

## Não feito nesta rodada
- Agenda: cor da visita por consultor; bloqueio de 2 h como bloco único (muda a estrutura da grade).
- Painel: gráfico no tempo, funil com cores das etapas, agrupamento em 3 números grandes.
- Chips de filtro do kanban e da agenda continuam em azul-marinho cheio (são botões liga/desliga, não abas).
- Datas De/Até do painel e da exportação aparecem como mm/dd nos prints; provavelmente é o idioma do navegador de teste. **Mateus precisa conferir no navegador dele.**
- Itens de Configurações e Simulador (lista de instruções compacta, estado vazio do chat, etc.).
- **Etapa 2:** profundidade, botões em relevo, animações e a coreografia do arrasto.

## Verificação
`tsc` e `eslint` limpos. `vitest`: 109 passam, 1 falha já existente (`mapa.test.ts` não acha `src/app/api/midias/[nome]/route.ts`). Prints conferidos: ficha, agenda e painel em 1440×900 e 1280×720. Os revisores do `/ciclo` não foram chamados.
