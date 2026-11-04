# Pendências (para a próxima sessão)

Lista única do que falta para o CRM entrar no ar. Marque `[x]` ao concluir e anote a data. Guia de como fazer cada passo: `docs/colocar-no-ar.md`.
Última atualização: 04/11/2026 (versão 0.10.0; CRM no Railway, webhook funcionando, texto, foto, vídeo, ZIP e galeria testados com mensagens reais).

## A. Do Mateus (conta, chave, decisão)

### Meta / WhatsApp (começar primeiro: leva dias)
- [x] Verificar a empresa na Meta Business (CNPJ e documentos). Concluída (04/11/2026, "Italínea Eccellenza").
- [x] Criar o app da Meta com o produto WhatsApp. App "CRM Eccellenza" criado em 04/11/2026 (caso de uso só WhatsApp; Instagram e Messenger ficaram de fora de propósito).
- [x] Inscrever a conta do WhatsApp no app (`subscribed_apps`, passo 6b do guia). Feito em 04/11/2026; era o que impedia as mensagens de chegar.
- [ ] Decidir se o app precisa ir para modo "Live": em 04/11/2026, com o app ainda "Não publicado", mensagens do celular do Mateus e de um número sem relação com o app chegaram e o bot respondeu. A Meta avisa que, não publicado, só entrega dados de teste; se um dia as mensagens pararem de chegar sem explicação, revisitar. Para publicar a Meta pede o endereço `/privacidade` e a política aprovada.
- [ ] Liberar o número da loja para a API oficial (ele sai do app comum; confirmar como migrar com a Meta).
- [ ] Registrar o número com o PIN de 6 dígitos (`npx tsx scripts/registrar-numero.ts <PIN>`) e **guardar o PIN**.
- [ ] Aprovar o nome de exibição (ex.: "Eccellenza Móveis Planejados").
- [ ] Cadastrar a forma de pagamento no WhatsApp Manager e conferir a tabela de preços em reais.
- [x] Gerar o token permanente (permissões `whatsapp_business_messaging` e `whatsapp_business_management`). Gerado e colado no Railway em 04/11/2026. Validade "Nunca expira" escolhida pelo Mateus (04/11/2026). Houve vários tokens gerados; se um dia o envio falhar com erro de token, conferir se o colado no Railway é o de "Nunca expira".
- [ ] Criar e aprovar os modelos de mensagem na Meta, com o mesmo nome do código (`retomada`, `primeiro_contato`, `lembrete_visita`), pt_BR, sem variáveis.
- [x] Cadastrar o webhook (`SEU-ENDEREÇO/api/whatsapp/webhook`) e assinar o campo `messages` (só depois do Railway no ar). Feito em 04/11/2026 (`https://crmeccellenza-production.up.railway.app/api/whatsapp/webhook`).
- [x] Conferir na página oficial da Meta: tipos aceitos no ENVIO (**DWG e ZIP são incertos**), limites de tamanho de vídeo e documento, versão atual da API (`WHATSAPP_API_VERSION`, padrão `v23.0`), se o app precisa estar em modo "Live". Feito pelo Mateus em 05/11/2026: a Meta aceitou tudo.

### Railway
- [x] Criar o projeto (Hobby) e conectar o repositório / branch (branch `main`, 04/11/2026).
- [x] Adicionar o Postgres.
- [x] Criar o Volume montado em `/data` (do tamanho que precisar; o Hobby tem 5 GB e vídeo enche rápido).
- [x] Colar as variáveis (feito em 04/11/2026; `PRIVACIDADE_CONTATO`, `OPENAI_API_KEY` e `PRIVACIDADE_APROVADA` ficaram de fora por enquanto): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADMIN_LOGIN`, `ADMIN_SENHA`, `ADMIN_NOME`, `MIDIAS_DIR=/data/midias`, `MIDIAS_LIMITE_MB`, `PRIVACIDADE_CONTATO`, as 4 do WhatsApp `CHAVE_MESTRA` (texto longo e secreto, para salvar chaves pela tela) e (opcional) `OPENAI_API_KEY`. As chaves de texto e áudio também podem ser coladas em Configurações > Chaves de API.
- [x] Gerar o domínio e abrir `/api/saude` (deve responder `{"ok":true}`). Feito em 04/11/2026.
- [x] Depois do primeiro acesso: **apagar `ADMIN_SENHA`** do Railway. Feito em 04/11/2026 (o login continuou funcionando).
- [x] Conferir que a variável `MODO_SIMULADOR` **não existe** no Railway. Confirmado pelo Mateus em 04/11/2026.
- [ ] Ligar e confirmar o backup do Postgres. **Confirmado em 04/11/2026: no plano Hobby o Railway só mostra backups existentes; criar backup, agendar e recuperação por ponto no tempo exigem o plano Pro.** Hoje não existe backup de nada: decidir entre plano Pro, ou rotina própria de `pg_dump` enviada para um armazenamento externo. **O backup não cobre o Volume** (fotos, vídeos e documentos): decidir se vale ter cópia. **Decisão (Mateus, 05/11/2026): começa no plano Hobby e migra para o Pro depois; quando migrar, ligar o backup e decidir sobre o Volume.** (Item fica aberto até a migração.)

### Decisões e textos para aprovar
- [x] Textos dos modelos da Meta (`src/regras/modelos.ts`); sugestão: incluir "Responda PARAR para não receber mais mensagens". Aprovado em 05/11/2026, com "Responda PARAR" nos três textos. Falta criar os modelos na Meta com o texto de `src/regras/modelos.ts`.
- [x] Texto de confirmação do "parar" (`src/regras/optout.ts`). Aprovado em 05/11/2026.
- [x] Política de privacidade (`src/regras/privacidade.ts`): o Mateus aprovou o texto em 04/11/2026 (inclui "Anthropic ou OpenAI" no atendimento), e os dados (razão social, CNPJ, e-mail, prazos) já estão no texto; base legal ficou de fora por decisão dele. Mateus: "está feito" (05/11/2026). Falta só (1) conferir o texto final em `/privacidade`, se ainda não conferiu; (2) `PRIVACIDADE_APROVADA=1` definido no Railway (Mateus, 04/11/2026); (3) conferir se o telefone (88) 98213-5125 é o mesmo número cadastrado na Meta; (4) rotina dos 180 dias feita (04/11/2026, `servicos/rotinas.ts`); o Mateus sabe que o painel de vendas perde o histórico de quem foi excluído. Mateus informou em 05/11/2026 que a conferência do texto, do telefone e do `PRIVACIDADE_APROVADA=1` está feita.
- [x] Decidir se "cliente que escreveu primeiro" vale como consentimento (`src/regras/consentimento.ts`). Decidido em 05/11/2026: vale.
- [x] Limites do bot por cliente: 8 por minuto e 150 por dia (`src/regras/limite-bot.ts`). Aprovado em 05/11/2026.
- [x] Limites de tamanho de arquivo: imagem 5 MB, vídeo 16 MB, documento 25 MB (`src/regras/midia.ts`); DWG e ZIP grandes podem passar disso. Aprovado em 05/11/2026.
- [x] Revisão jurídica da LGPD, em especial o áudio enviado à OpenAI e o aviso de privacidade. Mateus: feito (05/11/2026).
- [ ] (Opcional) Colar no bot a instrução sobre áudio transcrito (texto sugerido no `docs/colocar-no-ar.md`).
- [ ] **Colar as instruções atualizadas** (tarefa 20, 04/11/2026): o projeto não guarda mais cópia das instruções. Quando a tarefa 20 estiver na `main`, colar as 01–13 do repositório de instruções em Configurações > Instruções de atendimento, **no Railway e no computador** (substituir as antigas). A antiga 15 vira o Manual do CRM e a 14 sai sozinhas na primeira abertura. A 05 nova (bot não agenda; "Anotado! O consultor confirma com você.") foi aprovada em 04/11/2026.
- [ ] **Novo funil (tarefa 21)**: conferir no simulador as 8 colunas, a agenda com visita à loja / medição (2h) / apresentação e o painel. Confirmar as decisões anotadas no topo de `tarefas/21-novo-funil-kanban.md`. Quando for para a `main`, os cards de teste nas colunas antigas mudam sozinhos ao subir o servidor (Visita agendada → Apresentação, Orçamento → Negociação, Sem resposta → Perdido "Parou de responder").
- [ ] **Tarefa 22** (sem "Aguardando consultor", lembrete na ficha): conferir no simulador. Se o Manual do CRM já estiver no banco, trocar na tela "move o card para Aguardando consultor" (ou "Pronto para o consultor") por "move o card para Em qualificação".
- [ ] Aprovar o texto do **Manual do CRM** (PROVISÓRIO; aparece em Configurações > Instruções, abaixo das numeradas).

## B. Do Claude (código)
- [x] **Tela de usuários** (Configurações > Geral > Equipe: criar, editar, nova senha, desativar, transferir leads) e **"trocar minha senha"** no cabeçalho (04/11/2026). Senha: 6+ caracteres com letra, número e maiúscula. Limitação conhecida: trocar a senha não derruba a sessão aberta (12 h); desativar derruba na hora (decisão do Mateus: não precisa agora).
- [x] Isolamento de arquivos entre vendedores (a galeria é só um filtro; hoje qualquer logado abre qualquer arquivo se souber o nome). Decidir primeiro se os vendedores devem ver conversas uns dos outros, porque a ficha hoje mostra. **Decisão do Mateus (05/11/2026): todos os vendedores veem as conversas de todos e nunca houve problema; fica assim. Cada um filtra só as suas ("Meus leads").**
- [ ] Lead duplicado se uma mensagem com o 9 (digitada na loja) e outra sem (vinda do webhook) chegarem exatamente juntas (`obterOuCriarLead`).
- [x] Status da Meta ("entregue", "lido") que chega antes de a mensagem ser gravada se perde (só visual). Corrigido em 05/11/2026: o evento fica pendente e é reaplicado em 2 s, 10 s e 1 min.
- [ ] Status "falhou" vindo da Meta não desfaz `ultimaMsgLojaEm`.
- [x] ~~Opcional: mandar PDF ao Claude para o bot ler~~ Decisão do Mateus (05/11/2026): o bot NÃO lê PDF nem outros arquivos; só texto, áudio transcrito e imagem. Feito e depois desfeito no mesmo dia.
- [ ] Dívida: a rota de arquivos lê o arquivo inteiro a cada pedido (usar `createReadStream` com Range).

## C. Nunca foi testado de verdade (conferir no primeiro deploy)
- [ ] **Avisos com o CRM minimizado (Web Push, 05/11/2026).** Feito e testado só com simulação: o sistema de teste não tem como assinar de verdade no Google/Microsoft. Falta o Mateus, no Windows (Chrome ou Edge): abrir o sino, ligar "Avisar com o CRM fechado ou minimizado", clicar em "Testar com o CRM minimizado" e minimizar. Conferir também uma mensagem real de cliente e o clique no cartão levando à conversa.
- [ ] **Privacidade dos avisos:** o cartão leva o nome do cliente e um trecho da mensagem. O conteúdo vai criptografado de ponta a ponta para o navegador (Google, Microsoft e Mozilla só repassam e não conseguem ler), mas o Mateus pode querer citar isso na política de privacidade.
- [x] Railway: build, migração do Postgres, Volume, healthcheck (04/11/2026).
- [ ] Meta: verificação do webhook (feita, 04/11/2026) e receber/enviar **texto** (feito: o cliente escreveu e o bot respondeu). Recebimento de foto, vídeo, ZIP e documentos testado e funcionando (Mateus, 04/11/2026). Falta testar: enviar modelo/arquivo pela loja e status de entrega.
- [ ] OpenAI: transcrição de áudio real. Sem `OPENAI_API_KEY` o áudio chega e o bot avisa o cliente que ainda não atende áudio (comportamento confirmado em 04/11/2026); falta colocar a chave e testar a transcrição.
- [ ] Navegador: vídeo avançando e voltando, abrir imagem e vídeo em outra aba (CSP), anexar arquivo. Galeria funcionando e vídeo recebido (04/11/2026).
- [ ] Tela, ponta a ponta, com o celular do Mateus.
