# Requisitos – CRM Eccellenza

Cada requisito tem um ID. Os revisores citam o ID ao apontar problemas. **E1** = etapa 1 (funcionar), **E2** = etapa 2 (layout profissional).
Um requisito só está "atendido" se o critério de aceite puder ser demonstrado no sistema rodando.

## BOT – atendimento
- **BOT-01 (E1)** O prompt do bot é montado a cada conversa a partir das instruções de atendimento (banco do CRM, ver INST-01 a INST-06) + `agente/loja.md` + `agente/complemento-crm.md`, lidos em tempo de execução (não copiados à mão para dentro do código).
  - Aceite: alterar uma instrução no arquivo muda o comportamento do bot sem mexer no código.
- **BOT-02 (E1)** O bot segue as instruções: uma pergunta por mensagem, roteiro da 02, faixa de valor só para cozinha (03), nunca preço fechado ou desconto, casos da 06 direto ao consultor.
  - Aceite: os cenários de `testes/cenarios.md` passam com o agente `cliente-simulado`.
- **BOT-03 (E1)** O bot grava as informações por ferramentas (`registrar_lead`, `atualizar_lead`, `classificar_lead`, `registrar_medidas`, `ver_horarios_livres`, `agendar_visita`, `passar_para_consultor`).
  - Aceite: ao fim de uma conversa simulada, a ficha do lead tem todos os dados ditos pelo cliente, sem dados inventados.
- **BOT-04 (E1)** Leitura de medidas em foto/planta enviada no chat, com confirmação ao cliente e origem "informada pelo cliente".
- **BOT-05 (E1)** Quando um consultor assume a conversa, o bot para de responder nela até o consultor devolver.
- **BOT-06 (E1)** Erro ou falta de chave da API não derruba o sistema: aparece um aviso claro e a conversa fica marcada "aguardando humano".

## KAN – kanban
- **KAN-01 (E1)** Colunas: Novo / bot atendendo · Pronto para o consultor · Visita agendada · Orçamento apresentado · Negociação · Fechado · Perdido · Sem resposta. Cada coluna mostra o contador.
- **KAN-02 (E1)** Card mostra: foto/avatar, nome, horário da última mensagem, prévia da última mensagem, cidade, ambientes, investimento informado, etiquetas e um sino quando o cliente aguarda resposta humana.
- **KAN-03 (E1)** Arrastar e soltar entre colunas no computador; no celular, toque longo para arrastar **e** alternativa por menu "Mover para...".
- **KAN-04 (E1)** Etiquetas coloridas: Outra cidade, Arquiteto/parceiro, Pós-venda, Já atendido, Retomada enviada. Filtro por etiqueta, consultor e cidade. Busca por nome, telefone e texto da ficha.
- **KAN-05 (E1)** O bot move os cards sozinho (novo → pronto para o consultor → visita agendada) e o movimento aparece na tela sem recarregar.
- **KAN-06 (E2)** Coreografia de arrastar descrita em `docs/design.md` (parte 2).

## FICHA – lead pronto para o consultor
- **FICHA-01 (E1)** Ficha do lead: nome, telefone, cidade, endereço (se informado), ambientes, medidas (com origem), exigências pessoais, situação do imóvel, prazo, investimento, pedidos técnicos literais, etiquetas, consultor responsável, visita agendada.
- **FICHA-02 (E1)** Resumo para o consultor em texto curto, pronto para copiar (formato no fim deste arquivo).
- **FICHA-03 (E1)** Histórico completo da conversa, notas internas e registro de quem mudou o quê (bot, consultor, Mateus).
- **FICHA-04 (E1)** Consultor pode editar e corrigir os dados que o bot preencheu.

## CHAT – simulador de conversa
- **CHAT-01 (E1)** Tela estilo WhatsApp para fazer o papel do cliente: criar cliente fictício (nome, telefone), enviar texto e imagem.
- **CHAT-02 (E1)** Interface programática de teste (rota de API ou script `npm run simular`) para o agente `cliente-simulado` conversar com o bot sem usar a tela.
- **CHAT-03 (E1)** Consultor responde pela própria tela da conversa, assumindo e devolvendo ao bot (BOT-05).

## MSG – nova mensagem sem contato salvo
- **MSG-01 (E1)** Botão "Nova mensagem": campo de número (com DDI/DDD, validação de formato), texto, envio. Não exige cadastro prévio do contato; cria o lead se não existir.
- **MSG-02 (E1)** Regra da janela de 24h: dentro da janela, texto livre; fora dela ou para quem nunca falou com a loja, só **modelo aprovado** (lista de modelos fictícios no simulador). A tela explica a regra quando o texto livre estiver bloqueado.
- **MSG-03 (E1)** Status da mensagem: enviado, entregue, lido e falhou (número sem WhatsApp), simulados, com os ícones de check.
- **MSG-04 (E1)** Sem disparo em massa: envio é sempre para um número por vez.

## AGENDA
- **AGENDA-01 (E1)** Calendário com visão de dia e semana, visitas e bloqueios por consultor.
- **AGENDA-02 (E1)** O bot oferece só horários livres, dentro das regras de `agente/complemento-crm.md`, e nunca marca dois clientes no mesmo horário do mesmo consultor.
- **AGENDA-03 (E1)** Consultor cria bloqueios, remarca e cancela visitas; o card e a ficha refletem a mudança.
- **AGENDA-04 (E1)** Visita agendada aparece no card (data e hora) e move o card para "Visita agendada".

## RET – retomada e "Sem resposta"
- **RET-01 (E1)** 3 dias sem resposta depois da última mensagem do bot → envia **uma** retomada (modelo) e aplica a etiqueta "Retomada enviada". Nunca envia mais de uma retomada por lead.
- **RET-02 (E1)** Se o cliente responder, o card volta à etapa em que estava e a etiqueta sai.
- **RET-03 (E1)** Sem resposta 4 dias depois da retomada (provisório) → card vai para "Sem resposta".
- **RET-04 (E1)** Relógio simulado: controle visível no simulador para avançar horas e dias e disparar as rotinas, com registro do que aconteceu.

## LIMP – arquivar e excluir
- **LIMP-01 (E1)** Seleção múltipla de cards; ações "Arquivar" e "Excluir".
- **LIMP-02 (E1)** Botão "Limpar coluna" (pelo menos em "Sem resposta" e "Perdido"), com confirmação que mostra a quantidade. Ex.: "Excluir 23 leads? Não dá para desfazer."
- **LIMP-03 (E1)** Arquivado sai do kanban, pode ser consultado numa lista de arquivados e restaurado.
- **LIMP-04 (E1)** Arquivado há 30 dias é excluído de vez, com mensagens e mídias (fotos, plantas).
- **LIMP-05 (E1)** Só o administrador (Mateus) exclui. Consultor arquiva, mas não exclui: o botão nem aparece para ele, e a API recusa.
- **LIMP-06 (E1)** Excluir não altera as métricas: o painel usa contadores anônimos gravados no momento dos eventos.

## MET – painel
- **MET-01 (E1)** Por semana e por mês: leads novos, qualificados, curiosos, outras cidades, arquitetos/parceiros, sem resposta, retomadas que voltaram, visitas agendadas, visitas por consultor.
- **MET-02 (E1)** Funil: novo → pronto para o consultor → visita agendada → orçamento → fechado, com taxa de conversão entre etapas.
- **MET-03 (E1)** Contadores anônimos (sem nome, telefone ou texto) preservados após exclusões.

## USR – usuários
- **USR-01 (E1)** Login com perfis administrador e consultor. Seed: Mateus (admin) e 2 consultores fictícios.
- **USR-02 (E1)** Permissões verificadas no servidor, não só escondidas na tela.

## SEG – segurança e LGPD
- **SEG-01 (E1)** Chave da API só no `.env`; nunca em código, log ou tela. `.env` no `.gitignore`.
- **SEG-02 (E1)** Só dados fictícios no seed e nos testes.
- **SEG-03 (E1)** Mídias guardadas fora da pasta pública, servidas só para usuário logado.

## TEC – técnico
- **TEC-01 (E1)** `npm install` + `npm run dev` sobem o sistema; `npm run seed` cria dados de exemplo; `npm test` roda os testes.
- **TEC-02 (E1)** Testes automáticos das regras críticas: janela de 24h, retomada, exclusão em 30 dias, permissões, agenda sem conflito.
- **TEC-03 (E1)** README com o passo a passo para o Mateus rodar, em português.
- **TEC-04 (E1)** Funciona em celular (largura 375px) e computador.

## Formato do resumo para o consultor (FICHA-02)
```
Ana Souza – Crato – apartamento na planta, entrega em mar/27
Ambientes: cozinha, 2 quartos, área gourmet
Medidas: cozinha 3,20 × 2,10 (planta enviada, confirmada); quartos sem medida
Exigências: cooktop na ilha, cores claras
Pedido técnico: "quero aproveitar a bancada de granito"
Investimento: informou R$ 40–60 mil
Visita: sáb 08/11 10h com Consultor 1
Classificação: qualificado
```

## Critérios de aceite da etapa 1
A etapa 1 termina quando:
1. Todos os requisitos E1 estão atendidos e demonstráveis.
2. Os cenários de `testes/cenarios.md` passam no `cliente-simulado`, sem violação de regra comercial (preço, desconto, prazo inventado).
3. `npm test` passa.
4. Nenhum apontamento bloqueante aberto dos quatro revisores.
5. O relatório final em `docs/rodadas/` explica ao Mateus como rodar e testar, o que ficou pendente e o que foi marcado como PROVISÓRIO.

## Instruções de atendimento editáveis (pedido do Mateus, 31/10/2026)
- **INST-01** O CRM é a fonte principal das instruções: as 13 originais entram no banco na primeira vez (carga inicial de `agente/instrucoes/`) e o bot passa a ler do banco.
- **INST-02** Só o admin vê e edita (tela e API conferem a permissão `configurar`).
- **INST-03** Aba "Instruções de atendimento" em Configurações: criar, editar título e texto, reordenar e ativar/desativar.
- **INST-04** Guarda só a versão anterior: cada edição de título/texto joga a atual para "anterior"; botão "Voltar para a anterior" troca as duas.
- **INST-05** Exportar: janela com seleção por instrução e "selecionar todas"; saída em .txt único ou .zip com um .txt por instrução.
- **INST-06** Aviso de confirmação ao salvar e atalho "Testar no simulador".
- **INST-07** O admin pode excluir uma instrução de vez, com confirmação clara de que não dá para desfazer. Não pode excluir a última instrução ativa.

## Bloco 1 – Avisos e leads esperando resposta (pedido do Mateus, 04/11/2026)
Tarefas em `tarefas/`. Marcado ✅ o que já está pronto.
- **ESP-01** Som quando chega mensagem nova de cliente. ✅ Som feito no navegador; só toca para quem recebe o aviso.
- **ESP-02** Notificação do navegador, com a aba em segundo plano, para mensagem nova, lead passado pelo bot e visita marcada. ✅ Com a aba na frente, o aviso aparece dentro do CRM. Visita só gera aviso quando o bot marca.
- **ESP-03** O aviso vai só para o dono do lead; o admin recebe todos e pode silenciar. ✅ O silenciar (som e notificações) fica no sino do topo e vale só naquele navegador. Lead sem dono: só o admin recebe.
- **ESP-04** Número de leads esperando na aba do navegador, ex.: "(3) CRM Eccellenza". ✅ O título atual é "CRM Eccellenza – simulador", então aparece "(3) CRM Eccellenza – simulador".
- **ESP-05** Contador "X aguardando você" no topo que abre a lista desses leads. ✅ (consultor vê os dele; admin vê todos)
- **ESP-06** Bolinha com o número de mensagens não lidas no card. ✅ Zera ao abrir a ficha com a aba visível.
- **ESP-07** "Esperando há X min" no card. ✅
- **ESP-08** Cor do card por espera (normal, amarelo, vermelho) com prazos editáveis em Configurações. ✅ regra, prazos e cor do card. **PROVISÓRIO:** 10 min amarelo e 30 min vermelho, até o Mateus decidir.
- **ESP-09** Avisar o admin quando um lead passar do prazo vermelho sem resposta. ✅ Um aviso por espera (uma espera nova avisa de novo). Chega como notificação do navegador ou aviso na tela, sem som, e respeita o silenciar. O consultor não recebe este aviso.
- **ESP-10** Cada coluna ordena primeiro quem espera resposta (o que espera há mais tempo no topo), depois o resto pela última mensagem. ✅
- **ESP-11** O card sobe quando um lead que já existe manda mensagem nova. ✅
- **ESP-12** Filtros de um clique: "Esperando resposta" e "Meus leads". ✅ ("Meus leads" só para consultor; o admin já tem os botões por consultor)
- Definição de "esperando": só o lead que está com humano (bot passou, consultor na conversa ou erro do bot). A espera começa na 1ª mensagem do cliente sem resposta do consultor e só termina quando o consultor responde ou devolve ao bot. Mensagem do bot ou do sistema não encerra.
- Limite conhecido: a bolinha de não lidas é uma só por lead. Se o admin abrir a conversa, ela zera para o consultor também.
