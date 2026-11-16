# Tarefa 41 – Rede de segurança na "IA atendendo" e fim da retomada antiga

Objetivo: nenhum lead ficar preso para sempre na coluna "IA atendendo", e acabar com os dois fluxos que fazem a mesma coisa.

## Decisões do Mateus (16/11/2026)
- **Retomada antiga sai** (modelo da Meta em 3 dias, Perdido 4 dias depois). Fica só a recuperação de leads, que já está ligada em produção.
- **Rede de segurança:** lead com o bot há 5 dias sem mensagem do cliente vai para Perdido, não importa quem falou por último. Pega o que a recuperação não pega: cliente que deu a última palavra, envio que falhou, janela de 24h que fechou antes.
- **Pós-venda parado** não vai para Perdido (não é venda perdida): depois do mesmo prazo, vai direto para o arquivo.

## Etapas
- [ ] 1. Regra pura `src/regras/rede-seguranca.ts`: 5 dias desde a última mensagem do cliente; só lead com o bot, sem consultor no comando, sem visita marcada, sem retorno futuro marcado. Devolve "perdido" ou, para pós-venda, "arquivar". Com testes.
- [ ] 2. Rotina em `rotinas.ts`: Perdido com o motivo "Sem resposta (automático)"; pós-venda é arquivado com registro na ficha.
- [ ] 3. Tirar a retomada: `src/regras/retomada.ts`, o trecho de `rotinas.ts`, os contadores e textos ligados a ela, e os testes. Conferir antes onde a etiqueta "Retomada enviada" e o modelo `retomada` ainda são usados (o modelo continua existindo para o vendedor enviar à mão, se já for assim hoje).
- [ ] 4. Seção 4 de `src/bot/contrato.ts` e `npm run contrato:bot`.
- [ ] 5. Mapa do código, `docs/requisitos.md` (RET-01 e RET-03) e pendências.

## Atenção
- Leads que hoje estão no meio da retomada antiga: ao subir, passam a valer pela rede de segurança. Conferir no teste que ninguém é movido duas vezes nem fica sem regra.
- O prazo de 5 dias conta em relógio corrido.

## Pronto quando
No simulador: cliente que respondeu "ok" e sumiu vai para Perdido em 5 dias; pós-venda parado vai para o arquivo; nenhuma retomada antiga é enviada.
