# Tarefa 16 – WhatsApp real: webhook e envio (item 1)
- Rota do webhook da Meta: GET (verificação `hub.challenge` com token) e POST (valida `X-Hub-Signature-256`). Responde 200 rápido e processa depois.
- Campo novo em `Mensagem` com o ID da Meta (`wamid`), único, para não processar a mesma mensagem duas vezes (a Meta reenvia).
- Entrada: texto e mídia (baixa foto/planta pela API); status entregue/lido/falhou atualizam a mensagem.
- Saída: `enviarMensagemLoja` passa a chamar a Cloud API; mantém a regra de 24h e os modelos. Modo simulado continua para testes.
- Log de webhooks recebidos/falhas (ideia do Twenty) para depurar a Meta.
- Tudo testado com payloads de exemplo; nenhuma mensagem real sai até você autorizar.
- Depende de: conta Meta Business verificada; número liberado para a API (fora do app WhatsApp Business comum); token permanente; modelos de mensagem aprovados pela Meta (textos aprovados por você); URL pública do Railway.
