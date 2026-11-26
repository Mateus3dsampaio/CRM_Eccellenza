# Instagram: a Meta não entrega as mensagens ao webhook (chamado e pedido de análise)

Situação em 25/11/2026. O teste real do Instagram (tarefa 47) falhou: a mensagem chega no Instagram da loja e a Meta a guarda, mas **a Meta não chama o webhook do CRM**. Resumo e histórico em `docs/pendencias.md` (seção Instagram).

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
