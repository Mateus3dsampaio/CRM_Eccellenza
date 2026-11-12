# Tarefas visuais: identidade única (a cara do login em todas as telas)

Plano aprovado pelo Mateus em 11/11/2026. **Só layout e visual: nenhuma função ou regra muda.**
Sem animação que deixe lento o uso do dia a dia; animação só onde fica legal (telas de pouco uso).

## Onde paramos (12/11/2026)
- Branch: `feat/visual-identidade` (no GitHub, **sem PR aberto**).
- Feitos: blocos **A**, **B** (aprovados pelo Mateus em 12/11/2026) e **E**.
- **Aguardando o teste do Mateus** do bloco E antes de seguir.
- Próximo bloco, na ordem recomendada: **D**, depois C e F (G junto de F).

## Como retomar
1. Ler este arquivo e a linha "Identidade visual" em `docs/mapa-do-codigo.md` (seção "Onde mexer para…").
2. Perguntar ao Mateus o resultado do teste do último bloco feito e ajustar o que ele apontar.
3. Seguir um bloco por vez, parando para ele testar. Marcar `[x]` aqui ao concluir.
4. Ao terminar tudo: abrir o PR da branch para a `main` (só com autorização).

## Peças já prontas (usar, não recriar)
- `src/app/globals.css`: `luz-marca-forte`, `luz-marca-media`, `luz-marca-fio` (luz da marca); `vidro` (só no que flutua); `rotulo-secao`; `menu-ativo`, `menu-ativo-filete`, `menu-onda`.
- `src/app/globals.css` (bloco E): `veu` e `veu-desfoque` (escuro atrás de gaveta e janela), `janela-entrar`, `menu-nascer`, `vidro-escuro` e `filete-aviso` (aviso do canto).
- `src/app/tokens.css`: `--tempo-clique` (90 ms), `--tempo-surgir` (160 ms), `--tempo-janela` (220 ms), `--tempo-painel` (280 ms), curva `--ease-mola`.
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

## D. Botões e campos
- [ ] 14. "Tecla" mais fina nos secundários (2 px); 4 px só no primário.
- [ ] 15. Interruptor com mola no lugar das caixas de marcar de Configurações (cerca de 10).
- [ ] 16. Listas de escolha com seta própria, com a aparência dos campos.
- [ ] 17. Botões só de ícone iguais (fechar, lixeira, lápis): mesmo tamanho, raio e realce.

## C. Cabeçalho e fundo
- [ ] 11. Cabeçalho continua a luz do menu: brilho fraco à esquerda e linha de baixo em degradê (marca → transparente).
- [ ] 12. Luz parada no fundo das telas, bem leve, no canto superior esquerdo, sem animação.
- [ ] 13. Contadores do topo (Janelas, Retornos, Esperando) no mesmo formato: vidro, com a cor só no número e no ícone.

## F. Tela por tela
- [ ] 23. Painel: fio de luz no topo dos cartões e números contando (600 ms, só ao abrir).
- [ ] 24. Configurações: fio de luz nos cartões e troca de seção com deslize curto (160 ms).
- [ ] 25. Kanban: nenhuma animação nova; só fundo e cabeçalho herdam a luz (card da tarefa 39 fica como está).
- [ ] 26. Conversa, Agenda e Galeria: sem animação nova; só o "hoje" da Agenda ganha a luz da marca.
- [ ] 27. Estado vazio e carregamento com os pontos (esfera esmaecida parada; mini esfera girando no carregamento de tela inteira).
- [ ] 28. Páginas públicas (Privacidade, Exclusão de dados) com a cara do login: fundo parado e nome em caixa alta. Não mexer no texto.

## G. Retirar ou aliviar (junto de F)
- [ ] 29. Refazer o pulso do card vermelho e do botão Retornos (`respirar`/`chamar`) só com opacidade.
- [ ] 30. Apagar a animação `piscar` dos tokens (nenhuma tela usa).

## Pequenas sobras
- [ ] Orientação `vertical` do `Entalhe` (`src/componentes/entalhe/`) ficou sem uso depois do bloco B: decidir com o Mateus se remove.
- [ ] `quadro.tsx` (divisor do Kanban, 11 px) não recebeu o `rotulo-secao`: ficou de fora de propósito por ser menor.
