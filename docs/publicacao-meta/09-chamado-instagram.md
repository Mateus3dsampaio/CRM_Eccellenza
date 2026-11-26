# Instagram: a Meta não entrega as mensagens ao webhook (chamado e pedido de análise)

Situação em 25/11/2026, com as tentativas de 26/11/2026 registradas na seção "Tentativas de 26/11/2026". O teste real do Instagram (tarefa 47) falhou: a mensagem chega no Instagram da loja e a Meta a guarda, mas **a Meta não chama o webhook do CRM**. Resumo e histórico em `docs/pendencias.md` (seção Instagram).

## Identificadores
- App "CRM Eccellenza": `2306580053410065` (Live Mode, login unificado do Facebook para Empresas, configuração `29383611321332368`).
- Conta do Instagram @italineaeccellenza: `17841451828182322`.
- Página do Facebook italineaeccellenza: `102671715680163`.
- Portfólio empresarial: Italínea Eccellenza, `1107047693404758`.
- Webhook: `https://crmeccellenza-production.up.railway.app/api/instagram/webhook`.

## O que já foi comprovado (não precisa refazer)
- CRM em modo real: `GET /api/configuracoes/instagram` devolve `configurado: true`, `simulador: false`, `faltando: []`.
- Endereço e assinatura: o botão "Testar" do campo `messages` (Webhooks do Instagram no app) gerou `POST` com status 200 no Railway (Network Logs, filtro `@path:/api/instagram/webhook`).
- Campo `messages` assinado no app e na conta: `GET 17841451828182322/subscribed_apps` mostra o app com `messages`, `messaging_seen`, `message_reactions`, `standby` e outros.
- "Permitir acesso às mensagens" (ferramentas conectadas) ligado no Instagram da loja.
- A Meta guarda as mensagens: `GET 17841451828182322/conversations?platform=instagram&limit=3&fields=updated_time,participants` mostra as conversas das 20:16 e 20:20 (horário de Brasília) de 25/11/2026.
- Nenhum POST real chegou ao Railway depois dessas mensagens. Só houve o POST do "Testar" (20:02) e dois GET de verificação com 403 (19:43, um teste nosso com token errado; 20:16, origem desconhecida).
- Mesmo resultado com três remetentes: @mateuscsampaio (dona do Business Manager, Testador do Instagram), outra conta com papel de Testador e a conta da esposa do Mateus (sem papel nenhum no app).
- A IA da Meta (Assistente do Desenvolvedor) confirmou: app em Live Mode, assinatura `messages` ativa, Página e conta do Instagram vinculadas e ativas. Sugeriu Handover Protocol. Na Página, Configurações > Mensagens avançadas mostra "Connected Apps: nenhum aplicativo conectado", então nenhum outro app disputa a conversa.
- Business Manager: Apps > CRM Eccellenza > Ativos conectados está vazio, mas a janela "Conectar ativos" só aceita contas de anúncios (nada para atribuir). A conta do Instagram tem a Página e um grupo de ativos conectados.
- O Explorador da Graph API não oferece permissões `pages_*` para este app (só Instagram e WhatsApp), então não dá para consultar nem assinar a Página por lá.

## Tentativas de 26/11/2026 (madrugada), em ordem
Tudo feito com o Claude no navegador do Mateus. Nada disso resolveu até a última linha desta seção; o teste final com a autorização da conta está na lista "Onde parou".

1. **Business Settings > Contas do Instagram** (`business.facebook.com/latest/settings/instagram_account`): a conta @italineaeccellenza mostrava a etiqueta "Análise necessária" e o aviso "Habilitar a visualização do Instagram no Meta Business Suite" com o botão "Confirmar acesso". O Mateus confirmou. Resultado: as mensagens passaram a aparecer na Caixa de Entrada do Meta Business Suite, **mas o webhook continuou sem POST real**. A IA da Meta sugeriu conferir "Acesso a leads"; descartado, porque isso é de formulário de anúncio (Lead Ads), não de mensagem direta.
2. **Pedido de análise do app** (Envios de análise do app): a Meta lista 9 permissões (`instagram_manage_events`, `instagram_manage_comments`, `instagram_content_publish`, `instagram_manage_messages`, `ads_read`, `instagram_manage_insights`, `ads_management`, `instagram_basic`, Human Agent). **Nada foi enviado.** Decisão: não enviar agora, porque a conta é da própria loja e o app ainda tem pendências (ícone 1024x1024 faltando, Termos de Serviço e Domínios vazios, texto do Instagram na política de privacidade ainda não escrito). Se um dia for enviar, deixar só `instagram_manage_messages`, `instagram_basic` e Human Agent.
3. **Railway** (só leitura): serviço online; as 4 variáveis do Instagram existem; `MODO_SIMULADOR` não existe (em produção o código o desliga). Network Logs, filtro `@path:/api/instagram/webhook`: GET 403 às 19:43, 20:16 e 20:38 (token de verificação recusado), POST 200 às 20:02 e às 00:19:19 e 00:19:34 (estes dois são o botão "Testar" de `messages` e `messaging_seen`). **Nenhum POST de mensagem real.** O WhatsApp, no mesmo servidor e no mesmo app, recebe normalmente (POSTs 200 em `/api/whatsapp/webhook`). Os Network Logs só guardam o deploy ativo.
4. **Meta (só leitura)**: app Publicado, 0 ações necessárias; Funções: WhatsApp_CRM e Mateus Sampaio (Administrador), @mateuscsampaio e @italineaeccellenza (Testador do Instagram); callback certo; `messages` assinado.
5. **Graph API Explorer** (token de usuário do próprio Explorador, não o do CRM): `GET 17841451828182322/subscribed_apps` devolveu o app com `messages`, `messaging_seen` e os demais campos. `POST 17841451828182322/subscribed_apps?subscribed_fields=messages,messaging_seen` devolveu `success: true`; sem POST real depois, com mensagem nova de teste.
6. **Token de verificação**: o Mateus recolou na Meta o `INSTAGRAM_VERIFY_TOKEN` do Railway e salvou. Os testes do botão "Testar" chegaram (POST 200); mensagem real continuou sem chegar.
7. **Remover e adicionar a conta de novo** (passo 2 de "API setup with Unified login"): lixeira da italineaeccellenza (a Meta pede a senha do Facebook e avisa que remove também a função de Testador), depois Funções > Adicionar pessoas > "Testador do Instagram" > usuário `italineaeccellenza`, aceite do convite no Instagram (Configurações > Apps e sites > Convites do testador) e "Adicionar conta". Resultado: a conta voltou ao app, webhook Ativado (a @mateuscsampaio voltou a ficar Ativada sozinha e o Mateus a desativou de novo), e o Graph mostrou a lista completa de campos inscritos. Mensagem de @italineaeccellenza para @mateuscsampaio e o inverso: nada no Railway.
8. **Instagram da loja > Apps e sites**: aba **Ativos vazia** ("Você não autorizou nenhum aplicativo a acessar a sua conta do Instagram"); aba **Convites do testador** mostra "CRM Eccellenza-IG, autorizado para você em 26 de novembro de 2026". Ou seja, o convite de Testador foi aceito, mas a conta não deu a autorização do app.
9. O Claude tentou gerar o token pelo painel (botão "Gerar token") e a janela de login do Instagram não abriu para ele; o Mateus gerou depois, à mão. Esse token **não** vai para o Railway (o `INSTAGRAM_TOKEN` do CRM é de usuário do sistema e continua o mesmo).

Observações:
- O aviso "A configuração da API com login do Instagram não está disponível para apps mais recentes" na tela do caso de uso é só informativo: o app usa o login unificado, que é o certo.
- O botão "Testar" na Meta entrega o webhook mesmo sem a conta ter autorizado o app, por isso ele não prova que mensagens reais vão chegar.

## Onde parou (26/11/2026)
- Hipótese nova e a mais forte hoje: a conta da loja **não autorizou o app** (aba Ativos vazia). O Mateus gerou o token no painel (que abre a tela de permissões do Instagram) para registrar a autorização. **Falta** conferir se "CRM Eccellenza" apareceu em Ativos e repetir o teste com uma mensagem nova (olhar o Railway).
- Se continuar sem POST real: enviar o chamado abaixo, acrescentando os itens 1 a 8 desta seção.

## Hipóteses que sobram
1. **Acesso padrão ao Instagram**: falta a análise do app para `instagram_manage_messages` (acesso avançado). É a mais provável.
2. A entrega do Instagram via login do Facebook depende da assinatura da **Página** (`messages` em `{página}/subscribed_apps`), que não conseguimos conferir.
3. O GET 403 das 20:16: a Meta pode ter verificado o webhook com outro token. Não deu para ver o token enviado.

## Texto do chamado (Suporte ao desenvolvedor da Meta)
Assunto: Webhook de mensagens do Instagram não é chamado, apesar de assinatura ativa e teste com sucesso

> O app 2306580053410065 (CRM Eccellenza), em Live Mode, usa o Login do Facebook para Empresas (login unificado) com a conta do Instagram 17841451828182322 e a Página 102671715680163. O campo `messages` do Instagram está assinado no app e na conta (`GET /{conta}/subscribed_apps` confirma). O endereço do webhook responde 200 ao botão "Testar". As mensagens reais enviadas à conta aparecem na API (`/conversations?platform=instagram`, 25/11/2026, 20:16 e 20:20 no horário de Brasília), mas a Meta não chama o webhook: nenhum POST chega ao servidor. O resultado é o mesmo com remetentes com e sem papel no app (administrador, testador do Instagram e conta sem papel). "Permitir acesso às mensagens" está ligado no Instagram. Na Página, "Connected Apps" está vazio. O que impede a entrega das mensagens ao webhook? Falta o acesso avançado a `instagram_manage_messages`, ou a assinatura da Página?

## Pedido de análise de `instagram_manage_messages`
Roteiro do que o app faz (usar no formulário e no vídeo de demonstração; revisar contra `docs/publicacao-meta/08-auditoria.md`):
1. O cliente manda uma mensagem direta ao Instagram da loja.
2. O CRM cria o lead (sem telefone), o bot responde e o consultor assume a conversa na tela.
3. O CRM responde pelo mesmo canal, dentro da janela de 24 horas (e, para atendimento humano, até 7 dias com a tag de atendente humano, se a Meta confirmar que vale para a conta).
4. Quando o cliente passa o WhatsApp, o consultor une o lead do Instagram ao lead do WhatsApp.

Quem grava o vídeo de demonstração e envia é o Mateus. Dados de cliente real não entram no vídeo.

## Como conferir depois de qualquer ajuste
1. Mandar uma mensagem de uma conta externa para @italineaeccellenza.
2. No Railway: serviço CRM_Eccellenza > publicação ativa > Network Logs > filtro `@path:/api/instagram/webhook`. Tem que aparecer um `POST` 200 novo.
3. No CRM: lead sem telefone no kanban, com o selo do Instagram.
