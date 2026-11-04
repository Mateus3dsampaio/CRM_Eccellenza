# Tarefa 21 – Novo funil do Kanban

Fazer **depois** da tarefa 20 (o bot já não agenda). Aprovado pelo Mateus em 04/11/2026.

## Objetivo
O kanban mostra onde cada lead está e para onde o vendedor precisa levá-lo. O alvo é **trazer o cliente à loja com o projeto pronto** (quase todo cliente que compra visita a loja).

## As 8 colunas
| # | Código | Nome | Entra como | Exige ao entrar |
|---|---|---|---|---|
| 1 | `novo` | IA atendendo | Automático | — |
| 2 | `pronto` | Aguardando consultor | Bot repassa | — |
| 3 | `qualificacao` | Em qualificação | Consultor arrasta | Próximo contato |
| 4 | `medicao` | Medição agendada | Consultor marca medição | Medição marcada na agenda |
| 5 | `apresentacao` | Apresentação agendada | Consultor marca apresentação | Apresentação marcada na agenda |
| 6 | `negociacao` | Negociação | Consultor arrasta | Próximo contato e valor do orçamento (regra atual) |
| 7 | `fechado` | Fechado | Consultor arrasta | Valor do contrato (já existe) |
| 8 | `perdido` | Perdido | Consultor arrasta | Motivo (já existe) |

- Saem: "Visita agendada", "Orçamento apresentado", "Sem resposta".
- Medição é opcional: quem já tem planta vai de 3 direto para 5.
- Arrastar para 4 ou 5 abre a janela de agendar; sem data, o card não entra.
- **Sem setinha de avançar** (cancelada pelo Mateus). Só arrastar e o menu de mover.
- Os nomes continuam editáveis pelo admin (lápis no título).
- Leads atuais são só testes: converter `visita` → `apresentacao`, `orcamento` → `negociacao`, `sem_resposta` → `perdido` (motivo "Parou de responder"). Seed refeito com o funil novo.

## Agenda: três tipos de compromisso
| Tipo | Onde | Bloqueia o horário do consultor | Move o card |
|---|---|---|---|
| Visita à loja (conhecer, passar o projeto) | Loja | Sim | **Não** (continua em Em qualificação) |
| Medição | Casa do cliente | Sim | → Medição agendada |
| Apresentação | Loja | Sim | → Apresentação agendada |

- Nenhum compromisso pode coincidir com outro do mesmo consultor (ele mede ou apresenta, nunca os dois).
- Um compromisso ativo de cada tipo por lead (marcar de novo = remarcar).
- Marcar nunca volta o card de etapa mais avançada (ex.: lead em Negociação que marca nova apresentação continua em Negociação; PERGUNTAR ao Mateus se deve voltar para Apresentação agendada).
- Cancelar medição ou apresentação sem outra marcada: o card volta para Em qualificação.
- Medição: duração e endereço do cliente no compromisso. Duração PROVISÓRIA (perguntar ao Mateus).

## "Sem resposta" vira motivo de perda
- Motivo de perda novo de fábrica: "Parou de responder".
- A rotina que hoje move o lead do bot para "Sem resposta" (4 dias após a retomada, PROVISÓRIO) passa a mover para **Perdido** com esse motivo, guardando a etapa anterior. Se o cliente voltar a escrever, o card volta para onde estava (como hoje).
- O retorno atrasado continua destacado no card (já existe).

## Painel
- "Visitas agendadas" vira "Apresentações agendadas" (métrica principal) + "Medições agendadas".
- Conversão nova: medições que viraram apresentação; apresentações que viraram fechamento.
- "Sem resposta" sai do painel; entra como motivo de perda.
- Exportação de desempenho com os nomes novos.

## Testes e documentação
- Atualizar testes de etapas, vendas, agenda, retomada, painel, kanban.
- Atualizar `docs/requisitos.md` (KAN-01, AGENDA-04…), `docs/mapa-do-codigo.md`, `docs/pendencias.md`.
- Manual do CRM: se algo do bot mudar aqui (nome das colunas citadas no manual), propor texto ao Mateus.

## Pronto quando
- As 8 colunas aparecem, nessa ordem, e as exigências funcionam ao arrastar.
- Medição e apresentação só entram com data na agenda; visita à loja não move o card.
- Conflito de horário entre os três tipos é recusado.
- Lead do bot que some vai para Perdido "Parou de responder" e volta se responder.
- Testes passando; mapa do código atualizado.
