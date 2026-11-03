# CRM Eccellenza – simulador

## O que é este projeto
CRM com atendimento por IA (API do Claude) para a **Eccellenza**, loja de móveis planejados Italínea em Juazeiro do Norte – CE. Dono: **Mateus**.
Nesta fase é um **simulador**: roda no computador, sem WhatsApp real. O cliente é simulado numa tela de chat, o bot atende com as instruções da loja e o CRM é preenchido sozinho (kanban, ficha do lead, agenda, painel).
Leia antes de qualquer trabalho: `docs/briefing.md`, `docs/requisitos.md` e `docs/design.md`.
**Para achar onde mexer no código, comece por `docs/mapa-do-codigo.md`** (camadas, uma linha por arquivo, "onde mexer para…"). Não vasculhe o projeto antes de ler o mapa.

## Como falar com o Mateus
- Sempre em português do Brasil, direto e sem jargão desnecessário.
- Ele é exigente com layout e design. Visual profissional, com profundidade e animação, é requisito, não enfeite.
- Seja franco: se uma ideia criar risco comercial, jurídico (LGPD, termos da Meta) ou técnico, diga.

## Regras do projeto
- **Mapa do código sempre atualizado.** Ao mudar algo relevante, atualize `docs/mapa-do-codigo.md` na mesma alteração, antes de dar o trabalho como pronto. É relevante: criar, apagar ou renomear arquivo de código; mudar o que um arquivo faz; nova rota da API, tabela do banco, ferramenta do bot, tela ou regra de negócio; mudar qual serviço uma rota usa. Correção interna que não muda a função de nada não precisa. O teste `testes/unit/mapa.test.ts` barra arquivo faltando ou fantasma, mas o conteúdo das linhas é responsabilidade de quem alterou.
- **Nada de executar ações irreversíveis ou externas sem autorização do Mateus**: push, publicar, enviar mensagem real, contratar serviço, apagar arquivos fora do projeto.
- **Nunca envie mensagem real de WhatsApp** nesta fase. Toda integração com a Meta é simulada.
- **A chave da API (`ANTHROPIC_API_KEY`) fica no `.env`, colocada pelo Mateus.** Nunca escreva, exiba ou registre a chave em log.
- **Dados de clientes reais não entram no simulador.** Use só dados fictícios (seed).
- **Nunca invente política da loja** (preço, prazo, garantia, pagamento, cidades atendidas, regras de agenda). A fonte é a instrução 14 (Dados da loja). Se faltar, pergunte ao Mateus ou marque como PROVISÓRIO no código e no briefing.
- **Textos que o cliente final vai ler** (mensagem de retomada, modelos de mensagem, novas falas do bot) são propostos e o Mateus aprova antes de valerem.
- Antes de escrever código que usa a API do Claude, consulte a skill `claude-api` (modelos, preços e uso de ferramentas atuais).

## Instruções do bot: de onde vêm
- **A partir de 31/10/2026 o CRM é a fonte principal das instruções de atendimento.** Elas ficam no banco (tabela `Instrucao`) e o admin edita em Configurações > Instruções de atendimento (criar, editar, reordenar, desativar, exportar; guarda só a versão anterior). O bot lê do banco a cada conversa (`src/servicos/instrucoes.ts`, `src/bot/prompt.ts`).
- **Única fonte do que o bot segue: o banco.** Roteiro (01-13), dados da loja (14) e regras do CRM e ferramentas (15) são instruções; não existe `loja.md` nem `complemento-crm.md`, e `src/bot/prompt.ts` só tem a abertura fixa (identidade e tags de segurança). Qualquer regra nova do bot entra como instrução, nunca como texto no código.
- `agente/instrucoes/*.txt` (15 arquivos) agora são só a **carga inicial**: copiadas para o banco uma vez, quando a tabela está vazia (primeiro uso ou depois do `npm run seed`). Editar esses arquivos não muda o bot que já está rodando, e o `/sincronizar-instrucoes` não atualiza mais as instruções do banco. Não use os arquivos para mudar o comportamento do bot: use a tela.
- Dados da loja = instrução 14. Regras do CRM (ferramentas, agenda, pausa, retomada) = instrução 15, PROVISÓRIA; mudanças nela precisam de aprovação do Mateus. Não há mais "prioridade" entre fontes: se duas instruções se contradisserem, corrija o texto delas.

## Como o trabalho é feito
- Trabalho em **rodadas** com o comando `/ciclo`: o orquestrador (a sessão principal) implementa, roda os testes, chama os revisores em paralelo, corrige o que for bloqueante e repete, até não restar bloqueante ou atingir o limite de rodadas.
- **Só a sessão principal escreve código.** Os agentes em `.claude/agents/` só leem, testam e apontam problemas.
- Cada rodada gera um relatório em `docs/rodadas/NN-descricao.md`.
- Revisores ativos na etapa 1: `revisor-requisitos`, `revisor-codigo`, `revisor-design`, `cliente-simulado`. O `diretor-de-arte` entra só na etapa 2 (layout), quando o Mateus liberar.

## Produção (Railway + WhatsApp Meta)
- **Pendências abertas: `docs/pendencias.md`** (o que falta do Mateus, do Claude e o que nunca foi testado). Leia no começo de cada sessão e atualize ao concluir algo.
- Código pronto; falta só o Mateus criar as contas e colar as variáveis. Guia: `docs/colocar-no-ar.md`. **Chaves da Meta, `DATABASE_URL`, `CHAVE_MESTRA` e senhas só existem como variáveis de ambiente**; nunca em arquivo versionado nem em log. As chaves de API do Claude e da OpenAI podem também ser coladas em Configurações > Chaves de API (decisão do Mateus 03/11/2026): ficam no banco criptografadas com a `CHAVE_MESTRA`, a da tela vale mais que a variável, e nunca voltam inteiras para a tela nem vão para log.
- Um esquema de banco só: `prisma/schema.prisma` (SQLite, computador e testes). Mudou o esquema → `npm run esquema:postgres` + migração nova em `prisma/postgres/migrations/` (o `esquema.test.ts` barra se esquecer). `npm run test:postgres` roda tudo num Postgres de teste.
- Produção desliga o simulador (`MODO_SIMULADOR`); `iniciar-crm.bat` liga de novo no computador do Mateus. Em produção sem chaves da Meta nenhuma mensagem "finge" ter sido enviada.
- PROVISÓRIOS aguardando o Mateus: limites do bot (`regras/limite-bot.ts`), textos de "parar" (`regras/optout.ts`), textos dos modelos da Meta (`regras/modelos.ts`), se "cliente escreveu primeiro" vale como consentimento (`regras/consentimento.ts`) e o texto da política de privacidade (`regras/privacidade.ts`).
- Mídias (imagem, vídeo MP4, PDF, Word, Excel, DWG, ZIP; recebe também qualquer outro documento como "arquivo genérico", exceto extensões bloqueadas como exe/bat/js/html; DWG e ZIP no envio pela Meta são incertos): ficam só no Volume do Railway (sem pasta no PC do vendedor, decisão do Mateus 04/11/2026); só o admin apaga; apagam sozinhas com 180 dias; excluir conversa avisa antes quantos arquivos vão junto. Limites de tamanho de vídeo/PDF PROVISÓRIOS (`regras/midia.ts`). O backup do Postgres não cobre o Volume.
- Transcrição de áudio (Whisper, `OPENAI_API_KEY`): o áudio é enviado à OpenAI e não é guardado, só o texto; está na política de privacidade. Chave só em variável de ambiente.

## Aparelho principal
- **PC** (decidido pelo Mateus em 03/11/2026). O agente `designer` otimiza só para PC (1440×900 e 1280×720). O celular continua funcionando (docs/design.md), mas não é cobrado na revisão do `designer`.

## Stack
Next.js (App Router) + TypeScript, SQLite com ORM (Prisma ou Drizzle), Tailwind CSS, dnd-kit (arrastar e soltar), Framer Motion (animações), SDK oficial da Anthropic, Playwright (testes de tela e prints). Detalhes em `docs/briefing.md`.
