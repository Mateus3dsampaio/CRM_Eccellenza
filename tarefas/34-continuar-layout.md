# Tarefa 34 – Continuar a série de layout (23–33) de onde parou

Ponto de retomada escrito em 04/11/2026, quando o Mateus pediu para parar (crédito acabando). Quem pegar esta tarefa (qualquer modelo/sessão) continua daqui, sem precisar reler a conversa.

**Status: a fazer.**

## Onde está o trabalho
- Branch: `claude/gallant-fermi-z6vt65` (já no GitHub). O Mateus testa e faz o merge se gostar.
- Tarefas 23 a 33 estão **implementadas e commitadas**, uma por commit ("Tarefa NN: ..."). Cada arquivo `tarefas/23-*.md` a `33-*.md` tem o status e uma seção "Decisões na implementação" com o que foi decidido sem o Mateus.
- `docs/mapa-do-codigo.md` já foi atualizado em todas (arquivos novos: `componentes/ficha/gaveta.tsx`, `componentes/menu-usuario.tsx`, `componentes/titulo-tela.tsx`, `componentes/configuracoes/barra-salvar.tsx`; `Popover` e `Dica` em `componentes/ui.tsx`).
- Testes: `npm run tipos`, `npm run lint` e `npm test` (290 testes) passam em tudo.

## O que falta (nesta ordem)
1. **Testes de tela** (`npm run seed && npm run test:tela`) para os lotes B, C e D — só o lote A (tarefas 23–25) rodou no Playwright e passou (9/9 no projeto "computador"). Rodar nos dois projetos (computador e celular). O teste `ficha do lead...` já foi atualizado para a gaveta (tarefa 23); conferir se os outros ainda batem com: abas vertical das Configurações (continuam `role="tab"`), barra de cima sem botão "Sair" (agora no menu do avatar, `aria-label="Menu de <nome>"`), e o botão "Exportar" que saiu de Configurações para o Painel.
   - Observação do ambiente: na nuvem o Chromium fica em `/opt/pw-browsers/chromium`; no PC do Mateus o `npm run test:tela` normal serve.
2. **Tarefa 33 – conferir o visual**: tirar print do kanban com vários cards atrasados (no simulador, "+1 hora" gera atrasos) e gravar em `docs/rodadas/evidencias/` um antes/depois para o Mateus decidir. Regra do crítico em `src/regras/espera.ts` (`idsCriticosDaColuna`, PROVISÓRIO): o vermelho mais antigo da coluna ou 24 h+. Classes em `src/componentes/espera.tsx` (`CLASSE_CARD_ESPERA`, `CLASSE_CARD_CRITICO`, `CLASSE_BADGE_ESPERA`). Marcar a 33 como feita no arquivo dela.
3. **Conferir o que não foi testado**: tema claro (menu do avatar troca o tema) e celular (375px) nas telas mexidas — gaveta em tela cheia, popover de filtros virando folha de baixo, submenu das Configurações em linha no topo, abas Conversa/Ficha na ficha.
4. **Rodada de revisão** (`/ciclo etapa 1`, ou chamar `revisor-design` e `revisor-codigo` à mão) sobre tudo da série, corrigir só o bloqueante, e escrever `docs/rodadas/08-layout-e-organizacao.md` com o resumo e os prints.
5. Push de novo na mesma branch ao terminar. **Não criar PR** sem o Mateus pedir.

## Pontos que o Mateus pode querer mudar depois de testar
- Tarefa 24: o zoom automático deixa o kanban em 79% (1440) / 75% (1280). Se achar pequeno, basta apertar "+" (vira zoom fixo) ou mudar `ZOOM_AUTO_MINIMO` em `src/componentes/kanban/zoom.ts`.
- Tarefa 27: o zoom foi para dentro do popover "Filtros" ("Tamanho dos cards").
- Tarefa 28: largura da gaveta (600px) e altura padrão dos blocos em `src/regras/layout-ficha.ts` (`LAYOUT_PADRAO_FICHA`).
- Tarefa 33: critério do card crítico (ver acima).

## Pronto quando
Os testes de tela passam nos dois projetos, a 33 tem print aprovado (ou ajustado) pelo Mateus, e o relatório da rodada está em `docs/rodadas/`.
