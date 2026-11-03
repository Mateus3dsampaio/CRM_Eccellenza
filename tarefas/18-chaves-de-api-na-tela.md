# Tarefa 18 – Chaves de API na tela (Configurações)
- Cartão "Chaves de API" em Configurações > Geral (só admin): chave do texto (Claude) e chave da transcrição de áudio (OpenAI/Whisper). Campos em pontinhos; depois de salvar mostra só "••••final".
- Guardadas criptografadas (AES-256-GCM) no banco. Produção exige a variável `CHAVE_MESTRA`; no computador usa o segredo local.
- A chave da tela vale mais que `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`. Mesma chave pode ir nos dois campos.
- Fora desta tarefa (Tarefa 19, depois de validar esta): GPT atendendo o texto (adaptador OpenAI com ferramentas, seletor de provedor/modelo, política de privacidade).
