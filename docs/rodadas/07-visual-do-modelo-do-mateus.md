# Rodada 07 – Visual do modelo do Mateus (etapa 2, base e casca)

Origem: o Mateus enviou `crm_modelo_pc.html` e pediu o menu lateral e o design parecidos. Decisões dele: **só tema escuro**, **gaveta rápida + página completa da ficha**, **só a paleta azul "Atual"**.

## Feito
- **Tokens (`tokens.css`):** paleta do modelo (fundo, menu, painel, card, bordas, texto) e cores de etapa do modelo. O tema claro e o botão de tema saíram. Novos tokens: `lateral`, `marca-texto`, `marca-lado`, `sobre-cor` (texto escuro sobre cor clara), `perigo`, sombras de tecla e `afundado`, curva `mola`.
- **Botões em "tecla" (`globals.css`, `Botao`):** primário, secundário e perigo têm lateral sólida e afundam ao clicar (90 ms). Classe `afundado` para selecionado.
- **Casca:** novo `menu-lateral.tsx` (indicador que desliza, encolher com a escolha guardada, celular com barra de baixo). `cabecalho.tsx` virou barra de cima com título e ações.
- Títulos das páginas ficaram só para leitor de tela (o título aparece na barra de cima).
- Correção: rótulo dos campos colado no campo (era um `span` inline); foco dos campos mais suave.

## Ainda não feito (próximas rodadas)
- Kanban: cabeçalho da coluna com bolinha, contador em pílula e total em R$; coreografia do arrasto do modelo; filtros em pílula; cards no estilo do modelo mantendo espera, não lidas, retorno, visita e erro do bot.
- Gaveta rápida do lead (o card abre a gaveta; botão para a ficha completa).
- Painel: cards de indicador com brilho que segue o mouse; abas deslizantes (Dia/Semana, períodos).
- Agenda, Configurações, Simulador e Login no mesmo estilo; `Botao` já vale em todas.
- Hoje o único "ativo" deslizante é o do menu lateral; as abas internas ainda usam o estilo claro de antes.

## Pontos de atenção
- **Contraste:** texto branco sobre o azul `#3f74ec` dá cerca de 4,3:1, um pouco abaixo de 4,5:1 (AA) para texto pequeno. Está igual ao modelo; se o Mateus quiser AA estrito, escurecer o azul um tom.
- Testes de tela (`npm run test:tela`) não foram rodados: eles mudam dados do banco e regravam prints em `docs/`.
- `tsc` e `eslint` limpos; `vitest`: 109 passam e 1 falha antiga (`mapa.test.ts`, rota `midias/[nome]`).
