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
| `ANTHROPIC_API_KEY` | sua chave da Anthropic (ou cole em Configurações > Chaves de API; a da tela vale mais) |
| `ADMIN_LOGIN` | o login do seu administrador (ex.: `mateus`) |
| `ADMIN_SENHA` | uma senha **longa** (mínimo 6, com letra, número e uma maiúscula) |
| `ADMIN_NOME` | seu nome |
| `MIDIAS_DIR` | `/data/midias` |
| `MIDIAS_LIMITE_MB` | tamanho do seu Volume em MB (ex.: `5000`), para mostrar a porcentagem usada |
| `PRIVACIDADE_CONTATO` | e-mail ou telefone para pedidos de dados (aparece em `/privacidade`) |
| `CHAVE_MESTRA` | texto longo e secreto (16+ caracteres) que criptografa as chaves salvas em Configurações > Chaves de API. Sem ela, as chaves só valem pelas variáveis abaixo |
| `OPENAI_API_KEY` | (opcional) chave da OpenAI para transcrever áudios; sem ela o bot avisa que não consegue ouvir |

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
3. **Número:** adicione o número da loja e **verifique-o** no WhatsApp Manager (código por SMS ou ligação). **Atenção:** um número que já está no aplicativo WhatsApp (ou WhatsApp Business) do celular precisa sair dele antes de ir para a API; depois disso você deixa de usar o app comum com esse número. Não tenho certeza de todos os detalhes dessa migração: confirme na Meta antes de mexer no número que você usa hoje.
4. **Os 4 valores:**
   - `WHATSAPP_PHONE_NUMBER_ID`: o "Phone number ID" (não é o telefone), na tela WhatsApp → "API Setup".
   - `WHATSAPP_TOKEN`: crie um token **permanente** (usuário do sistema em Business Settings, com as permissões `whatsapp_business_messaging` **e** `whatsapp_business_management`). O token temporário de 24 h não serve.
   - `META_APP_SECRET`: Configurações do app → Básico → "Chave secreta do app".
   - `WHATSAPP_VERIFY_TOKEN`: invente você (texto longo e aleatório). Guarde, vai usar no passo 6.
5. **Cole os 4 no Railway** (Variables). O serviço reinicia sozinho.
5b. **Registre o número na API** (passo obrigatório; não dá para fazer só pelo painel). Escolha um PIN de 6 dígitos e **guarde-o**. No seu computador, com as 4 variáveis no `.env` apontando para a mesma conta: `npx tsx scripts/registrar-numero.ts 123456` (troque pelo seu PIN). Deve aparecer "Número registrado com sucesso". Se o número já tinha verificação em duas etapas, use o PIN que ele já tem.
5c. **Nome de exibição:** na Meta, o nome que aparece para o cliente (ex.: "Eccellenza Móveis Planejados") precisa ser aprovado e combinar com os dados da empresa.
5d. **Forma de pagamento:** cadastre no WhatsApp Manager. Mensagens de modelo (fora das 24h) são cobradas por mensagem; a conversa dentro das 24h, iniciada pelo cliente, é de graça. Confira a tabela de preços em reais na página oficial de preços da Meta, que muda a cada trimestre.
5e. **Política de privacidade:** a Meta pede um endereço público. Use `SEU-ENDEREÇO/privacidade`. O texto hoje é um **rascunho** (trechos entre colchetes a preencher e revisão jurídica). Quando aprovado, defina `PRIVACIDADE_APROVADA=1` no Railway para tirar o aviso de rascunho. Também costuma ser preciso colocar o app da Meta em modo "Live" para receber mensagens de clientes reais (não confirmei isso nas páginas oficiais; confira).
6. **Webhook:** na Meta, WhatsApp → Configuration → Webhook. Em "Callback URL" ponha `SEU-ENDEREÇO/api/whatsapp/webhook`, em "Verify token" o mesmo `WHATSAPP_VERIFY_TOKEN`, e clique em verificar. Depois **assine o campo `messages`**.
7. **Modelos de mensagem** (necessários para falar com cliente depois de 24 h sem resposta, como a retomada): na Meta crie modelos com **o mesmo nome do código** usado no CRM (`retomada`, `primeiro_contato`, `lembrete_visita`), idioma português (Brasil), **sem variáveis**. Os textos hoje são PROVISÓRIOS; você precisa aprová-los antes de enviar à Meta. A Meta aprova em horas ou dias.
8. **Teste:** mande uma mensagem do seu celular para o número da loja. Ela deve aparecer no CRM (Configurações → cartão WhatsApp mostra os últimos avisos da Meta, com erros se houver).

Se a Meta recusar a "versão da API" (erro de versão no cartão WhatsApp), defina `WHATSAPP_API_VERSION` no Railway com a versão atual que a Meta mostrar.

## Consentimento e "parar" (como o sistema se comporta)
- **Mensagem iniciada pela loja** (modelo, depois de 24h sem resposta, como a retomada): só sai para quem tem consentimento registrado. Hoje, por decisão **provisória**, quem escreveu primeiro para a loja conta como consentimento (`src/regras/consentimento.ts`); decida isso com o jurídico. Número digitado pela loja em "Nova mensagem" pede que você escolha como o cliente autorizou (formulário, pessoalmente ou outro), e fica registrado na ficha.
- Quem escreve **PARAR** (ou "sair", "cancelar"...) para de receber retomada e modelos, e o bot não responde mais. Um consultor pode devolver ao bot se o cliente mudar de ideia.
- A Meta recomenda dar instrução de como sair. Sugiro incluir "Responda PARAR para não receber mais mensagens" nos modelos (texto a aprovar).
- Brasil e o nono dígito: o WhatsApp conhece muitos números **sem o 9**. O sistema trata as duas formas como a mesma pessoa e responde para o número no formato que a Meta informar.

## Imagens, vídeos e documentos (PDF, Word, Excel, DWG, ZIP)
- **Receber:** imagem, vídeo MP4, PDF, Word (doc/docx), Excel (xls/xlsx), DWG e ZIP do cliente ficam guardados e aparecem na conversa e na **Galeria**. **Qualquer outro arquivo que o cliente mandar como "documento"** (PowerPoint, RAR, 7z, SKP, TXT, CSV...) também fica guardado como **"Arquivo genérico"**: o conteúdo não dá para conferir, ele só baixa (nunca abre no site) e aparece na galeria com a extensão (ex.: "RAR"). **Ficam bloqueados e nem são baixados**: programas, scripts, páginas e arquivos com macro (`.exe`, `.msi`, `.bat`, `.cmd`, `.js`, `.vbs`, `.ps1`, `.jar`, `.lnk`, `.html`, `.svg`, `.xml`, `.docm`, `.xlsm`, `.apk`, `.iso` e parecidos); a mensagem do cliente fica registrada com o aviso. Imagem e vídeo de formato estranho não entram nesse modo. Para ENVIAR a lista continua fechada (a Meta provavelmente recusa o resto). O sistema reconhece Word, Excel e DWG também pela extensão do nome (a Meta e o navegador costumam informar um tipo genérico) e **confere o conteúdo**; se não bater (ex.: executável com nome de DWG), o arquivo não é guardado, mas a mensagem do cliente fica registrada com um aviso.
- **Enviar:** o vendedor usa o clipe 📎 na conversa (com legenda opcional). Só dentro das 24h, como texto livre; fora disso só modelo. **Para enviar:** imagem JPG ou PNG, vídeo MP4, PDF, Word e Excel (do que conheço, é o que a Meta aceita), DWG e ZIP. **Atenção com DWG e ZIP: não tenho certeza de que a Meta aceite enviar esses tipos pela API** (o aplicativo do celular aceita qualquer arquivo, mas a API da empresa costuma ter uma lista fechada de tipos). Se ela recusar, a mensagem fica "falhou" e o jeito é mandar PDF. WEBP, GIF e 3GP o cliente pode mandar, mas a loja não envia. Não conferi a lista de tipos na página oficial da Meta.
- **Galeria:** cada vendedor vê os arquivos dos leads dele; o admin vê todos e filtra por vendedor. Cada arquivo tem Baixar, Abrir e "ver a conversa". **Só o admin apaga** arquivo.
- **Não há pasta no PC do vendedor** (decisão: tudo fica no Railway). O vendedor baixa pelo botão quando precisar.
- **Apagar:** excluir uma conversa apaga os arquivos dela, e o sistema **avisa antes** quantos arquivos e MB vão junto. Arquivos com mais de **180 dias** são apagados sozinhos (a galeria avisa quando faltam 30 dias ou menos).
- **Tamanho máximo (PROVISÓRIO):** imagem 5 MB, vídeo 16 MB, documentos (PDF, Word, Excel, DWG, ZIP) 25 MB. **DWG e ZIP de projeto grande podem passar de 25 MB**: nesse caso o sistema avisa na conversa que não guardou; se isso acontecer, me diga para aumentarmos (lembrando do espaço do Volume). Os limites da Meta para vídeo e documento **não foram conferidos**; se a Meta recusar um arquivo, a mensagem fica "falhou".
- **Espaço:** o plano Hobby do Railway tem 5 GB e vídeo enche rápido. Crie o Volume do tamanho que precisar e defina `MIDIAS_LIMITE_MB` (ex.: `5000`) para o sistema mostrar a porcentagem usada em Configurações. O Railway também mostra o uso do Volume no painel dele (não consegui confirmar daqui onde).
- **Backup:** o backup do Postgres **não cobre o Volume**. Fotos, vídeos e PDFs não têm cópia de segurança, a menos que você configure uma.
- **Segurança:** documentos (PDF, Word, Excel, DWG, ZIP) nunca abrem dentro do site (sempre baixam). O sistema confere se o arquivo é do tipo que diz ser. Word e Excel antigos (doc, xls) podem trazer macros: se o programa perguntar se quer habilitar macros, **não habilite** em arquivo de cliente. O sistema não abre nem descompacta ZIP, só guarda. Abra no seu computador com antivírus.
- O bot **não vê** vídeo nem documento (só imagem); ele recebe o aviso de que o arquivo chegou.

## Transcrição de áudio (Whisper)
- Com `OPENAI_API_KEY`, áudio que o cliente manda vira texto (`[áudio transcrito automaticamente] ...`) e o bot lê esse texto. O **áudio não fica guardado**, só a transcrição. O modelo padrão é o `gpt-4o-mini-transcribe` (escolha do Mateus); dá para trocar pela variável `OPENAI_TRANSCRICAO_MODELO` (ex.: `whisper-1`, `gpt-4o-transcribe`).
- Aceita recado de voz do WhatsApp (ogg) e áudios mp3, m4a, wav, webm e flac, até 16 MB. Formatos `aac` e `amr` a OpenAI não lista: nesses o sistema avisa que não conseguiu processar.
- **LGPD:** o áudio do cliente é enviado à OpenAI (empresa dos EUA). Isso já está na política de privacidade (rascunho). Confira com o jurídico e veja nas configurações da sua conta OpenAI por quanto tempo ela guarda os dados da API; não verifiquei isso.
- Custo: confira o preço por minuto na página de preços da OpenAI. Não verifiquei.
- Sugestão de instrução para o bot (você cola em Configurações > Instruções, se concordar): "Mensagens que começam com [áudio transcrito automaticamente] vêm de um recado de voz e podem ter erros de transcrição. Se algo importante (medida, endereço, valor) parecer duvidoso, confirme com o cliente antes de gravar."

## Antes de atender clientes de verdade (checklist)
- [ ] `/api/saude` responde `{"ok":true}`.
- [ ] Entrei com o admin e a senha longa; **não existe** nenhum usuário de teste (`mateus123` etc.: o seed é bloqueado em produção).
- [ ] Variável `MODO_SIMULADOR` **não existe** no Railway.
- [ ] Apaguei `ADMIN_SENHA` depois do primeiro acesso.
- [ ] Volume montado e `MIDIAS_DIR=/data/midias`.
- [ ] Backup do Postgres ligado e confirmado.
- [ ] Número registrado com o PIN (`registrar-numero`) e PIN guardado.
- [ ] Nome de exibição aprovado e forma de pagamento cadastrada.
- [ ] `/privacidade` abre sem login e o texto foi aprovado (`PRIVACIDADE_APROVADA=1`).
- [ ] Webhook verificado e mensagem de teste chegou (texto, imagem e áudio).
- [ ] Aprovei os textos que o cliente final lê (retomada, primeiro contato, lembrete, confirmação de "parar") e decidi se "cliente escreveu primeiro" vale como consentimento.
- [ ] Aprovei os limites do bot (8 mensagens por minuto e 150 por dia por cliente, provisórios).
- [ ] Olhei o cartão "Uso do bot" no fim do primeiro dia e a primeira fatura da Anthropic.
- [ ] Conferi com quem cuida da parte jurídica o aviso de privacidade (LGPD). Não sou advogado.

## Para testar sem WhatsApp, em produção
Defina `MODO_SIMULADOR=1` no Railway: liga o Simulador e o relógio simulado, e **desliga o envio real pelo WhatsApp** (mesmo com as chaves da Meta preenchidas, para nenhum cliente fictício receber mensagem de verdade). **Qualquer usuário logado poderá mexer no relógio**, então use só em teste e **apague a variável** antes de atender clientes reais.

## Para mudar o banco no futuro (para mim, não para você)
O esquema do banco é um só (`prisma/schema.prisma`, SQLite no seu computador). Depois de mudar: `npm run esquema:postgres`, criar a migração nova em `prisma/postgres/migrations/` e `npm test` (o teste `esquema.test.ts` barra se esquecer). Para rodar os testes num Postgres: `CRM_TESTE_POSTGRES=postgresql://.../crm_teste npm run test:postgres`.
