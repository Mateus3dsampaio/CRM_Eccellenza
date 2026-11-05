# Tarefa 23 – Gaveta do lead no kanban

Primeira da série de layout e organização (tarefas 23 a 33), aprovada pelo Mateus em 04/11/2026 depois da revisão de uso. **Nenhuma tarefa da série cria função nova**: só muda onde as coisas ficam e como se chega a elas. Branch: `claude/gallant-fermi-z6vt65`; o Mateus testa e faz o merge se gostar.

**Status: feito em 04/11/2026.** Decisões na implementação: fechar e trocar de card usam `replace` na URL (voltar do navegador não reabre a gaveta); Esc não fecha a gaveta se houver uma janela (modal) aberta dentro dela; o sino (configurações de aviso) não aponta para lead, então não mudou.

## Problema
Clicar num card troca de página e o kanban some. Para olhar três clientes seguidos o consultor vai e volta três vezes. O "←" da ficha sempre volta ao kanban, mesmo quando a pessoa veio da Agenda ou de Arquivados.

## O que fazer
- Clicar no card abre uma **gaveta à direita** (560–640px no PC) por cima do kanban, com fundo escurecido leve. O kanban continua visível e o card aberto fica no nível "selecionado" (docs/design.md).
- Conteúdo da gaveta, nesta ordem: cabeçalho (avatar, nome, telefone, etapa), **Resumo para o consultor**, **Conversa** (com a caixa de responder/assumir), **Etapa, consultor, classificação, etiquetas e lembrete**. Nada de dados completos, medidas, notas nem histórico: isso fica na ficha completa.
- Botão **"Abrir ficha completa"** no cabeçalho da gaveta leva a `/lead/[id]` (a tela atual continua existindo).
- A URL muda para `/?lead=ID` ao abrir: F5 reabre a gaveta, "voltar" do navegador fecha, e dá para mandar o link para outro consultor.
- Esc e clique fora fecham. Clicar em outro card troca o conteúdo sem fechar e sem piscar.
- Mesma gaveta ao clicar: num compromisso da Agenda, num item de Arquivados e num aviso do sino que aponta para um lead. Em cada tela a URL ganha o `?lead=ID` da própria tela (ex.: `/agenda?lead=ID`).
- Animação: desliza da direita em até 300 ms; respeita "reduzir movimento".
- Reaproveitar os blocos já existentes de `src/componentes/ficha/` (conversa, resumo, etapa). Não duplicar componentes: a gaveta e a ficha completa usam os mesmos.
- Celular (375px): a gaveta ocupa a tela inteira, com botão de fechar no topo. Não é cobrado no visual, mas precisa funcionar.

## Onde mexer (mapa do código)
`src/componentes/kanban/quadro.tsx` e `card.tsx` (abrir), `src/componentes/ficha/*` (blocos), `src/componentes/agenda/agenda.tsx`, `src/componentes/arquivados.tsx`, `src/componentes/alertas/botao-avisos.tsx`. Componente novo: `src/componentes/ficha/gaveta.tsx`.

## Testes e documentação
- Teste de tela (Playwright): abrir card → gaveta aparece e URL tem `?lead=`; F5 mantém; Esc fecha; "Abrir ficha completa" vai para `/lead/`.
- Atualizar `docs/mapa-do-codigo.md` (arquivo novo + "onde mexer para abrir a ficha") e `docs/requisitos.md` se citar "abrir a ficha".

## Pronto quando
- Dá para ler o resumo e responder a conversa de um cliente sem sair do kanban, e trocar de cliente com um clique.
- Vindo da Agenda ou de Arquivados, fechar a gaveta deixa a pessoa onde estava.
