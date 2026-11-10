# Etapa 7 e 8: configurar o app e publicar (Live)

## Configurar — FEITO (Mateus, 08/11/2026)
developers.facebook.com → app **CRM Eccellenza** → **Configurações do app → Básico**:
- [x] **Domínio do app:** `crmeccellenza-production.up.railway.app`
- [x] **E-mail de contato**
- [x] **URL da política de privacidade:** `https://crmeccellenza-production.up.railway.app/privacidade` (no ar, sem aviso de rascunho, conferido em 08/11/2026)
- [x] **URL de instruções de exclusão de dados:** `https://crmeccellenza-production.up.railway.app/exclusao-de-dados` (no ar, conferido em 08/11/2026)
- [x] **Categoria**
- [x] **Ícone do app** (512 a 1024 px, PNG/JPG, até 5 MB)
- [ ] **Termos de Serviço:** deixado vazio (opcional; o CRM não tem essa página). Se a Meta exigir ao publicar, pedir ao Claude um texto para aprovar. Não inventar.
- **Namespace:** vazio (não usado).

## Antes de publicar
- [x] **Modelos de mensagem aprovados** na Meta (08/11/2026): `retomada`, `primeiro_contato`, `lembrete_medicao`, `lembrete_apresentacao`. CRM igualado no mesmo dia.
- [ ] Criar o `retorno_atendimento` (`03-modelos-de-mensagem.md`)
- [x] Etapa 1 concluída (app e conta do WhatsApp no mesmo portfólio) — 10/11/2026
- [x] Páginas no ar, sem aviso de rascunho (08/11/2026)
- [ ] Anotados (sem alterar): URL do webhook, campos assinados, e o GET de `subscribed_apps` mostrando o app
  - [x] GET `subscribed_apps` (09/11/2026, Explorador, token temporário): a conta do WhatsApp lista o app **CRM Eccellenza** (id 2306580053410065). WABA: 1369991565075615.
  - [x] GET `phone_numbers` (09/11/2026): "Italínea Eccellenza", +55 88 8170-8827, verificado, qualidade GREEN, Cloud API. URL do webhook: `https://crmeccellenza-production.up.railway.app/api/whatsapp/webhook`. Falta anotar os campos assinados.
- [x] Tela "Teste" do app: **"Teste concluído"** (09/11/2026). O teste vale 30 dias: publicar até 09/12/2026, senão refazer as chamadas no Explorador. `whatsapp_business_messaging` já concluída; `public_profile` não é obrigatória.
- [ ] Mensagem de teste do celular → o bot responde
- [ ] Leu o checklist de publicação do próprio painel (o nome exato do botão de Live não está confirmado; o painel mostra)
- [ ] Horário calmo (fora do pico de atendimento)

Se o painel pedir **App Review** de alguma permissão, **pare** e fale com o Claude. Para uso interno isso não deveria ser necessário.

## Publicar e conferir
**Publicado pelo Mateus em 10/11/2026**, com anúncio de WhatsApp rodando (2 leads do anúncio chegaram antes). Segundo ele, deu tudo certo. Conferências abaixo ainda a marcar.
1. [x] Publicar / mudar para Live.
2. Logo depois: mandar mensagem de teste do celular e conferir que o bot responde.
3. CRM → Configurações → WhatsApp: ver os últimos avisos da Meta, sem erros.
4. Conferir que `subscribed_apps` continua com o app (GET no Explorador da Graph API, token temporário do Explorer, nunca o do CRM).
5. Mandar um modelo aprovado para o seu próprio número pelo CRM e conferir que chega (o envio de modelo nunca foi testado de verdade).
6. Observar por 24 horas.

## Se algo parar
1. Voltar o app para modo de desenvolvimento (a Meta não deve bloquear a volta, mas não testei).
2. Conferir, nesta ordem: `META_APP_SECRET` no Railway (se estiver errado, tudo recebe erro 401), token "Nunca expira" e `WHATSAPP_VERIFY_TOKEN`.
3. Não regenerar token nem segredo no mesmo dia.
