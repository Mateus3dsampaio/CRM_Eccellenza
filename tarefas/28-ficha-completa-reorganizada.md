# Tarefa 28 – Ficha completa reorganizada

Série de layout (23–33). Fazer **depois** da tarefa 23 (gaveta), porque a ficha completa passa a ser a tela de edição pesada. **Status: a fazer.**

## Problemas
- Dois cabeçalhos empilhados ("Ficha do lead" na barra + nome/avatar/ações logo abaixo).
- Quatro botões de ação na frente, três deles raros (Personalizar layout, Exportar dados, Excluir).
- "Dados do lead" com dez linhas "não informado" ocupa um quadro inteiro para dizer quase nada.
- Três quadros quase vazios (Medição e visita, Apresentação, Medidas), cada um com seu espaço.
- Notas e Histórico ficam abaixo da dobra.

## O que fazer
- Na tela da ficha, a **barra de cima mostra o nome do cliente** (com avatar pequeno e etapa) no lugar de "Ficha do lead". O cabeçalho interno some; o "←" fica na barra.
- Ações: **Arquivar/Restaurar** visível; "Personalizar layout" (admin), "Exportar dados" (LGPD) e "Excluir" num menu **"⋯"**. Excluir continua com a confirmação atual.
- **Dados do lead**: campos vazios aparecem esmaecidos e recolhidos atrás de "Mostrar campos vazios (7)"; os preenchidos ficam sempre visíveis. O botão "Editar" continua mostrando todos.
- Quadro único **"Compromissos"** com três linhas (Visita à loja, Medição, Apresentação), cada uma com data/hora ou "não marcada" e seu botão Agendar/Cancelar. Substitui os dois quadros atuais. "Medidas" continua quadro próprio.
- Painel da conversa ganha **abas "Conversa | Notas | Histórico"**; os quadros separados de Notas e Histórico saem da grade. A bolinha de notas mostra a contagem.
- Atualizar `LAYOUT_PADRAO_FICHA` em `src/regras/layout-ficha.ts` com os blocos novos (conversa maior, resumo, etapa, compromissos, dados, medidas). Layout personalizado salvo pelo admin que cite bloco que não existe mais: ignorar o bloco e avisar uma vez ("layout salvo foi ajustado").
- Celular: abas Conversa / Ficha / Notas continuam; "Compromissos" entra na aba Ficha.

## Onde mexer
`src/componentes/ficha/ficha.tsx`, `dados-lead.tsx`, `conversa.tsx`, `src/componentes/cabecalho.tsx` (título dinâmico), `src/regras/layout-ficha.ts`.

## Testes e documentação
- Unitários de `layout-ficha` (limpar layout com bloco inexistente).
- Tela: nome do cliente na barra; menu "⋯" tem Exportar e Excluir; "Mostrar campos vazios" alterna; abas do painel da conversa.
- `docs/mapa-do-codigo.md` e `docs/requisitos.md` (FICHA-xx que citem blocos).

## Pronto quando
Abrindo a ficha de um lead novo, o que se vê primeiro é a conversa, o resumo e o que está preenchido; o resto está a um clique, sem quadro vazio ocupando tela.
