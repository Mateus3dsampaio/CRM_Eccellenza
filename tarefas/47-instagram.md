# Tarefa 47 – Instagram no CRM

Objetivo: quem mandar mensagem direta para o Instagram da loja (@italineaeccellenza) vira lead no CRM, com o bot atendendo e o consultor assumindo, como no WhatsApp.

## Decisões do Mateus
- 25/11/2026: o lead do Instagram nasce **sem telefone**; o consultor (ou o bot) pede o WhatsApp e um botão **"Unir com lead do WhatsApp"** junta os dois cadastros.
- 25/11/2026: o **bot atende no Instagram com o mesmo roteiro** do WhatsApp. O Mateus avisa o agente das instruções para incluir uma frase sobre pedir o WhatsApp.

## Já feito na Meta (25/11/2026, no navegador do Mateus)
- Instagram @italineaeccellenza confirmado no portfólio "Italínea Eccellenza".
- Caso de uso "Gerenciar mensagens e conteúdo no Instagram" adicionado ao app "CRM Eccellenza" (ID 2306580053410065), com a configuração "API do Instagram (login unificado)" (ID 29383611321332368).
- Conta da loja aceitou o convite de Testador do Instagram.
- O app usa **login unificado**: o token é de usuário do sistema e **nunca expira**. Permissões: `instagram_basic` e `instagram_manage_messages` (o modelo traz também anúncios, comentários e publicação, que não dá para tirar; em acesso padrão só valem para quem tem função no app).

## Desenho do banco (para aprovar antes de codar)
`Lead` (hoje `telefone` é obrigatório e único, usado em ~60 lugares):
- `telefone String?` (continua único; vários NULL são permitidos no SQLite e no Postgres).
- `canal String @default("whatsapp")` — `whatsapp | instagram`: canal em que o lead nasceu.
- `igsid String? @unique` — identificador do cliente no Instagram (a Meta não manda telefone).
- `igUsuario String?` — @usuário, para mostrar na ficha (nome vem de `nomePerfil`).
`Mensagem`: `canal String @default("whatsapp")` — a resposta sai pelo canal da última mensagem do cliente.
`EventoWebhook`: reaproveitada (campo de origem `whatsapp | instagram`).
Migração SQLite + Postgres (`npm run esquema:postgres`).

## Regras próprias do Instagram
- Janela de 24h como no WhatsApp, mas **sem modelos de mensagem**. Fora das 24h só o consultor responde, com a tag de atendente humano (até 7 dias, a confirmar na documentação atual da Meta). Bot, recuperação de leads, retomada e lembretes automáticos **não enviam** no Instagram fora da janela (ficam como "não enviado", sem erro e sem Perdido automático por falha).
- "Responda PARAR": mesma regra (`naoReceberEm`).
- Consentimento: "cliente escreveu primeiro" vale (decisão de 05/11/2026).
- Lead do Instagram sem telefone: tudo que usa telefone (lembrete por modelo, exclusão LGPD por telefone, exportação, nova mensagem) tem de tratar o campo vazio.
- Unir: move mensagens, mídias, notas, medidas e visitas do lead do Instagram para o lead do WhatsApp, guarda `igsid` e `igUsuario` nele e apaga o lead do Instagram. Depois da união, a resposta sai pelo canal da última mensagem do cliente.
- Áudio: mesmo Whisper. Imagem: baixa do endereço da Meta (host permitido, https, sem redirecionamento). Outros tipos: aviso "não suportado", como no WhatsApp.

## Etapas
- [x] 0. Meta: caso de uso, configuração e testador (25/11/2026).
- [x] 1. Mateus aprova este desenho (25/11/2026: telefone opcional com botão "unir" e mesmo bot).
- [x] 2. Banco: migração `0015_instagram` (Postgres; o SQLite vem do `schema.prisma`) e `Lead.telefone` opcional; usos de telefone ajustados (`formatarTelefone(null)` = "Sem telefone").
- [x] 3. Regras puras `src/regras/instagram.ts` (assinatura, leitura do payload, janela e tag) e config `src/lib/instagram-config.ts` (variáveis de ambiente).
- [x] 4. Webhook `src/app/api/instagram/webhook/route.ts` + serviço `src/servicos/instagram.ts` (receber, enviar, mídia, caixa de entrada).
- [x] 5. `enviarMensagemLoja` escolhe o canal; retorno automático (modelo) pula quem não tem telefone; recuperação de leads (texto, dentro das 24h) vale igual.
- [x] 6. Tela (selo no card, ficha e gaveta; @usuário; botão "Unir com WhatsApp"; cartão em Configurações > Chaves de API): ícone do canal no card/conversa/ficha, @usuário, botão "Unir com lead do WhatsApp", cartão do Instagram em Configurações.
- [x] 7. (feito, menos política de privacidade e auditoria, que dependem do Mateus) Testes (Meta simulada), mapa do código, contrato do bot (`npm run contrato:bot`), política de privacidade (texto proposto, Mateus aprova), `docs/pendencias.md`, `docs/publicacao-meta/08-auditoria.md`.
- [ ] 8. Mateus + Claude: variáveis no Railway (nomes na etapa 3), webhook e campo `messages` na Meta, token (o Mateus cola direto no Railway), teste real com outra conta.
- [ ] 9. Frase nas instruções do bot sobre pedir o WhatsApp (Mateus, no repositório de instruções).

## Limites desta primeira versão (decididos para reduzir risco)
- **Só até 24h:** a tag de atendente humano (resposta até 7 dias) NÃO foi implementada: confirmar na documentação atual da Meta antes de ligar.
- **Sem envio de imagem, vídeo ou arquivo** pelo Instagram (a Meta exige endereço público do arquivo). O cliente pode mandar; a loja só responde texto.
- **Leitura ("lido")** do Instagram vem do evento `read`; status "entregue" não existe no Instagram.
- **Excluir dados por telefone** (página pública `/exclusao-de-dados`) não alcança contato do Instagram sem telefone: o admin exclui pelo lead.
- Lead com os dois canais: janela de 24h separada por canal; a verificação antes de assumir a conversa usa a última mensagem do cliente em qualquer canal.
- Nunca testado com a Meta real.

## Riscos
- Meta pode exigir App Review para o app já publicado; a auditoria do item 07 de `docs/publicacao-meta/` fica a refazer com as permissões reais.
- Nada do Instagram foi testado com a Meta real; só depois da etapa 8.
