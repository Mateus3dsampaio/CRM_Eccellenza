# Tarefa 40 – Desclassificados saem sozinhos da "IA atendendo" (DESFEITA em 17/11/2026)

> **Desfeita.** Em 17/11/2026 o Mateus achou o conjunto de regras confuso e aprovou um caminho único (ver `tarefas/45-automacao-enxuta.md`): quem conversa com coerência sobre móveis é lead e segue o caminho normal, seja de outra cidade, curioso ou sem perfil. O código desta tarefa saiu; o texto abaixo fica só como histórico.

Objetivo: cliente que a loja não atende (outra cidade, curioso ou sem perfil) deixar de ocupar o quadro e de receber mensagem de recuperação. Primeira de quatro tarefas da automação de leads (40 a 43).

## Decisões do Mateus (16/11/2026)
- **Outra cidade** e **curioso / sem perfil**: não recebem mensagem de recuperação. Depois de 24 horas sem o cliente escrever, vão para Perdido com motivo próprio.
- **"Sem perfil" usa a classificação `curioso`** (sem classificação nova). São sem perfil: quem quer só um pedaço do móvel, só as portas, ou aproveitar um móvel existente. Não valem o atendimento.
- **Parceiro e já atendido** ficam de fora: são oportunidade ou vão para o consultor.
- Cliente que escrever de novo volta sozinho para a coluna em que estava (já funciona assim).

## Etapas
- [x] 1. Regra pura `src/regras/desclassificados.ts`: quais classificações valem, prazo em horas, quando mover. Só para lead com o bot, sem consultor no comando e sem visita marcada. Com testes.
- [x] 2. `avaliarRecuperacao` (`src/regras/recuperacao.ts`) passa a pular `outra_cidade` e `curioso`, como já pula `pos_venda`. Ajustar os testes.
- [x] 3. Rotina em `src/servicos/desclassificados.ts`, chamada por `rotinas.ts`: move para Perdido com os motivos "Outra cidade (automático)" e "Curioso / sem perfil (automático)", criados sozinhos como o "Sem resposta (automático)". Registra na ficha e conta no painel.
- [x] 4. Nome da classificação na tela vira "Curioso / sem perfil" (`src/regras/etapas.ts`).
- [x] 5. Manual do CRM: **propor ao Mateus** o texto novo da linha do `classificar_lead`, incluindo sem perfil. Só com a aprovação: `manual-inicial.ts`, `manual-versoes.ts` e `npm run contrato:bot`.
- [x] 6. Seção 4 de `src/bot/contrato.ts`: frase sobre o que acontece com o desclassificado. Gerar o contrato de novo.
- [x] 7. Mapa do código e pendências.

## Como ficou (16/11/2026)
- A regra nasce **desligada** (chave `desclassificados` em `Configuracao`) e ainda não tem tela: o liga/desliga e o prazo entram na tarefa 43. Enquanto estiver desligada, nada muda em produção.
- A recuperação só deixa de mandar mensagem a esses leads quando a regra está ligada. Assim ninguém fica sem regra nenhuma no meio do caminho.
- O contador `desclassificado_perdido` já é gravado; a linha no painel entra na tarefa 43.
- Texto do Manual aprovado pelo Mateus em 16/11/2026 e aplicado.

## Do Mateus
- Colocar nas instruções numeradas (repositório de instruções) o critério de sem perfil e que o bot classifica esses casos como `curioso`.

## Pronto quando
No simulador: um cliente de outra cidade e um que só quer as portas são classificados, não recebem recuperação e, avançando o relógio 24 h, aparecem em Perdido com o motivo certo. Se escreverem, voltam.
