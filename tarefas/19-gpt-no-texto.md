# Tarefa 19 – GPT atendendo o texto
- Seletor Claude/GPT e modelo do GPT em Configurações > Chaves de API. Padrão: Claude. Modelo do GPT PROVISÓRIO (`gpt-5.5`), editável.
- O histórico continua guardado no formato da Anthropic; para a OpenAI é convertido a cada chamada (`src/bot/openai-conversao.ts`). Dá para trocar de provedor no meio da conversa.
- Botão "Usar a mesma do texto" no campo de áudio (uma conta só na OpenAI).
- Política de privacidade: texto menciona Anthropic ou OpenAI. **Mateus precisa aprovar** antes de usar GPT com clientes reais.
- NÃO testado com a OpenAI real. Não sei se o GPT segue as 15 instruções como o Claude: testar no Simulador antes de produção.
- Limites: sem cache de prompt manual (a OpenAI faz sozinha); o uso (tokens) soma Claude e GPT no mesmo contador.
