# Tarefa 46 – Login novo: "Da conversa ao card"

Objetivo: levar para o CRM (Next.js) a proposta D da tela de login, aprovada pelo Mateus em 23/11/2026 ("Gostei"), no PC e no iPhone em pé, como no protótipo `tarefas/futuras/tela-de-login/prototipo-d-conversa-ao-card.html`. Detalhes da proposta, testes e riscos: `tarefas/futuras/tela-de-login-cometas.md`.

## Decisões do Mateus
- 22/11/2026: trocar os gráficos cometa pela história "Da conversa ao card", com o quadro inclinado; a esfera grande sai e vira o assistente; card arrastável e mergulho no kanban ao entrar.
- 23/11/2026: aprovou o protótipo, pediu a versão para iPhone em pé e pediu para **guardar o login atual no projeto** antes de trocar (guardado em `docs/legado/login-esfera/`).

## Como fica
- PC: a cena ocupa a área à esquerda; o cartão de login (o mesmo `vidro` do CRM) fica à direita. iPhone em pé: a cena na metade de cima, o cartão embaixo, sem rolar.
- A história (~25 s, se repete com 3 clientes inventados): a mensagem chega, a esfera lê, as palavras voam para os campos do card, a câmera se afasta, o card passa ao consultor e anda até Fechado.
- Os cards usam as regras de verdade: faixa por `acoesDoCard` (`regras/acao-card.ts`), anel por `situacaoDaJanela` (`regras/janela24h.ts`), datas por `formatarVisitaCurta`, nomes das colunas de `regras/etapas.ts`. As datas são contadas a partir de hoje, então nunca ficam velhas.
- PC: dá para pegar qualquer card e arrastar para outra coluna. No celular não (brigaria com a rolagem).
- Entrar: a câmera mergulha no quadro (~0,6 s, exceção aos 300 ms do `docs/design.md`, aceita junto com a proposta) e abre o kanban. Senha errada: o cartão balança.
- "Reduzir movimento": imagem parada. Computador fraco (a cena não passa de ~24 quadros por segundo nos primeiros segundos): a cena congela sozinha numa imagem parada.
- O formulário funciona mesmo se a cena não carregar.

## Etapas
- [x] 1. Guardar o login atual (`docs/legado/login-esfera/`, prints, passo a passo para voltar).
- [x] 2. Cena em `src/componentes/login/cena/` (dados, texto, geometria, ícones, montagem, esfera, roteiro e a cena), estilos em `src/app/login/login.css`, página `src/app/login/page.tsx`.
- [x] 3. GSAP por npm, carregado só no login. Sai o Three.js (só a esfera grande usava).
- [x] 4. Testes: unitários (texto, geometria, dados da vitrine), testes de tela existentes ajustados, prints em 1440×900, 1280×720 e iPhone 390×844 (`docs/rodadas/prints-login-46/`). Rodada completa: 578 testes unitários, tipos, build e 27 de 28 testes de tela (o que falhou é intermitente e passa sozinho; anotado em `docs/pendencias.md`).
- [x] 5. Mapa do código e tópico da tela de login.
- [ ] 6. Mateus: conferir no PC e no iPhone (fluidez com placa de vídeo nunca foi medida) e decidir juntar à `main`.
