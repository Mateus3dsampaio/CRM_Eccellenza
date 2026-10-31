# CRM Eccellenza – simulador

## O que é este projeto
CRM com atendimento por IA (API do Claude) para a **Eccellenza**, loja de móveis planejados Italínea em Juazeiro do Norte – CE. Dono: **Mateus**.
Nesta fase é um **simulador**: roda no computador, sem WhatsApp real. O cliente é simulado numa tela de chat, o bot atende com as instruções da loja e o CRM é preenchido sozinho (kanban, ficha do lead, agenda, painel).
Leia antes de qualquer trabalho: `docs/briefing.md`, `docs/requisitos.md` e `docs/design.md`.

## Como falar com o Mateus
- Sempre em português do Brasil, direto e sem jargão desnecessário.
- Ele é exigente com layout e design. Visual profissional, com profundidade e animação, é requisito, não enfeite.
- Seja franco: se uma ideia criar risco comercial, jurídico (LGPD, termos da Meta) ou técnico, diga.

## Regras do projeto
- **Nada de executar ações irreversíveis ou externas sem autorização do Mateus**: push, publicar, enviar mensagem real, contratar serviço, apagar arquivos fora do projeto.
- **Nunca envie mensagem real de WhatsApp** nesta fase. Toda integração com a Meta é simulada.
- **A chave da API (`ANTHROPIC_API_KEY`) fica no `.env`, colocada pelo Mateus.** Nunca escreva, exiba ou registre a chave em log.
- **Dados de clientes reais não entram no simulador.** Use só dados fictícios (seed).
- **Nunca invente política da loja** (preço, prazo, garantia, pagamento, cidades atendidas, regras de agenda). A fonte é `agente/loja.md`. Se faltar, pergunte ao Mateus ou marque como PROVISÓRIO no código e no briefing.
- **Textos que o cliente final vai ler** (mensagem de retomada, modelos de mensagem, novas falas do bot) são propostos e o Mateus aprova antes de valerem.
- Antes de escrever código que usa a API do Claude, consulte a skill `claude-api` (modelos, preços e uso de ferramentas atuais).

## Instruções do bot: de onde vêm
- `agente/instrucoes/` e `agente/loja.md` são **cópias** do projeto do agente do WhatsApp (o original fica em outra pasta, ver `agente/ORIGEM.md`). **Não edite essas cópias aqui.** Para atualizar, use `/sincronizar-instrucoes`.
- O que o CRM precisa a mais (ferramentas, agendamento, retomada) fica em `agente/complemento-crm.md`, que tem prioridade sobre as instruções quando houver conflito. Mudanças nele precisam de aprovação do Mateus.

## Como o trabalho é feito
- Trabalho em **rodadas** com o comando `/ciclo`: o orquestrador (a sessão principal) implementa, roda os testes, chama os revisores em paralelo, corrige o que for bloqueante e repete, até não restar bloqueante ou atingir o limite de rodadas.
- **Só a sessão principal escreve código.** Os agentes em `.claude/agents/` só leem, testam e apontam problemas.
- Cada rodada gera um relatório em `docs/rodadas/NN-descricao.md`.
- Revisores ativos na etapa 1: `revisor-requisitos`, `revisor-codigo`, `revisor-design`, `cliente-simulado`. O `diretor-de-arte` entra só na etapa 2 (layout), quando o Mateus liberar.

## Stack
Next.js (App Router) + TypeScript, SQLite com ORM (Prisma ou Drizzle), Tailwind CSS, dnd-kit (arrastar e soltar), Framer Motion (animações), SDK oficial da Anthropic, Playwright (testes de tela e prints). Detalhes em `docs/briefing.md`.
