# Tarefa 48 – Acompanhamento visual da automação (colunas IA atendendo e Perdido, só admin)

(O prompt original chamava de "tarefa 47"; a 47 é o Instagram, então esta é a 48.)

Objetivo: o dono bate o olho na coluna **IA atendendo** e na coluna **Perdido** e vê, de cada lead, o próximo passo automático e quando ele acontece. Só **mostra** o que as rotinas já fazem: nenhuma regra de automação muda.

Protótipo aprovado pelo Mateus em 25/11/2026 (`C:\Users\mcsam\Downloads\prototipo-automacao.html`, cópia congelada do kanban com dados fictícios). O visual final deve ficar igual.

## Decisões do Mateus (25/11/2026)
- **Só admin.** O servidor só manda os dados quando `usuario.perfil === "admin"`. Esconder só na tela não basta.
- **Chips no cabeçalho** da coluna, sempre visíveis para o admin, numa linha só, abaixo de "N conversas". Chip com contagem 0 não aparece; sem nenhum chip a linha some.
- **Linha da automação em cada card**, logo abaixo da faixa de ação, **escondida atrás de um olho** no título da coluna, ao lado do lápis. O olho começa desligado; cada coluna guarda o estado no navegador (`localStorage`, com `try/catch`).
- **Clicar num chip** filtra a coluna e mostra a linha nesses cards mesmo com o olho desligado; clicar de novo limpa.
- **Passar o mouse na linha** abre o balão "AUTOMAÇÃO DESTE LEAD": passos já feitos em cinza, próximos com a cor da categoria, cada um com dia e hora, e nota no rodapé quando houver.
- A previsão sai **das mesmas regras** que movem o card (teste de consistência obrigatório).

## Etapas
- [x] 0. Branch `feat/acompanhamento-automacao`; pendências do Instagram commitadas; `npm install`.
- [x] 1. Regras puras de previsão (`src/regras/previsao-automacao.ts`) + `testes/unit/previsao-automacao.test.ts` (casos fixos e consistência com as regras reais).
- [x] 2. Servidor só admin (`src/servicos/previsao-automacao.ts`, `entradasEmPerdido` extraída de `perdidosVencidos`, `/api/kanban` com `automacao` só para admin) + testes.
- [x] 3. Tela (chips, olho, linha do card, balão) em `src/componentes/kanban/`.
- [x] 4. Conferir na tela com prints (admin e consultor) e confirmar no relógio simulado que o card se move na hora prevista.
- [x] 5. Lint, tipos e testes; mapa do código; pendências; relatório em `docs/rodadas/`; commit (sem push sem o OK do Mateus).

## Não fazer
- Não alterar regra, prazo, padrão ou texto de automação, nem criar automação nova.
- Não mostrar nada disso para consultor, nem mandar o dado para ele.
- Não usar cor fixa nem fonte nova fora de `tokens.css` / `globals.css`.
- Não mexer em `src/bot/`, no Manual nem nas instruções (o `docs/contrato-do-bot.md` não muda).
- Não fazer push, deploy nem mudar o branch do Railway.
- Regra que pareça errada (ex.: lead "travado" por dias): não corrigir aqui; anotar no relatório e em `tarefas/futuras/` e avisar o Mateus.
