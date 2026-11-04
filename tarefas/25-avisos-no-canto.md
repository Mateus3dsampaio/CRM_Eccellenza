# Tarefa 25 – Avisos (toasts) fora do caminho

Série de layout (23–33). **Status: feito em 04/11/2026.** Decisões na implementação: toast de aviso (prazo, retorno, mensagem) ganha botão "Abrir" que abre a gaveta do lead na tela atual; grupo ("5 clientes passaram do prazo") não tem botão, porque "Esperando" e "Retornos" na barra já listam. Lead com a gaveta aberta não gera toast dele.

## Problema
Vários avisos "passou do prazo sem resposta" empilham no meio do kanban, em cima dos cards, e ficam lá. O sino já mostra a contagem; o toast só precisa chamar atenção uma vez.

## O que fazer
- Toasts no **canto inferior direito**, empilhados de baixo para cima, largura fixa (~380px).
- **Agrupar** avisos do mesmo tipo que chegam juntos: "5 clientes passaram do prazo sem resposta" com botão "Ver" que abre o sino. Nunca mais de 3 toasts visíveis; o resto vira "e mais N".
- Somem sozinhos (6 s para informação; avisos de prazo ficam até 15 s ou até clicar). Passar o mouse pausa a contagem.
- Toasts de confirmação de ação ("Movido para…", "Nota salva.") continuam curtos e no mesmo canto.
- Respeitar "reduzir movimento".

## Onde mexer
`src/componentes/dados.tsx` (ProvedorAvisos) e `src/componentes/alertas/provedor.tsx`.

## Testes
- Unitário: 5 avisos de prazo no mesmo segundo viram 1 toast agrupado.
- Tela: toast aparece no canto inferior direito e não cobre a coluna do meio.

## Pronto quando
Com 5 clientes vencendo ao mesmo tempo, aparece um toast só, no canto, e o kanban continua legível.
