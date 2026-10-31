# Cenários de teste

Use com `/simular`. Para cada cenário: mensagens do cliente e o comportamento esperado do agente.
Lembrete: o agente real roda em outro modelo. Repita os cenários críticos no WhatsApp.

## 1. Lead quente – só cozinha
Cliente: "Oi, quero fazer minha cozinha" → Juazeiro → tem planta → apartamento pronto, mudança em 2 meses.
Esperado: roteiro na ordem (ambientes → cidade → projeto → situação), faixa de cozinha, pergunta se está dentro do planejado, encaminha ao consultor, convida para a loja (instrução 05).

## 2. Pede preço logo de cara
Cliente: "Quanto custa uma cozinha?"
Esperado: NÃO dá valor de imediato; explica que é personalizado; segue o roteiro; só dá a faixa ao final se for só cozinha.

## 3. Mais de um ambiente
Cliente: "Quero cozinha e quarto de casal" → Crato.
Esperado: nenhum valor em nenhum momento; frase de encaminhamento para estimativa do consultor.

## 4. Cidade fora da região
Cliente: "Quero cozinha, é em Iguatu."
Esperado: interrompe o roteiro e passa direto ao consultor (instrução 06).

## 5. Arquiteto
Cliente: "Sou arquiteta, tenho um cliente que quer fechar a casa toda."
Esperado: direto ao consultor, sem roteiro.

## 6. Acha caro
Cliente (só cozinha): "Nossa, R$ 10 mil é muito, eu tinha uns 5 mil."
Esperado: instrução 04 – não encerra seco, fala de ajustar/etapas, registra o valor, não insiste na visita.

## 7. Alvenaria + só portas
Cliente: "Se eu fizer a pia de alvenaria, vocês fazem só as portas?"
Esperado: instrução 11 – não confirma nem nega; diz que o consultor avalia; continua o roteiro; repassa o pedido literal.

## 8. Quer orçamento pelo WhatsApp
Cliente: "Não tenho tempo de ir aí, manda o orçamento por aqui."
Esperado: instrução 12 – explica a apresentação presencial; se insistir, consultor entra em contato. Nunca promete enviar PDF.

## 9. Juros
Cliente: "O boleto em 36x tem juros?"
Esperado: instrução 09 – "As condições variam conforme o prazo e o valor, e temos algumas opções sem juros..." Não responde "sim" isolado, não diz que o 36x tem ou não tem juros, não associa "sem juros" ao boleto.

## 10. Prazo
Cliente: "Em quanto tempo fica pronto? Me mudo dia 10."
Esperado: instrução 10 – 45 dias após aprovação final; montagem depois; registra a data-limite; não promete.

## 11. Cliente pós-venda
Cliente: "Comprei com vocês, quando vem a montagem?"
Esperado: direto ao consultor (instrução 06c).

## 12. Cliente de outra cidade com fotos (caso Bodocó)
Cliente: "Área de lazer, é em Bodocó" + envia fotos de referência.
Esperado: instrução 06b – direto ao consultor logo após a cidade; não elogia/descreve fotos, não diz "fazemos igual", não pede e-mail, não repete garantia/prazo/endereço. Ver casos/2026-10-22-area-lazer-bodoco-como-nao-fazer.

## 13. Pede desconto à vista
Cliente: "Tem desconto pra pagamento à vista?"
Esperado: não oferece nem confirma desconto; diz que o consultor apresenta as condições junto com o orçamento.

## 14. Só quer preço de peça avulsa (caso armário 2,5 m)
Cliente: "Armário aéreo com 3 partes e um embaixo. Qual o preço?" e depois insiste "quero só o preço".
Esperado: confirma o ambiente; não informa valor (peça avulsa); não repete a explicação; na 2ª insistência oferece o consultor com as medidas; nome só na saudação; uma pergunta por mensagem.

## 15. Pede endereço e ponto de referência
Cliente: "Passa o endereço?" e depois "Ponto de referência?"
Esperado: instrução 13 – endereço completo, depois ponto de referência (São Luiz da Lagoa Seca / posto Caboclo); convida uma vez para a visita; não inventa dados.

## 16. Primeira mensagem vinda do anúncio
Cliente: "Olá! Tenho interesse e queria mais informações, por favor."
Esperado: saudação + pergunta do ambiente, nada mais. Não cita promoção, 36x, 90 dias, projeto sem custo nem garantia. Se o cliente perguntar pagamento ou garantia, aí responde.

## 17. Respostas picadas e vagas (caso Fran, closet)
Cliente responde em partes, uma como resposta citada atrasada: "Por enquanto queria ver o closet", "Ai depois vejo os outros", "Juazeiro do Norte", "Estava olhando", "Mais ou menos", "Estou reformando", "3 semanas no máximo termina", depois "Ok", "Ta bom", "Obrigada".
Esperado: sempre em português; não repete cidade nem "para quando"; esclarece "estava olhando"/"mais ou menos" uma vez; não repete a data; pede medidas uma vez; nome só na saudação; sem "Perfeito/Ótimo"; após o aceite da visita responde uma vez a "ok" e depois não responde. Ver casos/2026-10-29-espanhol-e-perguntas-repetidas.

## 18. Cliente que já foi atendido
Cliente: "Oi, já fui aí na loja semana passada e falei com o consultor. E o meu orçamento?"
Esperado: instrução 06d – não inicia o roteiro (não pergunta o ambiente); diz que vai passar para um consultor, que fala com o cliente em seguida.

## 19. Recusa a visita (caso Manu, roupeiro)
Cliente: "Quarto- roupeiro" → Juazeiro do Norte → manda 2 imagens (projeto com medidas e imagem 3D) → "Pronto" → "Sem urgência" → "Ok" → convite → "Não precisa" → "Ok".
Esperado: sem valor (não é cozinha); não pede medidas; frase da foto da instrução 11; encaminhamento com a frase da 03 para quem não quer somente cozinha; "sem custo" só no convite; diante de "Não precisa", responde só "Certo! Já passei seu projeto ao nosso consultor, e ele vai falar com você por aqui." (instrução 05), sem insistir; não responde ao "Ok" final. Ver casos/2026-10-28-roupeiro-recusou-visita.
