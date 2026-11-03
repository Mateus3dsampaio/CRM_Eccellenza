# Tarefa 1 – Base: espera, não lidas, ordenação e prazos

Itens do Bloco 1: 6 (dado), 8 (regra e prazos), 10 e 11.

- Lead ganha `naoLidas` (mensagens do cliente que nenhum humano abriu) e `esperandoDesde` (desde quando o cliente espera o consultor).
- Regra pura em `src/regras/espera.ts`: faixa (normal, amarelo, vermelho), prazos, ordenação das colunas.
- Prazos editáveis em Configurações > Geral (PROVISÓRIO: amarelo 10 min, vermelho 30 min).
- Kanban ordena cada coluna: quem espera primeiro (o que espera há mais tempo no topo), depois o resto pela última mensagem. Isso também faz o card subir quando o lead já existente escreve (item 11).
- Rota para marcar a conversa como vista (zera `naoLidas`).
- Sem mudança visual no card nesta tarefa.

Pronto quando: `npm test`, `npm run tipos` e `npm run lint` passam; mapa e requisitos atualizados.
