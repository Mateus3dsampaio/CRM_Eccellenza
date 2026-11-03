# Tarefa 13 – Modo produção (item 5)
- `/api/teste` já bloqueia em produção. `/api/simulador` e `/api/relogio` só exigem login: qualquer consultor pode avançar o relógio ou simular cliente. Em produção: desligar as duas e o menu Simulador, e `agora()` usar sempre o relógio real.
- Uma variável (`MODO_SIMULADOR`) liga/desliga o que é de simulação; padrão desligado em produção.
- Pronto quando: teste mostra 404/403 nessas rotas em produção e o menu não mostra o Simulador.
