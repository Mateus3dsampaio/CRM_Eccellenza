# Tela de login nova

Tópico com as propostas de tela de login para trocar a atual (esfera de pontos em Three.js).
- **Proposta D, "Da conversa ao card" (22/11/2026): a escolhida para seguir.** Protótipo pronto, esperando o Mateus aprovar.
- Proposta C3, "quadro vivo + gráficos cometa" (21/11/2026): guardada; dela fica só o quadro inclinado (ver o fim deste arquivo).

---

## Proposta D: Da conversa ao card

### O que é
Uma cena contínua, sem corte, que conta o que o CRM faz: a mensagem do cliente chega, o assistente lê, os dados voam para os campos do card, o card entra no quadro, passa ao consultor e anda até Fechado. A esfera de pontos vira o personagem do assistente (sai da marca no topo, lê, senta no selo do card e volta quando passa ao consultor).

**Protótipo:** [`tela-de-login/prototipo-d-conversa-ao-card.html`](tela-de-login/prototipo-d-conversa-ao-card.html). Arquivo único: abra no navegador do PC (precisa de internet para a fonte Inter e o GSAP). Não está ligado ao CRM.

| Ato | Tempo | O que acontece |
|---|---|---|
| 1. A mensagem chega | 0–2,2 s | Balão "digitando…" abre e as palavras entram; o card nasce vazio (esqueleto) no topo de "IA atendendo". |
| 2. O assistente lê | 2,2–4,7 s | A esfera sai da marca, os ✓✓ ficam azuis e ela lê palavra por palavra, acendendo nome, ambientes e cidade. |
| 3. O card se preenche | 4,7–9,2 s | Cada palavra voa até o campo exato e uma caixa de encaixe marca o campo (NOME, CIDADE, AMBIENTES). O balão encolhe para dentro da prévia, a câmera recentra no card, o anel das 24 h abre e a esfera senta no selo ("IA atendendo"). |
| 4. O card entra no quadro | 9,2–11,3 s | A câmera se afasta e inclina, o quadro se monta em volta e o card pousa em "IA atendendo" (o contador sobe). |
| 5. Passa ao consultor | 11,3–14,5 s | A esfera volta para a marca, o selo vira o fone, aparecem as iniciais do consultor, a faixa vira "Responder · há 1 min", o card vai sozinho para "Em qualificação" e o cursor do Rafael chega. |
| 6. A jornada | 14,5–24 s | Rafael clica, a faixa vira "Medição sáb 28/11 9h" e o card vai para Medição agendada; o mesmo para a apresentação (a coluna em destaque acende roxa); Rafael arrasta o card até Fechado, a faixa e o anel saem e uma luz verde desce a coluna. |
| Próximo cliente | 24–25,7 s | A câmera volta, o quadro some e a próxima mensagem chega (3 clientes se revezam). |

**Interação:** o mouse inclina a câmera (profundidade); dá para pegar qualquer card do quadro e soltar em outra coluna, com a mesma física (sobe, inclina, balança com a velocidade, os cards abrem espaço, assenta com quique) e a história continua sozinha 2,6 s depois. **Entrar:** a câmera mergulha e o quadro fica reto, no tamanho do kanban real. **Senha errada:** o cartão balança (no protótipo, a senha `erro` simula a senha errada; qualquer outra entra).

**iPhone em pé** (ajuste de 23/11/2026, pedido do Mateus): a mesma história inteira, com a cena na metade de cima e o cartão compacto embaixo, sem rolar a página (conferido em 390×844). O quadro inclinado aparece em pé e some suave antes do cartão; o mergulho termina no kanban do tamanho do celular. Só não dá para arrastar card com o dedo (brigaria com a rolagem); no CRM real o arrasto no celular é com toque longo.

**Controles do protótipo** (não vão para o CRM): ato atual, pausar (barra de espaço), câmera lenta (½× e ¼×), recomeçar, ver como fica com "reduzir movimento" e os 7 temas.

### Decisões do Mateus (22/11/2026)
- Trocar os gráficos cometa do C3 por "Da conversa ao card", mantendo o quadro inclinado.
- A esfera grande sai do login e vira o personagem pequeno do assistente.
- Card arrastável e mergulho no kanban ao entrar já entram no protótipo.
- Registrar como proposta D neste tópico.

### Fiel ao CRM
Colunas de `src/regras/etapas.ts` (as 7, com Apresentação agendada em destaque); textos e cores das faixas de `src/regras/acao-card.ts`; selo de quem atende (robô/fone), anel da janela de 24 h, iniciais do consultor e as medidas do card de `componentes/kanban/card.tsx`; balão `bg-chat-cliente`; cores e temas de `tokens.css`; curvas `--ease-mola` e `--ease-salto` exatas. Regra de negócio respeitada: o bot não agenda, passa ao consultor; a agenda é que move o card de coluna; Fechado é arrastado pelo consultor.

### Técnica
- **GSAP 3.15.1** + CustomEase (roteiro com linha do tempo, pausa e câmera lenta globais). Licença "standard no charge": gratuito para uso comercial desde 30/04/2025, extensões incluídas; a única restrição é para ferramentas de criar animação que concorram com o Webflow (não é o caso). No CRM entra por npm, carregado só no login.
- Cena em HTML com câmera 3D (perspectiva); o mundo é desenhado 1,4× maior e a câmera só reduz, para o texto ficar sempre nítido. Anima só `transform` e `opacity` (exceção: a faixa que some em Fechado).
- Arrastar com o mouse usa uma homografia (4 marcos no plano do quadro): o card fica exatamente embaixo do ponteiro, mesmo inclinado.
- Camadas em profundidade: coluna em z 0, sombra a 0,5 px, card a 1 px. Com o card no mesmo plano da coluna, o navegador às vezes entregava o clique para a coluna.
- Gravação de vídeo sem tremer: Playwright com `page.clock.install()` + `pauseAt()` e `runFor(33)` por quadro (sem o `pauseAt`, o relógio anda sozinho enquanto o print é feito e o vídeo acelera).

### Testado em 22/11/2026 (Playwright)
- Ciclo completo, 3 clientes seguidos, sem erro de JavaScript. Telas 1440×900, 1280×720, iPhone em pé 390×844 (história inteira, sem rolar), "reduzir movimento" (imagem parada) e tema Café.
- Arrastar card (inclusive no meio do roteiro), senha errada e entrar (mergulho).
- Fluidez medida aqui, num navegador **sem placa de vídeo** (pior caso): ~52 quadros/s nos atos 1 a 3 e ~22 no quadro inclinado. O C3, no mesmo teste, deu ~19. No PC com placa de vídeo deve ser bem mais; **não verificado num PC de verdade**.

### Riscos e pontos de atenção para levar ao CRM
- **Página pública:** só nomes, cidades e falas inventados, sem R$ e sem número da loja. Mesmo assim, os textos precisam da aprovação do Mateus (abaixo).
- **"Reduzir movimento" do CRM:** `src/app/globals.css` põe `transition-duration: 1ms` em tudo. A câmera mede a tela para se enquadrar e, com 1 ms, lê a posição antiga (bug achado no protótipo, que usa 0 s). Na integração, a cena precisa ficar fora dessa regra ou a regra passar a 0 s.
- **Card de vitrine:** o card do login é uma cópia do visual do card do kanban (o real depende de dados de quem está logado). Mudou o card do kanban, atualizar a cópia.
- **Mergulho ao entrar:** ~0,7 s, acima dos 300 ms que `docs/design.md` pede para animação. Proposto como exceção (acontece uma vez por dia); se incomodar, cai para 300 ms.
- **Celular:** não testado num aparelho de verdade.
- **Three.js:** só a esfera grande usava; sai do projeto junto com ela (a esfera do menu lateral é canvas 2D).

### Em aberto (Mateus)
- Aprovar os textos inventados: as 3 mensagens (Larissa/Crato, Bruno/Barbalha, Fernanda/Juazeiro do Norte), o rótulo "WhatsApp · agora", os nomes do quadro e o consultor "Rafael Souza".
- Duração do ciclo: ~25 s hoje. Dá para encurtar (por exemplo, pular a medição e ir direto da qualificação para a apresentação).

### Etapas para levar ao CRM
- [x] 1. Protótipo D (22/11/2026).
- [ ] 2. Mateus aprova o protótipo e os textos.
- [ ] 3. Virar a tarefa 46: separar em `src/componentes/login/` (cena e câmera, roteiro dos atos, card de vitrine, esfera do assistente, cursor), ajustar `src/app/login/page.tsx`, GSAP por npm carregado só no login, tirar a esfera grande e o Three.js, resolver a regra de "reduzir movimento", mergulho ligado ao `router.push` do login.
- [ ] 4. Testes de tela (Playwright) e prints em 1440×900 e 1280×720; conferir o celular.
- [ ] 5. Atualizar `docs/mapa-do-codigo.md` (tela de login) e marcar este tópico como feito.

---

## Proposta C3: quadro vivo + gráficos "cometa" (21/11/2026, guardada)

**Substituída pela proposta D (decisão do Mateus 22/11/2026):** fica o quadro inclinado (agora com as colunas e faixas reais); saem os gráficos cometa e o título "Cada conversa no lugar certo.".

**Protótipo:** [`tela-de-login/prototipo-c3-cometas.html`](tela-de-login/prototipo-c3-cometas.html).

O que aparecia:
- **Fundo:** o Kanban do próprio CRM, inclinado em perspectiva, com cards fictícios se mexendo sozinhos (mudam de coluna, chegam clientes novos, mensagens novas, faixa de situação mudando, brilho azul no card que mudou).
- **Na frente do quadro:** um gráfico grande por vez, desenhado como um cometa (ponta brilhante e rastro que apaga), cruzando a tela e sumindo. Três tipos, sempre nesta ordem:
  1. Linha crescente de ponta a ponta, com área azul por baixo e um "+NN%" no fim.
  2. Silhueta de 13 a 17 barras de ponta a ponta: o risco contorna e cada barra acende quando ele passa.
  3. Funil grande (Novo contato → Qualificação → Apresentação → Fechado) com a porcentagem de cada etapa.
- **À esquerda, embaixo:** o título "Cada conversa no lugar certo." com o selo "Assistente atendendo agora".
- **À direita:** o mesmo cartão de login de hoje, com dois extras: mostrar senha e aviso de Caps Lock ligado (os dois seguem na proposta D).

Decisões da época (21/11/2026): só os três gráficos acima; um gráfico por vez, ~4 s na tela e 4 s de pausa; gráficos grandes passando por trás do cartão. Descartadas também as direções planta técnica desenhando em loop (A), armário de portas abrindo (B) e as versões com painéis fixos (C e C2).

Por que saiu: gráfico de funil e "+25%" são genéricos (qualquer sistema tem), mostram número falso numa página pública e, no protótipo, as barras passavam por cima do título.
