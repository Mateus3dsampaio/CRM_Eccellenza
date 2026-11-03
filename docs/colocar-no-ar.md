# Colocar o CRM no ar (Railway + WhatsApp)

Tudo no código já está pronto. Falta só **você** fazer as partes que exigem a sua conta (Railway e Meta) e colar os valores. Nada aqui foi testado no Railway nem na Meta de verdade (não tenho acesso às suas contas): o primeiro deploy pode pedir um ajuste, e as telas dos dois sites mudam de lugar de vez em quando. Em caso de dúvida, me mande o erro.

**Regra de ouro:** chaves e senhas você cola direto nas "Variables" do Railway. Não precisa me mandar nenhuma e não escreva em arquivo do projeto.

## Parte 1 – Railway (uns 30 minutos)

1. **Conta e plano.** Entre em railway.com. O plano Hobby ($5/mês) serve para começar.
2. **Novo projeto:** "New Project" → "Deploy from GitHub repo" → escolha `crm_eccellenza` e o branch que eu indicar. O Railway acha o `Dockerfile` e o `railway.json` sozinho.
3. **Banco:** no mesmo projeto, "New" → "Database" → "Add PostgreSQL".
4. **Disco para fotos e plantas (Volume):** no serviço do CRM, "Settings" → "Volumes" (ou "New" → "Volume") → montar em `/data`. Sem isso as fotos somem a cada atualização.
5. **Variáveis** (serviço do CRM → "Variables"):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | clique em "Add Reference" e escolha `DATABASE_URL` do Postgres |
| `ANTHROPIC_API_KEY` | sua chave da Anthropic |
| `ADMIN_LOGIN` | o login do seu administrador (ex.: `mateus`) |
| `ADMIN_SENHA` | uma senha **longa** (mínimo 10 caracteres) |
| `ADMIN_NOME` | seu nome |
| `MIDIAS_DIR` | `/data/midias` |

   As quatro do WhatsApp (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`) ficam para a Parte 2. Sem elas o sistema sobe normalmente, só que **sem enviar nem receber WhatsApp**.
6. **Domínio:** "Settings" → "Networking" → "Generate Domain". Anote o endereço (algo como `https://crm-eccellenza-production.up.railway.app`).
7. **Primeiro acesso:** abra o endereço e entre com `ADMIN_LOGIN` e `ADMIN_SENHA`. O administrador é criado sozinho na primeira vez. (Depois, mudar `ADMIN_SENHA` no Railway não muda a senha já criada.) **Depois de entrar, apague a variável `ADMIN_SENHA` do Railway**: a senha não precisa ficar guardada lá.
8. **Backup do banco:** no serviço do Postgres, veja a aba "Backups" e ligue. **Confirme na sua conta se o seu plano inclui backup**; eu não consigo verificar daqui.
9. **Conferir:** abra `SEU-ENDEREÇO/api/saude`. Deve aparecer `{"ok":true}`.

Novos consultores: ainda não há tela para criar usuários (ficou para depois). Peça para mim, ou rode no seu computador, apontando para o banco do Railway: `npx tsx scripts/criar-usuario.ts <login> "<Nome>" consultor <senha-longa>`.

## Parte 2 – WhatsApp oficial (Meta)

Isto leva dias por causa das aprovações da Meta. **Comece cedo.**

1. **Meta Business:** em business.facebook.com crie/entre na conta da Eccellenza e faça a **verificação da empresa** (CNPJ, documentos). Sem ela o WhatsApp fica limitado.
2. **App na Meta:** em developers.facebook.com crie um app do tipo "Business" e adicione o produto **WhatsApp**.
3. **Número:** adicione o número da loja. **Atenção:** um número que já está no aplicativo WhatsApp (ou WhatsApp Business) do celular precisa sair dele antes de ir para a API; depois disso você deixa de usar o app comum com esse número. Não tenho certeza de todos os detalhes dessa migração: confirme na Meta antes de mexer no número que você usa hoje.
4. **Os 4 valores:**
   - `WHATSAPP_PHONE_NUMBER_ID`: o "Phone number ID" (não é o telefone), na tela WhatsApp → "API Setup".
   - `WHATSAPP_TOKEN`: crie um token **permanente** (usuário do sistema em Business Settings, com permissão `whatsapp_business_messaging`). O token temporário de 24 h não serve.
   - `META_APP_SECRET`: Configurações do app → Básico → "Chave secreta do app".
   - `WHATSAPP_VERIFY_TOKEN`: invente você (texto longo e aleatório). Guarde, vai usar no passo 6.
5. **Cole os 4 no Railway** (Variables). O serviço reinicia sozinho.
6. **Webhook:** na Meta, WhatsApp → Configuration → Webhook. Em "Callback URL" ponha `SEU-ENDEREÇO/api/whatsapp/webhook`, em "Verify token" o mesmo `WHATSAPP_VERIFY_TOKEN`, e clique em verificar. Depois **assine o campo `messages`**.
7. **Modelos de mensagem** (necessários para falar com cliente depois de 24 h sem resposta, como a retomada): na Meta crie modelos com **o mesmo nome do código** usado no CRM (`retomada`, `primeiro_contato`, `lembrete_visita`), idioma português (Brasil), **sem variáveis**. Os textos hoje são PROVISÓRIOS; você precisa aprová-los antes de enviar à Meta. A Meta aprova em horas ou dias.
8. **Teste:** mande uma mensagem do seu celular para o número da loja. Ela deve aparecer no CRM (Configurações → cartão WhatsApp mostra os últimos avisos da Meta, com erros se houver).

Se a Meta recusar a "versão da API" (erro de versão no cartão WhatsApp), defina `WHATSAPP_API_VERSION` no Railway com a versão atual que a Meta mostrar.

## Antes de atender clientes de verdade (checklist)
- [ ] `/api/saude` responde `{"ok":true}`.
- [ ] Entrei com o admin e a senha longa; **não existe** nenhum usuário de teste (`mateus123` etc.: o seed é bloqueado em produção).
- [ ] Variável `MODO_SIMULADOR` **não existe** no Railway.
- [ ] Apaguei `ADMIN_SENHA` depois do primeiro acesso.
- [ ] Volume montado e `MIDIAS_DIR=/data/midias`.
- [ ] Backup do Postgres ligado e confirmado.
- [ ] Webhook verificado e mensagem de teste chegou.
- [ ] Aprovei os textos que o cliente final lê (retomada, primeiro contato, lembrete, confirmação de "parar").
- [ ] Aprovei os limites do bot (8 mensagens por minuto e 150 por dia por cliente, provisórios).
- [ ] Olhei o cartão "Uso do bot" no fim do primeiro dia e a primeira fatura da Anthropic.
- [ ] Conferi com quem cuida da parte jurídica o aviso de privacidade (LGPD). Não sou advogado.

## Para testar sem WhatsApp, em produção
Defina `MODO_SIMULADOR=1` no Railway: liga o Simulador e o relógio simulado, e **desliga o envio real pelo WhatsApp** (mesmo com as chaves da Meta preenchidas, para nenhum cliente fictício receber mensagem de verdade). **Qualquer usuário logado poderá mexer no relógio**, então use só em teste e **apague a variável** antes de atender clientes reais.

## Para mudar o banco no futuro (para mim, não para você)
O esquema do banco é um só (`prisma/schema.prisma`, SQLite no seu computador). Depois de mudar: `npm run esquema:postgres`, criar a migração nova em `prisma/postgres/migrations/` e `npm test` (o teste `esquema.test.ts` barra se esquecer). Para rodar os testes num Postgres: `CRM_TESTE_POSTGRES=postgresql://.../crm_teste npm run test:postgres`.
