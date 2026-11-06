# Tarefa 35 – Presença dos vendedores e fila da loja fechada

Decidida com o Mateus em 06/11/2026. **Status: a fazer.** Fazer **antes** da tarefa 36 (o retorno automático depende desta para não disparar sem ninguém online).

## Problema
- Vendedor que adoece ou falta continua recebendo lead e tem compromisso marcado que ninguém cumpre.
- Hoje o status só tem `online` e `almoco`; "desativar" bloqueia o acesso inteiro (não serve para um dia de falta).
- A fila (`leadsNaFila` / `distribuirFila` em `src/servicos/distribuicao.ts`) vai inteira para o **primeiro** vendedor que fica online.

## Regras decididas
Valem para todo período com a loja fechada: **dia de semana das 18h às 8h** e **fim de semana** (sábado depois do meio-dia até segunda 8h). O horário vem da agenda (Configurações > Geral, `regras/agenda.ts`) — não criar um segundo cadastro de horário.

1. **Offline automático**: no fechamento da loja, todos os vendedores ficam offline (novo status `offline`, além de `online` e `almoco`).
2. **Online manual**: ao chegar, o vendedor clica em "online". Quem não clicar não recebe lead (quem faltou fica fora sozinho).
3. **Fila da loja fechada**: lead que chega com a loja fechada é atendido pelo bot e fica na fila, sem dono.
4. **Repartir a fila**: X min depois da abertura (padrão 15 min → 8h15), a fila é repartida no rodízio entre quem está online. Antes disso, ficar online não puxa a fila.
5. **Verificação de presença**: X min depois da abertura (padrão 30 min), quem tem compromisso (visita, medição, apresentação) ou retorno hoje e **não ficou online** gera aviso para **todos** (admin e vendedores): "João não ficou online e tem: visita 9h, medição 14h, 2 retornos", com o botão **"Passar os de hoje para…"** (escolher vendedor). Reaproveitar `transferirLead`/`transferirLeads`, filtrando só os de hoje.
6. **Compromisso cedo** (antes da verificação): se o dono não estiver online, aviso X min antes do compromisso (padrão 15 min).
7. **Ninguém transfere compromisso sozinho**: visita e medição só mudam de dono com uma pessoa escolhendo.

## Configurações (Configurações > Geral, cartão "Presença e fila", só admin)
| Opção | Tipo | Padrão |
|---|---|---|
| Desligar vendedores no fechamento da loja | liga/desliga | ligado |
| Repartir a fila acumulada com a loja fechada | liga/desliga | ligado |
| Quando repartir | minutos depois da abertura | 15 |
| Verificar presença de quem tem compromisso | liga/desliga | ligado |
| Quando verificar | minutos depois da abertura | 30 |
| Aviso de compromisso cedo | minutos antes | 15 |
| Quem recebe o aviso de ausência | admin / todos | todos |

- Opção que depende de outra fica esmaecida quando a outra está desligada (ex.: "Quando repartir" sem "Repartir").
- "Repartir" desligado = comportamento de hoje (fila vai para quem fica online primeiro).

## Etapas
1. [ ] Regra pura em `src/regras/` (ex.: `presenca.ts`): loja aberta/fechada a partir da agenda, próximo fechamento, próxima abertura, horário de repartir e de verificar. Testes unitários (dia de semana, sábado meio-dia, domingo, feriado não existe ainda).
2. [ ] Status `offline` no usuário + rotina no agendador (`servicos/agendador.ts` / `rotinas.ts`) que desliga todos no fechamento.
3. [ ] Botão online/offline do vendedor (junto do almoço). Ficar online antes do horário de repartir não puxa a fila.
4. [ ] Rotina de repartir a fila no horário configurado (rodízio só entre quem está online).
5. [ ] Rotina de verificação de presença + aviso a todos + botão "Passar os de hoje para…". Aviso de compromisso cedo.
6. [ ] Cartão "Presença e fila" nas Configurações (+ rota da API, gravação em `Configuracao`).
7. [ ] Simulador: o "+1 hora" precisa permitir testar fechamento, abertura, repartição e verificação.
8. [ ] Atualizar `docs/mapa-do-codigo.md`, `docs/requisitos.md` se couber, e `docs/pendencias.md`.
9. [ ] Testes (`npm run tipos`, `npm run lint`, `npm test`) e teste de tela do botão online/offline e do aviso.

## Pronto quando
Fora do horário ninguém recebe lead; a fila é repartida no horário configurado; vendedor ausente com compromisso gera aviso para todos com transferência em um clique; tudo ligável/desligável na tela.
