# Tarefa 14 – Proteção do bot e custo (item 6)
- Limite de mensagens por lead por minuto/dia (cliente spam não gera conta alta). Passou do limite: não chama a API, avisa o consultor.
- Uma conversa de cada vez por lead (trava) para mensagens seguidas não gerarem respostas duplicadas.
- Falha da API do Claude: tentar de novo com espera, depois passar ao consultor com aviso no CRM.
- Rota `/api/saude` para o Railway (banco e app respondendo).
- Registro de uso (tokens) no painel do admin, para ver custo.
- Antes de codar: consulto a skill `claude-api` (modelos/preços atuais).
- Depende de: você decidir os limites (proponho valores; você aprova).
