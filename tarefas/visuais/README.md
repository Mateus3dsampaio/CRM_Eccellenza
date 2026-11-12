# Tarefas visuais: identidade única (a cara do login em todas as telas)

Plano aprovado pelo Mateus em 11/11/2026. **Só layout e visual: nenhuma função ou regra muda.**
Sem animação que deixe lento o uso do dia a dia; animação só onde fica legal (telas de pouco uso).

## Onde paramos (12/11/2026)
- Branch: `feat/visual-identidade` (no GitHub, **sem PR aberto**). Commit `51bad06`.
- Feitos: blocos **A** e **B**.
- **Aguardando o teste do Mateus** dos blocos A e B antes de seguir.
- Próximo bloco, na ordem recomendada: **E**, depois D, C e F (G junto de F).

## Como retomar
1. Ler este arquivo e a linha "Identidade visual" em `docs/mapa-do-codigo.md` (seção "Onde mexer para…").
2. Perguntar ao Mateus o resultado do teste de A e B e ajustar o que ele apontar.
3. Seguir um bloco por vez, parando para ele testar. Marcar `[x]` aqui ao concluir.
4. Ao terminar tudo: abrir o PR da branch para a `main` (só com autorização).

## Peças já prontas (usar, não recriar)
- `src/app/globals.css`: `luz-marca-forte`, `luz-marca-media`, `luz-marca-fio` (luz da marca); `vidro` (só no que flutua); `rotulo-secao`; `menu-ativo`, `menu-ativo-filete`, `menu-onda`.
- `src/app/tokens.css`: `--tempo-clique` (90 ms), `--tempo-surgir` (160 ms), `--tempo-painel` (280 ms), curva `--ease-mola`.
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

Falta conferir em A e B: a sensação do movimento ao vivo (mola, onda, giro) e a esfera no topo do celular.

## E. Janelas, menus e avisos (próximo)
- [ ] 18. Fundo das janelas escuro com desfoque, o mesmo véu da gaveta (hoje é claro, leitoso).
- [ ] 19. Janela em vidro, entrando como o cartão do login (sobe 12 px com mola, 220 ms).
- [ ] 20. Menus do topo (Retornos, Janelas, Esperando, menu do usuário) em vidro, nascendo do canto do botão (160 ms).
- [ ] 21. Aviso (toast) em vidro escuro com filete colorido à esquerda (verde, vermelho, âmbar). Fica em `src/componentes/dados.tsx`.
- [ ] 22. Gaveta do lead: só a luz no topo; o movimento atual fica. Fica em `src/componentes/ficha/gaveta.tsx`.

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
