# Tarefas visuais: identidade única (a cara do login em todas as telas)

Plano aprovado pelo Mateus em 11/11/2026. **Só layout e visual: nenhuma função ou regra muda.**
Sem animação que deixe lento o uso do dia a dia; animação só onde fica legal (telas de pouco uso).

## Onde paramos (12/11/2026)
- Branch: `feat/visual-identidade` (no GitHub, **sem PR aberto**).
- Feitos: blocos **A**, **B** (aprovados pelo Mateus em 12/11/2026), **E**, **D**, **C**, **F** e **G**.
- **Aguardando o teste do Mateus** dos blocos E, D, C, F e G.
- Blocos todos feitos. Falta: ajustes do teste, as "pequenas sobras" e abrir o PR (com autorização).

## Como retomar
1. Ler este arquivo e a linha "Identidade visual" em `docs/mapa-do-codigo.md` (seção "Onde mexer para…").
2. Perguntar ao Mateus o resultado do teste do último bloco feito e ajustar o que ele apontar.
3. Seguir um bloco por vez, parando para ele testar. Marcar `[x]` aqui ao concluir.
4. Ao terminar tudo: abrir o PR da branch para a `main` (só com autorização).

## Peças já prontas (usar, não recriar)
- `src/app/globals.css`: `luz-marca-forte`, `luz-marca-media`, `luz-marca-fio` (luz da marca); `vidro` (só no que flutua); `rotulo-secao`; `menu-ativo`, `menu-ativo-filete`, `menu-onda`.
- `src/app/globals.css` (bloco E): `veu` e `veu-desfoque` (escuro atrás de gaveta e janela), `janela-entrar`, `menu-nascer`, `vidro-escuro` e `filete-aviso` (aviso do canto).
- `src/app/tokens.css`: `--tempo-clique` (90 ms), `--tempo-surgir` (160 ms), `--tempo-janela` (220 ms), `--tempo-painel` (280 ms), curva `--ease-mola`.
- `src/app/globals.css` (bloco D): `botao-icone` (+ `botao-icone-compacto`, `botao-icone-perigo`), `interruptor` (classe numa caixa de marcar de verdade) e a seta das listas (`select`, vale sozinha em toda lista). `src/app/tokens.css`: curva `--ease-salto`.
- `src/app/globals.css` (bloco C): `topo-luz` (brilho e linha em degradê da barra de cima), `contador-topo` (formato único de Janelas, Retornos e Esperando) e `luz-marca-media` agora medida pela janela (usada no fundo das telas, em `src/app/(app)/layout.tsx`).
- "Selecionado": navegação = `afundado` + `menu-ativo`; abas e filtros = vidro (`Abas`); temas = anel.

## A. Base (feito)
- [x] 1. Uma linguagem de "selecionado" (navegação afundada com luz e filete; abas em vidro; temas em anel).
- [x] 2. "Luz da marca" como peça única, em três intensidades.
- [x] 3. Superfície "vidro" oficial (cartão do login e dica do menu já usam).
- [x] 4. Três tempos de movimento na curva do login.
- [x] 5. Rótulos de seção iguais (`rotulo-secao`).

## B. Barra lateral (feito)
- [x] 6. Recolhida: indicador afundado com luz e filete no lugar da pílula que saltava.
- [x] 7. Anel de onda ao chegar no ícone (400 ms, uma vez).
- [x] 8. Dica em vidro nos ícones recolhidos.
- [x] 9. Esfera dá um giro rápido na troca de tela.
- [x] 10. Celular: bolinha da barra de baixo mantida; "E" do topo virou a mini esfera.

## E. Janelas, menus e avisos (feito, falta o teste do Mateus)
- [x] 18. Fundo das janelas escuro com desfoque, o mesmo véu da gaveta (`veu` + `veu-desfoque` no `Modal`; a folha do `Popover` no celular usa o mesmo véu, sem desfoque).
- [x] 19. Janela em vidro, entrando como o cartão do login (sobe 12 px com mola, 220 ms).
- [x] 20. Menus do topo (Retornos, Janelas, Esperando, menu do usuário) em vidro, nascendo do canto do botão (160 ms). O desfoque do cabeçalho passou para uma camada atrás (`before`), senão o vidro dos menus não desfocava a tela.
- [x] 21. Aviso (toast) em vidro escuro com filete colorido à esquerda (verde = certo, vermelho = erro, âmbar = alerta). O botão do aviso ("Abrir") ficou na cor da marca nos três.
- [x] 22. Gaveta do lead: fio de luz no cabeçalho; o movimento atual ficou. O véu da gaveta não tem desfoque de propósito (uso do dia a dia).

Falta conferir em E: a sensação ao vivo da janela subindo e do menu nascendo; o aviso de alerta (cliente esperando) agora é âmbar, antes era vermelho; tudo no celular (janela vira folha de baixo).
Ficaram de fora do E (decidir com o Mateus): `Popover` no PC, dica ⓘ (`Dica`), menu do card do Kanban e a barra "alterações não salvas" de Configurações continuam sólidos, sem vidro.

## D. Botões e campos (feito, falta o teste do Mateus)
- [x] 14. "Tecla" mais fina nos secundários (2 px); 4 px só no primário. O botão vermelho (perigo) também ficou fino.
- [x] 15. Interruptor com mola no lugar das caixas de marcar de Configurações (11 na tela: dias da agenda, presença e fila, retorno com a loja fechada, recuperação, vendas, "Não é lead", instrução ativa, "Incluir fotos e plantas"). Continua sendo caixa de marcar por baixo (teclado e testes iguais).
- [x] 16. Listas de escolha com seta própria, com a aparência dos campos (todas as listas do sistema, de uma vez).
- [x] 17. Botões só de ícone iguais (fechar, lixeira, lápis, setas): 44 px, ou 32 px em lugar apertado; mesmo raio e realce; lixeira fica vermelha só com o mouse em cima.

Falta conferir em D: a sensação ao vivo da bolinha do interruptor e da tecla fina; os temas de cor (a seta das listas é cinza fixo em todos); o celular.
Ficaram de fora do D (decidir com o Mateus): caixas de **seleção** (escolher instruções para exportar, "confirmada" da medida, "entendi" do Zerar painel) continuam caixas, porque não são liga/desliga; a lista aberta continua a do navegador (só o campo fechado mudou); botões de ícone do card do Kanban, do Simulador, do visualizador de imagem, o clipe da conversa (tem borda) e o lápis do título da coluna não foram trocados.
Visto de passagem, sem mexer: em Configurações > Geral, campos com largura própria (ex.: "Quem recebe o aviso", `w-48`) aparecem na largura toda. Conferir se é de antes.

## C. Cabeçalho e fundo (feito, falta o teste do Mateus)
- [x] 11. Cabeçalho continua a luz do menu: brilho fraco à esquerda e linha de baixo em degradê (marca → transparente).
- [x] 12. Luz parada no fundo das telas, bem leve, no canto superior esquerdo, sem animação. Sobe junto com a rolagem (não fica presa na janela, para não pesar).
- [x] 13. Contadores do topo (Janelas, Retornos, Esperando) no mesmo formato: vidro, com a cor só no número e no ícone. Janelas e Esperando em vermelho quando há alguém; Retornos em âmbar quando há retorno de hoje ou atrasado, e o halo âmbar continua pulsando (o pulso será refeito no item 29).

Falta conferir em C: se a luz do fundo está leve demais ou de menos; se o "Esperando" e o "Retornos" continuam chamando atenção sem o fundo cheio (antes eram vermelho e âmbar sólidos); os temas de cor; o celular.

## F. Tela por tela (feito, falta o teste do Mateus)
- [x] 23. Painel: fio de luz no topo dos cartões e números contando (600 ms, só ao abrir). Contam os valores em reais, as quantidades e as porcentagens; os tempos de resposta ficam parados (contando, a unidade ficaria trocando de "s" para "min").
- [x] 24. Configurações: fio de luz nos cartões e troca de seção com deslize curto (160 ms).
- [x] 25. Kanban: nenhuma animação nova; fundo e cabeçalho já herdam a luz (blocos C). Card da tarefa 39 como está.
- [x] 26. Conversa, Agenda e Galeria: sem animação nova; o "hoje" da Agenda ganhou a luz da marca (`luz-marca-hoje` no cabeçalho do dia).
- [x] 27. Estado vazio com a esfera de pontos esmaecida e parada (onde não há ícone próprio: coluna vazia do Kanban e Galeria). Carregamento de tela inteira (`CarregandoTela`): mini esfera girando, só aparece se demorar; usado na ficha completa do lead.
- [x] 28. Páginas públicas (Privacidade, Exclusão de dados) com a cara do login: fundo parado, nome em caixa alta com a esfera e texto num cartão de vidro (`PaginaPublica`). Texto intocado.

Falta conferir em F: a sensação ao vivo dos números contando e do deslize das seções; os temas de cor; o celular.
Ficaram de fora do F (decidir com o Mateus): Arquivados e Simulador mantêm o ícone próprio no estado vazio (caixa e celular), sem a esfera; os esqueletos de carregamento das telas (`Carregando`) continuam; não foi criado carregamento na troca de tela (`loading.tsx`), porque a tela ficaria em branco a cada clique no menu.

## G. Retirar ou aliviar (feito, falta o teste do Mateus)
- [x] 29. Pulso do card vermelho e do botão Retornos refeito só com opacidade (`pulso-critico` e `pulso-chamar`). **Mudou a aparência do card crítico:** o halo vermelho de fora agora fica parado (mais fraco) e o que pulsa é um brilho por dentro do card; antes o halo de fora é que crescia. O botão Retornos continua com o halo âmbar de fora pulsando, sem o clarão do botão. Com "reduzir movimento" os dois ficam com brilho parado.
- [x] 30. Animação `piscar` apagada dos tokens (junto de `respirar` e `chamar`, que deram lugar aos pulsos novos).

## Pequenas sobras
- [ ] Orientação `vertical` do `Entalhe` (`src/componentes/entalhe/`) ficou sem uso depois do bloco B: decidir com o Mateus se remove.
- [ ] `quadro.tsx` (divisor do Kanban, 11 px) não recebeu o `rotulo-secao`: ficou de fora de propósito por ser menor.
