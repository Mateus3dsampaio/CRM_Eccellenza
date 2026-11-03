# Pendências (para a próxima sessão)

Lista única do que falta para o CRM entrar no ar. Marque `[x]` ao concluir e anote a data. Guia de como fazer cada passo: `docs/colocar-no-ar.md`.
Última atualização: 04/11/2026 (versão 0.8.0).

## A. Do Mateus (conta, chave, decisão)

### Meta / WhatsApp (começar primeiro: leva dias)
- [ ] Verificar a empresa na Meta Business (CNPJ e documentos).
- [ ] Criar o app da Meta com o produto WhatsApp.
- [ ] Liberar o número da loja para a API oficial (ele sai do app comum; confirmar como migrar com a Meta).
- [ ] Registrar o número com o PIN de 6 dígitos (`npx tsx scripts/registrar-numero.ts <PIN>`) e **guardar o PIN**.
- [ ] Aprovar o nome de exibição (ex.: "Eccellenza Móveis Planejados").
- [ ] Cadastrar a forma de pagamento no WhatsApp Manager e conferir a tabela de preços em reais.
- [ ] Gerar o token permanente (permissões `whatsapp_business_messaging` e `whatsapp_business_management`).
- [ ] Criar e aprovar os modelos de mensagem na Meta, com o mesmo nome do código (`retomada`, `primeiro_contato`, `lembrete_visita`), pt_BR, sem variáveis.
- [ ] Cadastrar o webhook (`SEU-ENDEREÇO/api/whatsapp/webhook`) e assinar o campo `messages` (só depois do Railway no ar).
- [ ] Conferir na página oficial da Meta: tipos aceitos no ENVIO (**DWG e ZIP são incertos**), limites de tamanho de vídeo e documento, versão atual da API (`WHATSAPP_API_VERSION`, padrão `v23.0`), se o app precisa estar em modo "Live".

### Railway
- [ ] Criar o projeto (Hobby) e conectar o repositório / branch.
- [ ] Adicionar o Postgres.
- [ ] Criar o Volume montado em `/data` (do tamanho que precisar; o Hobby tem 5 GB e vídeo enche rápido).
- [ ] Colar as variáveis: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADMIN_LOGIN`, `ADMIN_SENHA`, `ADMIN_NOME`, `MIDIAS_DIR=/data/midias`, `MIDIAS_LIMITE_MB`, `PRIVACIDADE_CONTATO`, as 4 do WhatsApp e (opcional) `OPENAI_API_KEY`.
- [ ] Gerar o domínio e abrir `/api/saude` (deve responder `{"ok":true}`).
- [ ] Depois do primeiro acesso: **apagar `ADMIN_SENHA`** do Railway.
- [ ] Conferir que a variável `MODO_SIMULADOR` **não existe** no Railway.
- [ ] Ligar e confirmar o backup do Postgres. **O backup não cobre o Volume** (fotos, vídeos e documentos): decidir se vale ter cópia.

### Decisões e textos para aprovar
- [ ] Textos dos modelos da Meta (`src/regras/modelos.ts`); sugestão: incluir "Responda PARAR para não receber mais mensagens".
- [ ] Texto de confirmação do "parar" (`src/regras/optout.ts`).
- [ ] Política de privacidade (`src/regras/privacidade.ts`): preencher os trechos [entre colchetes] e depois definir `PRIVACIDADE_APROVADA=1`.
- [ ] Decidir se "cliente que escreveu primeiro" vale como consentimento (`src/regras/consentimento.ts`).
- [ ] Limites do bot por cliente: 8 por minuto e 150 por dia (`src/regras/limite-bot.ts`).
- [ ] Limites de tamanho de arquivo: imagem 5 MB, vídeo 16 MB, documento 25 MB (`src/regras/midia.ts`); DWG e ZIP grandes podem passar disso.
- [ ] Revisão jurídica da LGPD, em especial o áudio enviado à OpenAI e o aviso de privacidade.
- [ ] (Opcional) Colar no bot a instrução sobre áudio transcrito (texto sugerido no `docs/colocar-no-ar.md`).

## B. Do Claude (código)
- [x] **Tela de usuários** (Configurações > Geral > Equipe: criar, editar, nova senha, desativar, transferir leads) e **"trocar minha senha"** no cabeçalho (04/11/2026). Senha: 6+ caracteres com letra, número e maiúscula. Limitação conhecida: trocar a senha não derruba a sessão aberta (12 h); desativar derruba na hora (decisão do Mateus: não precisa agora).
- [ ] Isolamento de arquivos entre vendedores (a galeria é só um filtro; hoje qualquer logado abre qualquer arquivo se souber o nome). Decidir primeiro se os vendedores devem ver conversas uns dos outros, porque a ficha hoje mostra.
- [ ] Lead duplicado se uma mensagem com o 9 (digitada na loja) e outra sem (vinda do webhook) chegarem exatamente juntas (`obterOuCriarLead`).
- [ ] Status da Meta ("entregue", "lido") que chega antes de a mensagem ser gravada se perde (só visual).
- [ ] Status "falhou" vindo da Meta não desfaz `ultimaMsgLojaEm`.
- [ ] Opcional: mandar PDF ao Claude para o bot ler (hoje o bot só vê imagem).
- [ ] Dívida: a rota de arquivos lê o arquivo inteiro a cada pedido (usar `createReadStream` com Range).

## C. Nunca foi testado de verdade (conferir no primeiro deploy)
- [ ] Railway: build, migração do Postgres, Volume, healthcheck.
- [ ] Meta: verificação do webhook, receber texto/imagem/áudio/documento, enviar texto/modelo/arquivo, status de entrega.
- [ ] OpenAI: transcrição de áudio real.
- [ ] Navegador: vídeo avançando e voltando, abrir imagem e vídeo em outra aba (CSP), galeria, anexar arquivo.
- [ ] Tela, ponta a ponta, com o celular do Mateus.
