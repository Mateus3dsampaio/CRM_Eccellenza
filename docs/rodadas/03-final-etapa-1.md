# Relatório final – Etapa 1 (31/10/2026)

Ciclo encerrado a pedido do Mateus durante a rodada 3. Os revisores da rodada 3 foram interrompidos antes de entregar, então **as correções da rodada 2 não passaram por uma segunda conferência dos revisores**. Elas passaram nos testes automáticos (24 de regra e 12 de tela, em 1440px e 375px), no lint e na checagem de tipos.

## Como rodar
1. `npm install` (só na primeira vez)
2. `npm run seed` (recria os dados fictícios; use quando quiser recomeçar)
3. `npm run dev`
4. Abrir **http://127.0.0.1:3000** e entrar com `mateus` / `mateus123` (admin). Consultores: `rafael` / `rafael123` e `beatriz` / `beatriz123`.

## O que testar primeiro
1. **Simulador → Novo**: converse como cliente ("Oi, quero fazer minha cozinha"). Deixe o Kanban aberto em outra aba e veja o card andar sozinho.
2. Envie a planta `testes/imagens/planta-cozinha.png` no chat: o bot confirma as medidas e grava na ficha.
3. Aceite a visita: o bot oferece 3 horários livres e agenda. Confira na **Agenda**.
4. Abra a **ficha**: resumo para copiar, edição, medidas, notas, histórico, assumir/devolver ao bot.
5. **Relógio** (no Simulador): +3 dias (retomada) e +4 dias ("Sem resposta").
6. **Nova mensagem** para um número novo: só aceita modelo aprovado.
7. Entre como `rafael`: o botão de excluir não aparece.

## O que ficou pronto
Todos os requisitos E1 foram implementados. Na rodada 2, o revisor de requisitos marcou como atendidos: BOT-01/03/04/05/06, KAN-01 a 05, FICHA-01 a 04, CHAT-01 a 03, MSG-01 a 04, AGENDA-01/03/04, RET-01 a 04, LIMP-01 a 06, MET-01 a 03, USR-01/02, SEG-02/03, TEC-01 a 04.
O cliente simulado rodou 32 conversas nas rodadas 1 e 2. Na rodada 2: nenhum preço fora da regra, nenhum desconto, nenhum prazo garantido, nenhuma visita em conflito, nenhuma segunda retomada.

## O que ficou pendente
- **AGENDA-02**: os dois bloqueantes da rodada 2 (visita de lead arquivado prendendo o horário; texto da agenda) foram corrigidos e têm teste, mas não foram reconferidos pelos revisores.
- **SEG-01**: arquivo `CHAVE API.txt` na raiz do projeto (não abri). Mover a chave para o `.env`, apagar o arquivo e, se ele já foi compartilhado, gerar outra chave. Ele já está no `.gitignore`.
- **BOT-02**: em 1 de 12 conversas da rodada 2 o bot repetiu uma pergunta depois de um desvio, e mandou endereço completo quando pediram só o endereço. O prompt foi reforçado, mas não foi testado de novo.
- Sugestões adiadas: teste do bot com API simulada, teto do histórico da API, VACUUM após exclusão, cor das barras do painel por consultor.

## Decidido pelo Mateus
- **Bot depois de passar o lead**: pausa total por enquanto (31/10/2026). Registrado em `agente/complemento-crm.md` (Conflitos conhecidos) e no briefing. Revisitar nas próximas etapas.

## PROVISÓRIO – precisa da decisão do Mateus
1. **Agenda**: seg a sex 8h–18h, sáb 8h–12h, visitas de 1h, **uma visita por horário na loja**; feriados (a agenda ofereceu Finados, 02/11); distribuição de leads (hoje: consultor com menos leads em andamento); consultor mexe na agenda do colega (hoje: pode).
2. **Textos para o cliente**: retomada e os 3 modelos de mensagem (`src/regras/modelos.ts`).
3. Prazo de 4 dias entre a retomada e "Sem resposta"; o que fazer no 2º silêncio depois de o cliente responder à retomada.
4. Faixa de valor para quem quer "só portas/frentes"; medida digitada conta como "confirmada" (conflito instrução 11 x complemento).
5. Nomes finais das colunas do kanban.
6. Mensagem enviada primeiro pela loja conta como "lead novo" no painel?

## Onde estão as evidências
- `docs/rodadas/evidencias/telas/` – prints automáticos (computador e celular)
- `docs/rodadas/evidencias/design-r1/` e `design-r2/` – prints do revisor de design
- `docs/rodadas/evidencias/requisitos/` – prints do revisor de requisitos
- `docs/rodadas/evidencias/cliente-simulado-r2/` – conversas e fichas do cliente simulado
- Relatórios das rodadas: `01-etapa-1.md`, `02-etapa-1.md`
