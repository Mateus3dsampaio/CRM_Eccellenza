# Tarefa 11 – Rotinas automáticas (item 3)
- Hoje `rodarRotinas` só roda quando alguém abre kanban/arquivados/relógio. Em produção, sem ninguém na tela, retomada, "Sem resposta", limpeza e avisos de retorno/prazo vermelho não rodam.
- Agendador no servidor (ex.: `instrumentation.ts` com intervalo, ou cron do Railway chamando rota protegida por segredo). Escolho a opção mais simples e estável antes de codar e te conto.
- Trava para duas execuções não se atropelarem; log em `RegistroRotina`.
- Pronto quando: teste prova que a rotina roda sem nenhuma tela aberta.
