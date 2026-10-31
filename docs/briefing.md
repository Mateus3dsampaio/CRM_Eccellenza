# Briefing – CRM Eccellenza

## Objetivo
Substituir, no futuro, o agente de IA da Meta no WhatsApp por um atendimento feito com a **API do Claude**, ligado a um **CRM próprio**. O bot qualifica o lead, lê medidas, agenda a visita e entrega o lead pronto para o consultor. O CRM organiza tudo e mede o funil.

Esta primeira fase é um **simulador**: prova o conceito sem tocar no WhatsApp real.

## Contexto do negócio
- Loja de móveis planejados de ticket médio/alto. O orçamento é sempre apresentado **pessoalmente na loja**.
- Cerca de **80 leads por semana** (~350/mês), quase todos vindos de anúncio.
- Hoje tudo acontece no WhatsApp: não existe CRM nem métricas.
- Cidades atendidas: Juazeiro do Norte, Crato e Barbalha. Outras cidades vão ao consultor (critério por valor e distância a definir).
- Arquitetos, designers e construtoras vão direto ao consultor.
- Regras comerciais completas: `agente/loja.md`. Comportamento do bot: `agente/instrucoes/` + `agente/complemento-crm.md`.

## O que o sistema faz
1. **Atendimento pelo bot**: segue as instruções da loja, faz uma pergunta por vez, registra tudo no CRM por ferramentas.
2. **Leitura de medidas**: de texto, foto ou planta, sempre confirmando com o cliente. Áudio entra numa fase posterior (precisa de transcrição); no simulador, o cliente pode mandar "[áudio transcrito] ...".
3. **CRM em kanban**: etapas do atendimento, cards ricos, etiquetas, filtros e busca.
4. **Ficha do lead pronta para o consultor**: dados, medidas, exigências, investimento, histórico e resumo.
5. **Agenda própria**: o bot marca visitas em horários livres, e o consultor bloqueia horários.
6. **Nova mensagem para qualquer número**, sem contato salvo, respeitando as regras da Meta (janela de 24h e modelos aprovados).
7. **Retomada e limpeza**: quem não responde recebe uma retomada; quem continua sem responder vai para "Sem resposta" e pode ser arquivado ou excluído fácil. Arquivados são excluídos de vez em 30 dias.
8. **Painel de métricas**: leads por semana, qualificados, outras cidades, arquitetos, sem resposta, visitas agendadas.
9. **Usuários**: Mateus (administrador, único que exclui) e consultores.

## Decisões já tomadas (Mateus, 31/10/2026)
- Construir com a API do Claude, não por automação do WhatsApp Web (risco de banimento do número).
- Projeto separado do repositório das instruções. As instruções continuam sendo mantidas lá.
- Retomada: 3 dias sem resposta → envia uma mensagem de retomada.
- Arquivados: excluídos de vez em 30 dias (mídias juntas).
- Só o Mateus pode excluir leads e conversas.
- Sem disparo em massa.
- Bot depois de passar o lead ao consultor: pausa total por enquanto (31/10/2026). Nas próximas etapas, definir se ele volta a responder dúvidas simples.
- Duas etapas: (1) funcionar com visual limpo; (2) layout profissional com animações, conduzido pelo `diretor-de-arte`.

## Pendências (perguntar ao Mateus, não inventar)
- Regras reais da agenda: dias, horários, duração da visita, quantos consultores ao mesmo tempo.
- Texto da mensagem de retomada.
- Prazo entre a retomada e "Sem resposta" (provisório: 4 dias).
- Nomes finais das colunas do kanban.
- Critério para atender outras cidades (valor x distância).
- Quantos consultores e seus nomes (no simulador: 2 fictícios).
- Visitas ao mesmo tempo na loja (provisório: uma por horário, como no complemento).
- Feriados e dias em que a loja fecha (provisório: a agenda não conhece feriados; o consultor bloqueia).
- Como distribuir leads entre consultores (provisório: o consultor com menos leads em andamento).
- Consultor pode mexer na agenda dos colegas? (provisório: pode.)
- Faixa de valor para quem quer "só portas/frentes" da cozinha, e o que fazer quando o cliente some de novo depois de responder à retomada.

## Stack
- **Next.js (App Router) + TypeScript**, rodando com `npm run dev`.
- **SQLite** com Prisma ou Drizzle. Seed com dados **fictícios**.
- **Tailwind CSS**; **dnd-kit** para arrastar e soltar (mouse e toque); **Framer Motion** para animações.
- **SDK oficial da Anthropic** com uso de ferramentas (tool use). Modelo do bot: o Sonnet mais recente; avaliar Haiku para tarefas simples (resumo, classificação). Conferir modelos e preços atuais na skill `claude-api` antes de codar.
- **Playwright** para testes de tela e prints (computador e celular).
- Chave em `.env` (`ANTHROPIC_API_KEY`), colocada pelo Mateus. `.env.example` sem valores.
- **Relógio simulado**: o simulador precisa de um controle "avançar tempo" (horas/dias) para testar retomada, "Sem resposta" e exclusão de arquivados sem esperar dias reais.

## Fases
- **Etapa 1 – funcionar** (agora): todos os requisitos de `docs/requisitos.md` marcados como etapa 1, visual limpo de `docs/design.md` (parte 1).
- **Etapa 2 – layout profissional**: `docs/design.md` (parte 2), com o agente `diretor-de-arte`. Só começa com liberação do Mateus.
- **Depois do simulador**: integração real com a WhatsApp Cloud API (com coexistência do app no mesmo número), transcrição de áudio, hospedagem, aviso de privacidade (LGPD). Fora do escopo agora.

## Fora do escopo agora
- Qualquer envio real pelo WhatsApp.
- Disparo em massa e campanhas.
- Pagamentos, orçamento e preço calculado pelo sistema.
