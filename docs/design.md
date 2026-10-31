# Design – CRM Eccellenza

O Mateus é exigente com layout. Ele quer um visual **profissional, bonito, com profundidade e animação**, à altura de uma loja de móveis planejados de ticket alto.
Referências: `docs/referencias/ref-kanban.png` (kanban com cards) e `docs/referencias/ref-nova-mensagem.png` (nova mensagem e status de entrega). Usar o **visual** como referência. Não copiar marca, textos nem o funcionamento de produtos que rodam sobre o WhatsApp Web.

---

## Parte 1 – Etapa 1: limpo e organizado
Objetivo: funcionar bem e já parecer um produto, sem gastar tempo em animação elaborada.

**Base visual (igual às referências)**
- Fundo claro levemente azulado/acinzentado; colunas em painéis claros; cards brancos com cantos arredondados (12–16px) e sombra suave.
- Barra colorida no topo de cada coluna, com nome da etapa e contador ("2.469 conversas").
- Verde do WhatsApp só como destaque (ícone de canal, status); a cor principal da marca fica definida em tokens.
- Avatar redondo, nome em negrito, horário à direita, prévia da mensagem em cinza com reticências, linha de metadados (cidade, investimento, consultor) com ícones pequenos.
- Etiquetas em pílulas coloridas com "x" para remover.
- Sino de alerta no card quando o cliente aguarda humano.
- Bastante espaço em branco, alinhamento rigoroso, tipografia limpa (Inter ou similar).

**Fundamentos obrigatórios**
- Todas as cores, sombras, raios, espaçamentos e fontes num arquivo único de **tokens**. Nada de valor solto no código.
- Celular (375px) e computador. No celular o kanban vira colunas deslizáveis com abas por etapa, nunca uma tela espremida ou com rolagem lateral da página inteira.
- Estados desenhados: vazio ("Nenhum lead nesta etapa"), carregando (skeleton), erro, sem permissão.
- Contraste legível (WCAG AA), áreas de toque de pelo menos 44px, foco visível no teclado.
- Textos 100% em português do Brasil; datas e horas no formato brasileiro; moeda "R$ 40.000".
- Interações mínimas já na etapa 1: hover com leve elevação nos cards, transição curta ao mover cards, feedback ao clicar em botões.

---

## Parte 2 – Etapa 2: layout profissional (diretor de arte)
Só começa quando o Mateus liberar. Trabalha **só na aparência**: não muda regras de negócio, dados nem textos do bot.

**Profundidade: extrusão e sombra**
- Sistema de elevação com 5 níveis (0 a 4). Cada nível é uma sombra em camadas (sombra de contato curta e escura + sombra ambiente longa e difusa), nunca uma sombra única e dura.
- Card parado = nível 1; hover = nível 2; selecionado = nível 3; arrastando = nível 4.
- Extrusão discreta em cards e botões principais: borda inferior um tom mais escuro + sombra, dando volume. Ao clicar, o botão "afunda" (desce 1–2px e perde a sombra).
- Superfícies com leve gradiente ou brilho, nunca sombra preta chapada.

**Coreografia do card no kanban (pedido do Mateus, item obrigatório)**
1. **Pegar** (clique ou toque longo): o card sobe (escala ~1,05), inclina ~3°, a sombra cresce e se afasta (nível 4); os outros cards esmaecem levemente.
2. **Arrastar**: o card acompanha o ponteiro ou o dedo com um leve balanço proporcional à velocidade; a coluna de destino se destaca e os cards dela se afastam suavemente para abrir espaço.
3. **Soltar na coluna certa**: o card gira de volta a 0°, desce e assenta com um pequeno quique de mola; os contadores das duas colunas animam o número mudando.
4. **Soltar em lugar inválido**: o card volta à origem com mola, sem "teleporte".

**Outras animações**
- Contadores numéricos animados; toasts deslizando; skeleton com brilho ao carregar.
- Abrir a ficha do lead: o card se expande na ficha (transição compartilhada); fechar faz o caminho inverso.
- Novas mensagens no chat entram com deslize curto; checks de status mudam com transição.
- Card movido pelo bot (KAN-05) atravessa a tela até a nova coluna, para o consultor perceber.

**Limites**
- Animações utilitárias de até 300 ms; nenhuma animação pode atrasar o trabalho do consultor.
- Respeitar "reduzir movimento" do sistema operacional (trocar movimento por transição de opacidade).
- 60 quadros por segundo em celular intermediário: animar só `transform` e `opacity`, nada de animar largura, altura ou sombra pesada a cada quadro (usar camadas pré-renderizadas).

**Identidade**
- Paleta, tipografia e ícones coerentes com móveis planejados de alto padrão: elegante, sóbrio, sem aparência de template genérico.
- O diretor de arte propõe 2 direções visuais (prints) antes de aplicar em tudo. O Mateus escolhe.

**Entrega da etapa 2**
- Prints antes e depois (computador e celular) e um **vídeo curto** das interações (gravação do Playwright), com a coreografia do card.
- A palavra final sobre o visual é do Mateus.
