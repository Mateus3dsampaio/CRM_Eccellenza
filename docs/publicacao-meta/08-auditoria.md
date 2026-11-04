# Auditoria de publicação do app Meta (04/11/2026, somente leitura)

## Permissões
| Permissão | Uso | Necessária? |
|---|---|---|
| `whatsapp_business_messaging` | Enviar mensagens (`/messages`), enviar mídia (`/media`), baixar mídia recebida, registrar o número (`/register`) | Sim |
| `whatsapp_business_management` | O código não chama nada que a exija em execução; o token a usa no passo manual `subscribed_apps` e na criação de modelos | Manter (não confirmei se `messaging` sozinha bastaria) |

Sem Facebook Login, OAuth, Instagram nem Pages API no código.

## Advanced Access / App Review
Pela documentação da Meta, quem usa a API só para o próprio negócio fica no acesso padrão e não precisa de Advanced Access nem de revisão. Condição: a conta do WhatsApp ser da mesma empresa do app (etapa 1). Instagram: reavaliar depois.

## Segurança (código)
Correto: assinatura HMAC SHA-256 sobre o corpo exato com comparação em tempo constante; token de verificação em tempo constante; evento gravado antes do 200 e processado depois; proteção contra mensagem duplicada; limite de 1 MB no corpo; token só em variável de ambiente e fora de log; download de mídia só de hosts da Meta, em https, sem redirecionamento; cabeçalhos de segurança.

Atenção: `META_APP_SECRET` errado ou trocado → todas as mensagens recebem erro 401. Token depende do usuário do sistema manter Acesso total ao app e à conta.

## Privacidade e exclusão
- `/privacidade` pública, com razão social, CNPJ, dados, uso, IA, compartilhamento, retenção e direitos. Faltava explicar como excluir os dados: resolvido com `/exclusao-de-dados` (etapa 2/4).
- Exclusão e exportação pelo admin na ficha do lead, em cascata, com registro LGPD. "PARAR" funciona. Retenção automática (30/180 dias; logs 14).
- Não há backup do Postgres hoje (plano Hobby), então não há cópia guardando dado excluído.
- Cópias na Meta, Anthropic/OpenAI e Railway não são apagadas pelo CRM (dito na página).

## Classificação
**A. Pronto:** webhook e segurança de tokens; webhook cadastrado e `messages` assinado, mensagens reais chegando; política de privacidade pública; exclusão/exportação por admin; "PARAR".

**B. Precisa de configuração na Meta:** confirmar portfólio; URL de exclusão; ícone, categoria, URLs e e-mail; criar e aprovar modelos; nome de exibição; pagamento; publicar.

**C. Precisa de código:** página de exclusão (feita no computador, falta aprovar e subir); novos textos dos modelos em `modelos.ts`; opcionais (Web Push na política, DPO, data, variáveis nos modelos); callback de exclusão da Meta só se o painel exigir.

## Riscos de interrupção na publicação
Mudar para Live não troca token, segredo, número nem webhook; risco baixo. O risco maior é mexer em webhook, Callback URL, verify token, segredo do app, `subscribed_apps` ou regenerar token durante o processo. Plano de volta: voltar ao modo de desenvolvimento.

## Fontes
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review
- https://developers.facebook.com/docs/permissions
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/
- https://developers.facebook.com/blog/post/2019/09/23/live-mode-for-production-use/
- https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
- https://developers.facebook.com/documentation/development/terms-and-policies/privacy-policy
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- https://www.facebook.com/business/help/338047025165344
