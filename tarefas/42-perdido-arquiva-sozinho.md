# Tarefa 42 – Perdido arquiva sozinho

Objetivo: a coluna Perdido se esvaziar sem ninguém precisar limpar.

## Decisões do Mateus (16/11/2026)
- **Perdido automático** (sem resposta, parou de responder, outra cidade, curioso / sem perfil): arquiva 7 dias depois de entrar em Perdido.
- **Perdido marcado pelo vendedor** (preço, prazo, concorrente, desistiu, outro e os motivos criados na tela): arquiva em 60 dias.
- Arquivado continua sendo excluído de vez 30 dias depois (regra que já existe). Ou seja: conversa e arquivos somem em 37 dias (automático) ou 90 dias (vendedor). Os números do painel ficam.

## Etapas
- [ ] 1. Regra pura `src/regras/arquivar-perdido.ts`: o prazo depende do motivo (lista dos motivos automáticos); a data é a da última entrada em Perdido (`MudancaEtapa`). Com testes.
- [ ] 2. Rotina em `rotinas.ts` usando `arquivarLeads` (autor "sistema"), com o texto "Arquivado automaticamente (N dias em Perdido)" na ficha.
- [ ] 3. Contador no painel e linha no registro das rotinas.
- [ ] 4. Mapa do código e pendências (fechar o item da seção E sobre "Sem resposta" sem prazo).

## Atenção
- **Primeira execução em produção:** todo card que já está em Perdido há mais que o prazo é arquivado de uma vez. Avisar o Mateus antes de subir e mostrar quantos são.
- Lead em Perdido sem registro de quando entrou (dado antigo): usar a última alteração.

## Pronto quando
No simulador, avançando o relógio: perdido automático some do quadro em 7 dias, perdido por preço em 60, os dois aparecem em Arquivados e podem ser restaurados.
