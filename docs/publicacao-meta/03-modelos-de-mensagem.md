# Etapa 3 e 5: modelos de mensagem (templates)

Fora da janela de 24 horas, só dá para falar com o cliente por modelo aprovado pela Meta. Quando o cliente responde, abre a janela de 24 horas e o bot ou o consultor conversa livremente. Por isso os modelos terminam em pergunta fácil, com botão de resposta rápida (um toque já conta como resposta).

## Cuidados
- A Meta exige permissão (opt-in) para falar com o cliente. Muita denúncia ou bloqueio derruba a qualidade do número e pode limitar o envio. Decisão já tomada: quem escreveu primeiro para a loja conta como permissão.
- Sem preço, prazo nem promoção nos textos (não inventamos política da loja).
- A Meta pode reclassificar um modelo de "Utilidade" como "Marketing" automaticamente. Isso muda o preço por mensagem. Veja a tabela de preços em reais na página oficial da Meta.
- Editar um modelo aprovado tem limite de vezes por mês. Aprove os textos antes de criar.

## Textos propostos (para aprovar)

### 1. `retomada` — categoria Marketing
> Oi! Aqui é da Eccellenza. Conversamos sobre o seu projeto de móveis planejados e queremos continuar te ajudando. Você ainda tem interesse?

Rodapé: `Responda PARAR para não receber mais mensagens.`
Botões (resposta rápida): **Sim, quero continuar** · **Agora não** · **Parar**

### 2. `primeiro_contato` — categoria Marketing
> Olá! Aqui é da Eccellenza, loja de móveis planejados Italínea em Juazeiro do Norte. Podemos te ajudar a planejar seus ambientes? Por qual ambiente você quer começar?

Rodapé: `Responda PARAR para não receber mais mensagens.`
Botões: **Cozinha** · **Quarto ou closet** · **Outro ambiente**

### 3. `lembrete_visita` — categoria Utilidade (a Meta pode reclassificar)
> Olá! Aqui é da Eccellenza. Passando para lembrar da sua visita à nossa loja. Você consegue vir?

Rodapé: `Responda PARAR para não receber mais mensagens.`
Botões: **Sim, estarei lá** · **Preciso remarcar** · **Parar**

Limitação: o modelo 3 não traz data nem horário, porque o código atual não usa variáveis. Um lembrete com data e hora seria muito melhor; exige alteração pequena no código (peça ao Claude).

Aprovo? [ ] 1 [ ] 2 [ ] 3 — Ajustes pedidos:

## Como criar na Meta (depois de aprovar os textos e do Claude ter subido o código, etapa 4)
1. business.facebook.com → **WhatsApp Manager → Ferramentas da conta → Modelos de mensagem → Criar modelo**.
2. Categoria conforme acima. Nome em minúsculas, exatamente `retomada`, `primeiro_contato`, `lembrete_visita`. Idioma: **Português (BR)**.
3. Corpo, rodapé e botões de resposta rápida. Enviar para análise.
4. A análise costuma levar até 24 horas. Status deve ficar **Aprovado**. Se recusarem, dá para reenviar mudando categoria ou texto.
5. O nome tem de ser idêntico ao do código (`src/regras/modelos.ts`).

## Incertezas
- Não tenho certeza de que o envio de modelo com botões funciona com o código atual sem ajuste (botão de resposta rápida costuma dispensar dados extras). O Claude testa no primeiro envio.
- A resposta pelo botão chega como mensagem do tipo "button", que o sistema já sabe ler. O botão "Parar" chega como "Parar" e o pedido de parar é reconhecido.
