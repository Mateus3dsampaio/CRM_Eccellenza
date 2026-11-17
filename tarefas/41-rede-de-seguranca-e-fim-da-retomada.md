# Tarefa 41 – Rede de segurança na "IA atendendo" e fim da retomada antiga

Objetivo: nenhum lead ficar preso para sempre na coluna "IA atendendo", e acabar com os dois fluxos que fazem a mesma coisa.

## Decisões do Mateus (16/11/2026)
- **Retomada antiga sai** (modelo da Meta em 3 dias, Perdido 4 dias depois). Fica só a recuperação de leads, que já está ligada em produção.
- **Rede de segurança:** lead com o bot há 5 dias sem mensagem do cliente vai para Perdido, não importa quem falou por último. Pega o que a recuperação não pega: cliente que deu a última palavra, envio que falhou, janela de 24h que fechou antes.
- **Pós-venda parado** não vai para Perdido (não é venda perdida): depois do mesmo prazo, vai direto para o arquivo.

## Etapas
- [x] 1. Regra pura `src/regras/rede-seguranca.ts`: 5 dias desde a última mensagem do cliente; só lead com o bot, sem consultor no comando, sem visita marcada, sem retorno futuro marcado. Devolve "perdido" ou, para pós-venda, "arquivar". Com testes.
- [x] 2. Rotina em `rotinas.ts`: Perdido com o motivo "Sem resposta (automático)"; pós-venda é arquivado com registro na ficha.
- [x] 3a. A retomada antiga deixa de rodar quando a rede de segurança está ligada (`rotinas.ts`).
- [x] 3b. (feito em 17/11/2026, na tarefa 45, sem esperar a rede ser ligada) Depois que o Mateus ligar a rede em produção: apagar `src/regras/retomada.ts`, o trecho de `rotinas.ts`, os contadores, a etiqueta "Retomada enviada" e os testes. O modelo `retomada` continua existindo para o vendedor enviar à mão (já é assim na conversa).
- [x] 4. Seção 4 de `src/bot/contrato.ts` e `npm run contrato:bot`.
- [x] 5. Mapa do código, `docs/requisitos.md` (RET-01 e RET-03) e pendências.

## Como ficou (16/11/2026)
- A rede nasce **desligada** (chave `rede_de_seguranca` em `Configuracao`) e ainda não tem tela (tarefa 43). Mudança em relação ao plano: em vez de apagar a retomada de uma vez, ela para sozinha no momento em que a rede é ligada. Motivo: se o código da retomada saísse antes de a rede estar ligada, haveria um intervalo sem regra nenhuma em produção.
- O motivo é "Sem resposta (automático)"; outra cidade e curioso / sem perfil levam o motivo próprio, mesmo com a regra da tarefa 40 desligada.
- Retorno marcado para a frente (pelo bot com a loja fechada, ou por uma pessoa) segura o lead.
- `docs/requisitos.md` (RET-01 e RET-03) fica como está até a etapa 3b: a retomada ainda existe enquanto a rede estiver desligada.

## Atenção
- **Primeira vez que a rede for ligada em produção:** todo lead com o bot parado há mais de 5 dias sai do quadro de uma vez.
- Leads que hoje estão no meio da retomada antiga: ao subir, passam a valer pela rede de segurança. Conferir no teste que ninguém é movido duas vezes nem fica sem regra.
- O prazo de 5 dias conta em relógio corrido.

## Pronto quando
No simulador: cliente que respondeu "ok" e sumiu vai para Perdido em 5 dias; pós-venda parado vai para o arquivo; nenhuma retomada antiga é enviada.
