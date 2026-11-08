# Tarefa 37 – Relógio da janela de 24h da Meta

Objetivo: o vendedor ver, no card, quanto falta para a janela de 24h fechar e agir antes (só mensagem do **cliente** reabre; a do vendedor não prorroga).

Limites PROVISÓRIOS (Mateus, 07/11/2026): verde > 6 h, amarelo 2–6 h, vermelho ≤ 2 h, cinza = fechada ("Só modelo"). Ajustáveis em Configurações (a fazer).

## Etapas (uma por vez, com validação)
- [x] 1. Regra `situacaoDaJanela` em `src/regras/janela24h.ts`, com testes (`testes/unit/janela24h.test.ts`).
- [x] 2. Relógio (anel + horas) no card (`src/componentes/kanban/relogio-janela.tsx`), só em etapa aberta; dica com a hora exata.
- [x] 3. Botão "Janelas fechando" no topo (`src/componentes/janelas.tsx`, rota `/api/janelas`): menos de 2 h, mais urgente primeiro; consultor vê os dele.
- [x] 4. Faixa na ficha com menos de 6 h (hora de fechar) e botão "Reabrir com modelo" (modelo `retomada`, já aprovado) quando a janela fechou. **Sem mensagens prontas por enquanto** (Mateus, 07/11/2026).
- [ ] 4b. (adiado, o Mateus decide depois) Mensagens prontas para provocar resposta dentro da janela, que só preenchem o campo de texto (o vendedor revê e envia). Rascunho proposto: geral, esperando planta/medidas, depois do orçamento, convite para visita. Precisam da aprovação dele antes de valerem.
- [x] 5. Painel: % de leads ativos com janela aberta.

Pendente do Mateus: conferir na Meta como o modelo fora da janela é cobrado antes de dar destaque ao "Reabrir com modelo".
