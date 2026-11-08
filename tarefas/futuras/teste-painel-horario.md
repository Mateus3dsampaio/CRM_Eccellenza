# Teste do painel que falha dependendo do horário

## O que é
O teste `testes/unit/painel.test.ts` ("mostra o geral e filtra pelos leads do vendedor, separando bot e consultor") passa ou falha conforme a hora em que roda. Em 08/11/2026 passou às 21:55 (Fortaleza) e falhou a partir das 22:18 com `expected +0 to be 3` (nenhum tempo de resposta contado em "hoje").

## Por que vale
Teste que falha sempre vira ruído: todo mundo passa a ignorar e um erro de verdade no painel pode passar despercebido.

## Causa provável (não confirmada)
O teste usa o relógio real e avança cerca de 1h40 dentro dele (`avancarRelogio`), depois pede o painel de "hoje". Rodando depois das ~22h20 de Fortaleza, as mensagens caem no dia seguinte e somem do "hoje".

## Etapas
- [ ] 1. Confirmar a causa: rodar o teste com o relógio simulado fixado perto da meia-noite e ao meio-dia.
- [ ] 2. Corrigir o teste para começar num horário fixo (ex.: 10h de um dia útil), sem depender da hora real. Conferir se outros testes do painel têm o mesmo risco.
- [ ] 3. Decidir com o Mateus se o painel em produção tem o mesmo problema perto da meia-noite (provavelmente não: é só o teste que avança o relógio).

## Em aberto
- Nada decidido ainda.
