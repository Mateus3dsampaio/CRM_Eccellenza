# Fase 2 – pedidos do Mateus (31/10/2026), em etapas

Cada etapa é feita e testada antes de começar a próxima. Ordem: primeiro o que está quebrado, depois a base que as outras etapas usam (permissões e configurações), depois o resto.

## Etapa A – Correções do simulador
1. Mensagem do cliente aparece duas vezes até o bot responder (mensagem otimista + mensagem do banco). Mostrar uma só.
2. Ao criar cliente fictício ("Novo"), o campo do nome perde o foco a cada letra (provável componente recriado a cada render). Corrigir para digitar normalmente.

## Etapa B – Permissões (base das etapas seguintes)
- Vendedor: edita só a própria agenda, mas vê a do outro. Admin vê e altera tudo.
- Excluir conversas e dados de lead: só admin.
- Vendedor pode excluir arquivos e anotações.
- Dados de análise (métricas, histórico de alterações, eventos, classificação registrada) nunca podem ser apagados por vendedor.
- Regras no servidor (`src/regras/permissoes.ts`), não só escondendo botão. Testes cobrindo cada caso.

## Etapa C – Tema escuro
- Tokens de cor escuros em `tokens.css`, botão de alternar no cabeçalho, lembrar a escolha. Revisar todas as telas (kanban, ficha, agenda, painel, simulador) para manter profundidade e contraste.

## Etapa D – Agenda
- Caber na tela sem rolar a página (altura fixa da viewport, rolagem só interna se precisar).
- Filtro por vendedor em botões (só admin), com "Todos".
- Aplicar as regras da etapa B (vendedor vê todas, edita só a sua).

## Etapa E – Kanban
- Controle de zoom (mais/menos cards na tela), lembrando a escolha.
- Filtro por vendedor em botões, igual à agenda.

## Etapa F – Painel de Configurações (só admin)
- Nova tela "Configurações" no menu, visível só para admin. Começa vazia de funcionalidades próprias e recebe as opções das etapas G, H e I.
- Guarda tudo na tabela `Configuracao` que já existe.

## Etapa G – Layout da ficha do lead
- Conversa em largura total, bem maior. Resumo, etapa/responsável e demais blocos divididos abaixo, como hoje.
- Blocos arrastáveis e redimensionáveis (grade tipo dashboard).
- Admin personaliza e salva como **layout padrão de todos** (em Configurações). Vendedor usa o padrão.
- Pergunta em aberto: vendedor pode ajustar o seu e sobrescrever o padrão? Sugestão: não, só admin.

## Etapa H – Distribuição alternada de leads
- Opção em Configurações: rodízio (lead 1 → vendedor 1, lead 2 → vendedor 2, e assim por diante; com 2 vendedores alterna entre eles).
- Guardar quem recebeu o último lead; pular vendedor offline.

## Etapa I – Horário de almoço
- Vendedor liga "Almoço": fica offline e novos leads vão para os outros vendedores online. Ao voltar, fica online e volta ao rodízio.
- Pergunta em aberto: os leads que ele já tem durante o almoço são redistribuídos ou ficam com ele? Sugestão: só os novos, os que já são dele ficam.
- Depende da H (distribuição) e precisa de status online/offline do vendedor.

## Decisões do Mateus (31/10/2026)
- G: só o admin define o layout; vendedor usa o padrão.
- I: leads que o vendedor já tem ficam com ele durante o almoço; só os novos mudam de dono.
- H/I, todos offline: o bot atende até onde der e passa para o vendedor normalmente (o lead não fica "sem dono" esperando o admin; se não houver ninguém online, fica na fila do rodízio para o primeiro que voltar, e o admin vê).
- I, lead já repassado ao vendedor que está em almoço e que escreve de novo: o bot avisa que é horário de almoço e que o vendedor retorna já.
  - Texto da aviso: PROVISÓRIO, aguardando aprovação do Mateus:
    "Oi! Nosso consultor está em horário de almoço e já retorna. Assim que ele voltar, ele continua o seu atendimento por aqui."
  - Esse aviso precisa de regra no a instrução 15 do bot (aprovação do Mateus) e não pode repetir a cada mensagem: avisa uma vez por almoço.

## Pendências anotadas
- **A (parcial):** campo do nome do "Novo" cliente foi corrigido. A mensagem do cliente ainda aparece duplicada no simulador logo após enviar e some quando o bot responde (visual, não envia 2x). A correção por contagem não resolveu; investigar depois (provável corrida entre a recarga automática de 2 s e o POST, ou o `ListaMensagens` mostrando a mensagem salva + a provisória com ids diferentes).

## Situação em 31/10/2026 (commit local, sem push)

| Etapa | Estado |
|---|---|
| A. Correções do simulador | Parcial: campo do nome corrigido; mensagem duplicada ainda aparece (ver pendências) |
| B. Permissões | Feita no código, sem teste de tela com login de vendedor |
| C. Tema escuro | Feita; só a tela de login foi conferida |
| D. Agenda | Feita (cabe na tela, filtro do admin, grade até 20h); ajustes visuais ainda podem surgir |
| Extra: Apresentação na loja | Feita (agendar na ficha/agenda, faixa vermelha). Regras provisórias: 1 h, ocupa o horário da loja, não move o card nem conta no painel |
| E. Kanban | Feita (zoom 60–125% e filtro do admin); testar arrastar card com zoom diferente de 100% |
| F. Configurações | Feita (só admin; equipe + cartões "Em breve") |
| G. Layout da ficha | Retirada em 09/11/2026 (decisão do Mateus): a ficha passou a ter duas colunas fixas em ordem de prioridade; a grade arrastável e o "Personalizar layout" saíram |
| H. Rodízio de leads | Feita no código e testada (testes automáticos); sem teste de tela |
| I. Horário de almoço | Feita no código e testada (testes automáticos); sem teste de tela |

### O que falta fazer
1. **Etapa H:** opção em Configurações para ligar o rodízio; guardar quem recebeu o último lead; pular vendedor offline; lead sem ninguém online fica na fila para o primeiro que voltar e aparece para o admin. Hoje a distribuição é por "consultor com menos leads" (`consultorComMenosLeads` em `src/servicos/leads.ts`, marcada PROVISÓRIA).
2. **Etapa I:** status online/offline do vendedor; botão de almoço; leads novos vão só para quem está online; leads que ele já tem ficam com ele; aviso ao cliente que escreve durante o almoço (texto aprovado, uma vez por almoço) e regra nova em a instrução 15 do bot, que o Mateus precisa aprovar.
3. **Mensagem duplicada no simulador** (pendência da etapa A).
4. **Teste de tela com login:** o navegador de teste do Claude não conseguiu entrar (o login de teste do seed não funcionou no banco do Mateus). Nada de B, C (exceto login), D, E, F e G foi visto em tela por mim.
5. Rodar `/ciclo` com os revisores (requisitos, código, design, cliente simulado) sobre a fase 2 e gerar o relatório em `docs/rodadas/`.
6. Atualizar `docs/requisitos.md` com os pedidos novos (permissões, agenda, apresentação, zoom, layout, rodízio, almoço).
7. Decisões abertas: arquivos anexados ao lead (hoje só existem fotos/plantas dentro da conversa); remoção de medidas ficou só para o admin; se a loja deve agendar/bloquear até 20h (hoje o funcionamento é seg–sex até 18h, sáb até 12h, e a grade só mostra até 20h em cinza).

### Observações técnicas
- Coluna nova `tipo` na tabela `Visita` (já aplicada no `crm.db` local com `prisma db push`). Em outro computador, rodar `npm run seed` ou `npx prisma db push`.
- Dependência nova: `react-grid-layout`.
- Zoom do kanban usa a propriedade CSS `zoom`; se arrastar card ficar torto fora de 100%, trocar por largura de coluna.

### Etapas H e I (feitas depois do commit anterior)
- Configurações: escolha entre rodízio e "quem tem menos leads" (padrão continua "menos leads" até o admin ligar o rodízio); equipe com status e botão "Mandar almoçar / Voltou do almoço" para o admin; aviso de leads na fila.
- Consultor: botão "Almoço" no topo da tela.
- Rodízio: ordem da equipe = ordem de criação dos usuários; pula quem está em almoço; vale quando o bot agenda a visita ou passa o lead e o lead ainda não tem consultor.
- Aviso ao cliente no almoço: uma vez por almoço, enviado pelo sistema, só quando o lead já foi passado ao consultor que está em almoço. Regra registrada em a instrução 15 do bot.
- O item 1 e 2 da lista "O que falta fazer" acima estão concluídos.
