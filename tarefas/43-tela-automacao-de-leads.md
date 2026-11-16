# Tarefa 43 – Tela "Automação de leads" e painel

Objetivo: o Mateus ligar, desligar e ajustar os prazos das tarefas 40 a 42 na tela, e conseguir conferir o que a automação fez.

## Etapas
- [x] 1. Configurações > "Recuperação de leads" vira "Automação de leads", com quatro blocos: mensagens de recuperação (o que já existe), desclassificados (prazo em horas), rede de segurança (dias), arquivar perdidos (dois prazos). Cada bloco com liga/desliga.
- [x] 2. Gravação: regras em `Configuracao`, rota só para admin, validação dos limites. Os prazos das tarefas 40 a 42 deixam de ser fixos no código e passam a vir daqui (padrões: 24 h, 5 dias, 7 e 60 dias).
- [x] 3. Painel: bloco "Recuperação de leads" ganha as linhas novas (desclassificados movidos, rede de segurança, arquivados sozinhos). Levar o bloco também para a exportação em HTML, que hoje não tem.
- [ ] 4. Textos da tela (rótulos e dicas) propostos ao Mateus antes de valer.
- [ ] 5. Revisão de layout com o `designer` (PC, 1440×900 e 1280×720).
- [x] 6. Mapa do código e pendências.

## Como ficou (16/11/2026)
- A seção "Recuperação de leads" virou "Automação de leads": em cima a recuperação (igual a antes), embaixo os três cartões novos.
- Cada cartão desligado mostra quantos cards a regra pega no momento em que for ligada (com os prazos salvos). Não move nada.
- Os blocos nascem desligados.
- Etapa 4: os textos da tela foram escritos por mim e estão valendo como rascunho; só o admin lê. O Mateus revisa e manda trocar o que quiser.
- Etapa 5: conferido por mim no navegador em 1440×900 (sem erro na tela); a revisão do agente `designer` não foi rodada.

## Decidir na hora
- Os blocos novos nascem ligados ou desligados em produção? Sugestão: desligados, e o Mateus liga um por vez depois de conferir no simulador.

## Pronto quando
O Mateus muda um prazo na tela, avança o relógio no simulador e vê a regra obedecer; o painel mostra quantos leads cada regra moveu.
