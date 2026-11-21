# Tela de login nova: quadro vivo + gráficos "cometa"

## O que é
Proposta de tela de login para trocar a atual (esfera de pontos em Three.js). Registrada em 21/11/2026.
**Protótipo pronto e funcionando:** [`tela-de-login/prototipo-c3-cometas.html`](tela-de-login/prototipo-c3-cometas.html). É um arquivo único: abra no navegador do PC para ver. Não está ligado ao CRM.

O que aparece:
- **Fundo:** o Kanban do próprio CRM, inclinado em perspectiva, com cards fictícios se mexendo sozinhos (mudam de coluna, chegam clientes novos, mensagens novas, faixa de situação mudando, brilho azul no card que mudou).
- **Na frente do quadro:** um gráfico grande por vez, desenhado como um cometa (ponta brilhante e rastro que apaga), cruzando a tela e sumindo. Três tipos, sempre nesta ordem:
  1. Linha crescente de ponta a ponta, com área azul por baixo e um "+NN%" no fim.
  2. Silhueta de 13 a 17 barras de ponta a ponta: o risco contorna e cada barra acende quando ele passa.
  3. Funil grande (Novo contato → Qualificação → Apresentação → Fechado) com a porcentagem de cada etapa.
- **À esquerda, embaixo:** o título "Cada conversa no lugar certo." com o selo "Assistente atendendo agora".
- **À direita:** o mesmo cartão de login de hoje, com dois extras: mostrar senha e aviso de Caps Lock ligado.

## Decisões já tomadas pelo Mateus (21/11/2026)
- Só os três gráficos acima. Descartados: barra com valor em R$, ranking, arco de meta, seta de crescimento, valor subindo do card em Fechado e os painéis fixos (meta, funil, vendas).
- Um gráfico por vez, cada um com uns 4 s na tela; **4 s de pausa** entre um e outro.
- Os gráficos grandes, ocupando quase a tela toda; linha e barras cruzam de um lado ao outro, passando por trás do cartão de login.
- Descartadas também as outras direções testadas: planta técnica desenhando em loop (proposta A, guardada só na conversa), armário de portas abrindo (B) e as versões com painéis fixos (C e C2).

## Riscos
- **A tela de login é pública na internet.** Qualquer pessoa com o endereço vê. Nada de número real da loja (faturamento, metas, clientes) nesta tela. Os nomes e valores dos cards são inventados; mesmo assim podem parecer clientes e valores reais para quem vê de relance.
- A esfera de pontos atual sai do login (ela continua no menu lateral, em `componentes/menu-esfera.tsx`).
- O texto do título é proposta: precisa de aprovação do Mateus antes de valer.

## Etapas para levar ao CRM
- [ ] 1. Mateus decide os pontos em aberto (abaixo).
- [ ] 2. Planejar a troca: separar o protótipo em componentes (quadro vivo, gráficos cometa, cartão) dentro de `src/componentes/login/` e ajustar `src/app/login/page.tsx`. Tirar o Three.js do login se a esfera sair de vez.
- [ ] 3. Implementar com os tokens de `src/app/tokens.css` (o protótipo já usa os mesmos nomes de cor e segue os temas), respeitando "reduzir movimento" e os limites do `docs/design.md`.
- [ ] 4. Testes de tela (Playwright) e prints em 1440×900 e 1280×720; conferir o celular.
- [ ] 5. Atualizar `docs/mapa-do-codigo.md` (tela de login) e marcar este tópico como feito.

## Em aberto
- Manter o quadro de cards no fundo, ou deixar só os gráficos sobre fundo escuro?
- Manter o título "Cada conversa no lugar certo." e o selo "Assistente atendendo agora"?
- Valores nos cards: tirar o R$ (como foi testado na C2) ou deixar valores obviamente falsos?
