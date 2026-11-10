# Tarefa 39 – Card do kanban com faixa de ação única

Objetivo: o card ficar mais legível no dia a dia, com as informações em ordem de prioridade e uma cor para cada significado. Exemplo aprovado pelo Mateus em 10/11/2026 (página "Proposta do Kanban", com quatro cenários e comparação com o card antigo).

## Decisões do Mateus (10/11/2026)
- **Fundo vermelho inteiro sai.** Cliente esperando além do prazo ganha a faixa vermelha; só o que espera há mais tempo em cada coluna pulsa. Desfaz o pedido de 04/11 (card vermelho vivo) e a regra "24 h ou mais também é crítico" da tarefa 33.
- **Textos da faixa** aprovados: "Responder · há 2 d", "Responder com modelo · há 2 d" (janela de 24h fechada), "IA sem resposta · assuma a conversa", "Na fila · sem consultor", "Decidir: a medição aconteceu?", "Decidir: o cliente veio?", "Decidir: fechou?", "Marcar data na agenda", "Retorno atrasado desde 06/11", "Retorno hoje 15:30", "IA atendendo", "Aguardando o cliente". São lidos só pelo vendedor.
- **Consultor só com iniciais** no rodapé (nome ao passar o mouse).
- **Cidade sem destaque**, na mesma linha do valor.

## Código de cores
Vermelho = cliente sem resposta além do prazo, ou IA travada. Âmbar = pendência do vendedor. Azul = é para hoje. Verde = combinado e em dia. Cinza = nada a fazer agora.

## Etapas
- [x] 1. Regra `acoesDoCard` em `src/regras/acao-card.ts` (pendências em ordem de gravidade, cor, texto, "precisa de você"), com testes (`testes/unit/acao-card.test.ts`).
- [x] 2. Card novo (`src/componentes/kanban/card.tsx`): nome em uma linha com selo de quem atende, faixa de ação, última mensagem em duas linhas, valor · cidade · ambientes, rodapé com etiquetas, anel da janela, iniciais do consultor e menu.
- [x] 3. Movimento: só o card crítico pulsa, um por coluna (`idsCriticosDaColuna`); nada pisca dentro do card. Relógio da janela sem piscar e com texto só quando falta pouco.
- [x] 4. Coluna (`quadro.tsx`): divisor "Precisa de você" / "Aguardando o cliente", "N esperando" e soma dos orçamentos no cabeçalho.
- [x] 5. Documentação: mapa do código, `docs/design.md` e pendências.

## Ajustes depois da primeira conferência (Mateus, 10/11/2026)
- [x] Anel da janela de 24h com lugar fixo: sempre no canto esquerdo do rodapé (antes ficava "solto" nos cards sem consultor).
- [x] Ícones de volta ao lado da cidade e dos ambientes.
- [x] O card cresce na altura para caber tudo, sem cortar nome, cidade, investimento e ambientes.

## Ficou de fora (não estava no exemplo aprovado)
- Avisos do canto inferior direito cobrindo a coluna Negociação.
- "Esperando" repetido no topo e na linha de filtros.
- Tema claro e as outras paletas não foram conferidos com o card novo.

## Pronto quando
O Mateus usa o kanban no simulador e confirma que bate com o exemplo aprovado.
