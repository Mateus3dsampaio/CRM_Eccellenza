---
name: ciclo
description: Roda o loop de construção do CRM (implementar → testar → revisores em paralelo → corrigir bloqueantes → repetir) até a etapa ficar pronta ou atingir o limite de rodadas. Uso: /ciclo [etapa 1 | etapa 2] [máximo de rodadas, padrão 4]
---

Você é o **orquestrador** e o único que escreve código. Argumentos: $ARGUMENTS (padrão: etapa 1, 4 rodadas).

## Antes da primeira rodada
1. Leia `CLAUDE.md`, `docs/mapa-do-codigo.md`, `docs/briefing.md`, `docs/requisitos.md`, `docs/design.md` e o último relatório em `docs/rodadas/` (se existir, continue de onde parou).
2. Na etapa 2, confirme que o Mateus liberou a etapa 2. Se não houver registro disso, pare e pergunte.
3. Monte o plano da etapa: requisitos pendentes em ordem de dependência (base do projeto → banco → bot → kanban → ficha → agenda → retomada/limpeza → painel).

## Cada rodada
1. **Implementar** os itens pendentes do plano (na rodada 1, o máximo possível; nas seguintes, os bloqueantes da rodada anterior primeiro).
2. **Atualizar o mapa:** se a rodada criou, apagou ou renomeou arquivos, ou mudou o que algum faz, atualize `docs/mapa-do-codigo.md` (o `npm test` falha se faltar arquivo).
3. **Testar:** lint, tipos e `npm test`. Corrija até passar antes de chamar os revisores.
4. **Revisar em paralelo**, numa única mensagem, com o Agent tool:
   - Etapa 1: `revisor-requisitos`, `revisor-codigo`, `revisor-design`, `cliente-simulado`.
   - Etapa 2: `diretor-de-arte`, `revisor-codigo`, `revisor-design` (o `cliente-simulado` só se mexer em algo do chat).
   Passe a cada um: a etapa, o número da rodada, o caminho do relatório anterior e como subir o sistema.
5. **Consolidar** em `docs/rodadas/NN-etapa-X.md`: o que foi feito, os apontamentos de cada revisor (bloqueantes e sugestões), o que você vai corrigir e o que vai deixar para depois, com o motivo.
6. **Corrigir** todos os bloqueantes. Sugestões só se forem rápidas e não abrirem risco.

## Quando parar
- **Pronto:** nenhum bloqueante aberto e os critérios de aceite da etapa (`docs/requisitos.md`) cumpridos.
- **Limite:** atingiu o número máximo de rodadas.
- **Travado:** o mesmo bloqueante voltou em duas rodadas seguidas, ou a correção depende de uma decisão do Mateus (política da loja, texto para o cliente, regra da agenda). Pare e pergunte.
- **Erro externo:** falta a chave da API, a API está fora ou falta permissão. Pare e avise.

## Relatório final ao Mateus (em português, curto)
- Como rodar e o que testar primeiro (passo a passo).
- O que ficou pronto, por requisito.
- O que ficou pendente e por quê.
- O que está marcado como PROVISÓRIO e precisa da decisão dele.
- Onde estão os prints e vídeos (`docs/rodadas/evidencias/`).

## Nunca
- Enviar mensagem real de WhatsApp, publicar, fazer push ou instalar algo fora do projeto sem autorização do Mateus.
- Ler, exibir ou alterar a chave da API.
- Criar arquivo de instruções do bot no projeto ou pôr regra do bot no código. As instruções vivem só no banco (tela de Configurações); mudança no Manual do CRM é proposta ao Mateus.
- Inventar política da loja ou texto para o cliente final sem marcar como PROVISÓRIO.
