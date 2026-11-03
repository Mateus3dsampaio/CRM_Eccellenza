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
- **Nunca invente política da loja** (preço, prazo, garantia, pagamento, cidades atendidas, regras de agenda). A fonte é `agente/loja.md`. Se faltar, pergunte ao Mateus ou marque como PROVISÓRIO no código e no briefing.
- **Textos que o cliente final vai ler** (mensagem de retomada, modelos de mensagem, novas falas do bot) são propostos e o Mateus aprova antes de valerem.
- Antes de escrever código que usa a API do Claude, consulte a skill `claude-api` (modelos, preços e uso de ferramentas atuais).

## Instruções do bot: de onde vêm
- **A partir de 31/10/2026 o CRM é a fonte principal das instruções de atendimento.** Elas ficam no banco (tabela `Instrucao`) e o admin edita em Configurações > Instruções de atendimento (criar, editar, reordenar, desativar, exportar; guarda só a versão anterior). O bot lê do banco a cada conversa (`src/servicos/instrucoes.ts`, `src/bot/prompt.ts`).
- `agente/instrucoes/*.txt` (as 13 originais) agora são só a **carga inicial**: copiadas para o banco uma vez, quando a tabela está vazia (primeiro uso ou depois do `npm run seed`). Editar esses arquivos não muda o bot que já está rodando, e o `/sincronizar-instrucoes` não atualiza mais as instruções do banco. Não use os arquivos para mudar o comportamento do bot: use a tela.
- `agente/loja.md` continua sendo **cópia** do projeto do agente do WhatsApp (ver `agente/ORIGEM.md`). Não edite aqui. Para atualizar, use `/sincronizar-instrucoes`.
- O que o CRM precisa a mais (ferramentas, agendamento, retomada) fica em `agente/complemento-crm.md`, que tem prioridade sobre as instruções quando houver conflito. Mudanças nele precisam de aprovação do Mateus.

## Como o trabalho é feito
- Trabalho em **rodadas** com o comando `/ciclo`: o orquestrador (a sessão principal) implementa, roda os testes, chama os revisores em paralelo, corrige o que for bloqueante e repete, até não restar bloqueante ou atingir o limite de rodadas.
- **Só a sessão principal escreve código.** Os agentes em `.claude/agents/` só leem, testam e apontam problemas.
- Cada rodada gera um relatório em `docs/rodadas/NN-descricao.md`.
- Revisores ativos na etapa 1: `revisor-requisitos`, `revisor-codigo`, `revisor-design`, `cliente-simulado`. O `diretor-de-arte` entra só na etapa 2 (layout), quando o Mateus liberar.

## Aparelho principal
- **PC** (decidido pelo Mateus em 03/11/2026). O agente `designer` otimiza só para PC (1440×900 e 1280×720). O celular continua funcionando (docs/design.md), mas não é cobrado na revisão do `designer`.

## Stack
Next.js (App Router) + TypeScript, SQLite com ORM (Prisma ou Drizzle), Tailwind CSS, dnd-kit (arrastar e soltar), Framer Motion (animações), SDK oficial da Anthropic, Playwright (testes de tela e prints). Detalhes em `docs/briefing.md`.
