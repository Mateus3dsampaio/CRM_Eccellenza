# Melhorias futuras

Caderno de ideias do Mateus. **Não é pendência e não tem urgência.** Serve para registrar uma ideia hoje e poder consultar depois, sem misturar com as tarefas numeradas (`tarefas/NN-*.md`), que são as que se fazem uma por vez.

## Como funciona
- **Um tópico = um arquivo** nesta pasta. Assunto diferente, tópico novo. Ideia nova de um assunto que já existe entra dentro do tópico dele.
- Cada tópico guarda: o que é, por que vale, as decisões já tomadas, os riscos, as **etapas em ordem** e o que ainda está em aberto.
- Etapas são marcadas `[ ]` (a fazer) e `[x]` (feita). Ao concluir uma, o Claude atualiza o arquivo.

## Como o Claude atende quando o Mateus pedir "quero ver as melhorias futuras"
1. Lê este índice e **mostra só a lista de tópicos** (nome, uma linha e estado), para o Mateus escolher. Não abre o conteúdo de todos.
2. Depois que ele escolhe, abre o tópico inteiro e propõe começar pela primeira etapa aberta.
3. Trabalha **uma etapa por vez**, com validação do Mateus, e marca no arquivo o que ficou pronto.
4. Quando uma etapa for grande, vira tarefa numerada em `tarefas/` (próximo número livre) e o tópico passa a apontar para ela.
5. Ideia nova que o Mateus mencionar: o Claude pergunta se vira tópico novo ou entra num existente, e registra aqui.

## Tópicos
| Tópico | Arquivo | Estado |
|---|---|---|
| Análises da equipe de vendas com o Claude | [`analises-com-claude.md`](analises-com-claude.md) | Ideia aprovada, sem etapa feita |
| Teste do painel que falha dependendo do horário | [`teste-painel-horario.md`](teste-painel-horario.md) | Registrado em 08/11/2026, sem etapa feita |
