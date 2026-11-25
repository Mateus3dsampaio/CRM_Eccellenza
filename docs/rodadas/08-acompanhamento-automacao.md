# Rodada 08 – Acompanhamento visual da automação (tarefa 48)

Origem: o Mateus aprovou em 25/11/2026 um protótipo (`prototipo-automacao.html`) de acompanhamento da automação no kanban, só para o admin. Feito numa sessão na nuvem que se perdeu; refeito aqui a partir do prompt e dos prints. O prompt chamava de "tarefa 47", mas a 47 é o Instagram: esta é a **48**. Ficha: `tarefas/48-acompanhamento-automacao.md`.

## O que ficou pronto
- **Regras de previsão** (`src/regras/previsao-automacao.ts`): quando a recuperação manda a 1ª e a 2ª mensagem, quando o lead vai para Perdido (o mais cedo entre a recuperação e a rede de segurança), quando o Perdido vai para o arquivo; categorias dos chips, cores e textos da linha. Usa as **mesmas funções** das rotinas (`horarioDaSegunda`, `proximoHorarioPermitido`, janela de 24h).
- **Servidor** (`src/servicos/previsao-automacao.ts`, `src/app/api/kanban/route.ts`): a rota só manda `automacao` quando o usuário é admin. A data de entrada em Perdido foi extraída de `perdidosVencidos` para `entradasEmPerdido`, usada pela rotina e pela previsão (a rotina continua fazendo exatamente o mesmo).
- **Tela** (`src/componentes/kanban/automacao.tsx`, ligada em `quadro.tsx` e `card.tsx`): chips no cabeçalho (sem chip com zero; clicar filtra a coluna sem mexer nos contadores), olho ao lado do lápis (começa desligado; `localStorage` por coluna), linha em cada card logo abaixo da faixa de ação (trilha de 3 marcas ou ícone), balão "AUTOMAÇÃO DESTE LEAD" com o mesmo atraso das outras dicas, fade de altura que respeita `prefers-reduced-motion`. Só tokens do tema.

## Como foi conferido
- **Teste de consistência** (`testes/unit/previsao-automacao.test.ts`): 600 estados aleatórios de semente fixa. Para cada previsão, `avaliarRecuperacao`/`avaliarRede`/`diasParaArquivar` devolvem a ação **no minuto previsto e em nenhum minuto antes**; previsões "travado" ou "fora" não têm ação nas 48 h seguintes; e os passos projetados (2ª, Perdido) são os que o ciclo realmente executa, rodando minuto a minuto.
- **Servidor** (`previsao-automacao-servidor.test.ts`): admin recebe `automacao` e consultor não (a resposta do consultor nem contém a palavra); só IA atendendo e Perdido, nunca arquivados; e **o card realmente se move na hora prevista** (1ª, 2ª, Perdido e arquivo, com o relógio simulado, um minuto antes e no minuto).
- Os testes que já existiam de recuperação, rede de segurança e arquivo passaram **sem alteração**.
- **Tela** (prints 1440×900, escala 2, em `docs/rodadas/prints-automacao-visual/`, com dados fictícios e o relógio simulado em quinta 26/11 às 10h): olho desligado e ligado, balão, chip filtrando (divisor "Precisa de você · 0" esmaecido), coluna Perdido ("Arquivo hoje", "amanhã", "em N dias") e a visão do consultor (sem olho, chips nem linha; `/api/kanban` sem `automacao`).
- **Desempenho:** `/api/kanban` com 13 leads no banco local de desenvolvimento: mediana 92 ms para o admin (com a previsão) contra 72 ms para o consultor (sem), cerca de 20 ms a mais. Sem consulta por lead (configurações, leads com visitas futuras, `idsQuePassaramPorHumano` e `entradasEmPerdido`, cada um uma vez por chamada). Não medido com volume de produção.

## Pontos de atenção
- **Regra que parece errada (não corrigida aqui):** a recuperação ignora o retorno marcado, a rede respeita. Registrado em `tarefas/futuras/recuperacao-ignora-retorno-marcado.md`.
- **Lead "travado":** quando a 2ª mensagem não cabe na janela de 24h, o lead fica sem mensagem automática até a rede de segurança (5 dias). A tela mostra "Travado" com a data da rede; mudar isso é decisão do Mateus.
- Chips da coluna Perdido: o protótipo não mostrava essa coluna; usei "arquiva em breve" (hoje ou amanhã, vermelho) e "depois" (cinza). Conferir com o Mateus.
- O balão abre com o mouse parado 0,6 s (`ATRASO_DICA_MS`, como as outras dicas); o protótipo abria na hora.
- Os prints foram tirados com o Google Chrome instalado (o Playwright não tinha navegador baixado); não rodei `npm run test:tela`.
- Nunca visto em produção. O `npm run seed` foi rodado (apaga os dados de teste locais).
