# Etapa 7 e 8: configurar o app e publicar (Live)

**Só comece depois que `/privacidade` e `/exclusao-de-dados` estiverem no ar (etapa 4) e os textos aprovados.**

## Configurar
1. developers.facebook.com → seu app → **Configurações do app → Básico**.
2. Preencher:
   - **Ícone do app:** 1024×1024 px (aceita de 512 a 1024, JPEG, GIF ou PNG, até 5 MB). O `public/icone-512.png` é um "E" azul provisório; prefira a logo da Eccellenza.
   - **URL da política de privacidade:** `https://crmeccellenza-production.up.railway.app/privacidade`
   - **URL de instruções de exclusão de dados:** `https://crmeccellenza-production.up.railway.app/exclusao-de-dados` (se o campo não aparecer para o seu app, não é preciso).
   - **E-mail de contato:** italinea.eccellenza@hotmail.com
   - **Categoria** de negócios/comércio e **domínio do app:** `crmeccellenza-production.up.railway.app`
3. Leia o checklist de publicação do próprio painel antes de publicar. Não achei na documentação o nome exato do botão/chave de Live; o painel mostra.
4. Se o painel pedir App Review de alguma permissão, **pare** e fale com o Claude. Para uso interno isso não deveria ser necessário.

## Antes de publicar
- [ ] Etapa 1 concluída (mesmo portfólio)
- [ ] Páginas no ar, sem aviso de rascunho
- [ ] Anotados (sem alterar): URL do webhook, campos assinados, e o GET de `subscribed_apps` mostrando o app
- [ ] Mensagem de teste do celular → o bot responde
- [ ] Horário calmo (fora do pico de atendimento)

## Publicar e conferir
1. Publicar / mudar para Live.
2. Logo depois: mandar mensagem de teste do celular e conferir que o bot responde.
3. CRM → Configurações → WhatsApp: ver os últimos avisos da Meta, sem erros.
4. Conferir que `subscribed_apps` continua com o app (GET no Explorador da Graph API, token temporário do Explorer, nunca o do CRM).
5. Observar por 24 horas.

## Se algo parar
1. Voltar o app para modo de desenvolvimento (a Meta não deve bloquear a volta, mas não testei).
2. Conferir, nesta ordem: `META_APP_SECRET` no Railway (se estiver errado, tudo recebe erro 401), token "Nunca expira" e `WHATSAPP_VERIFY_TOKEN`.
3. Não regenerar token nem segredo no mesmo dia.
