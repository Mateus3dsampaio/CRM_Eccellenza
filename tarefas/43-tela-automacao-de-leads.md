# Tarefa 43 – Tela "Automação de leads" e painel

Objetivo: o Mateus ligar, desligar e ajustar os prazos das tarefas 40 a 42 na tela, e conseguir conferir o que a automação fez.

## Etapas
- [ ] 1. Configurações > "Recuperação de leads" vira "Automação de leads", com quatro blocos: mensagens de recuperação (o que já existe), desclassificados (prazo em horas), rede de segurança (dias), arquivar perdidos (dois prazos). Cada bloco com liga/desliga.
- [ ] 2. Gravação: regras em `Configuracao`, rota só para admin, validação dos limites. Os prazos das tarefas 40 a 42 deixam de ser fixos no código e passam a vir daqui (padrões: 24 h, 5 dias, 7 e 60 dias).
- [ ] 3. Painel: bloco "Recuperação de leads" ganha as linhas novas (desclassificados movidos, rede de segurança, arquivados sozinhos). Levar o bloco também para a exportação em HTML, que hoje não tem.
- [ ] 4. Textos da tela (rótulos e dicas) propostos ao Mateus antes de valer.
- [ ] 5. Revisão de layout com o `designer` (PC, 1440×900 e 1280×720).
- [ ] 6. Mapa do código e pendências.

## Decidir na hora
- Os blocos novos nascem ligados ou desligados em produção? Sugestão: desligados, e o Mateus liga um por vez depois de conferir no simulador.

## Pronto quando
O Mateus muda um prazo na tela, avança o relógio no simulador e vê a regra obedecer; o painel mostra quantos leads cada regra moveu.
