# Etapa 3 e 5: modelos de mensagem (templates)

Fora da janela de 24 horas, só dá para falar com o cliente por modelo aprovado pela Meta. Quando o cliente responde, abre a janela de 24 horas e o bot ou o consultor conversa livremente.

## Cuidados
- A Meta exige permissão (opt-in) para falar com o cliente. Muita denúncia ou bloqueio derruba a qualidade do número e pode limitar o envio. Decisão já tomada: quem escreveu primeiro para a loja conta como permissão. O primeiro contato só para quem mostrou interesse (pediu orçamento, deixou o número, indicação que aceitou).
- Sem preço, prazo nem promoção nos textos (não inventamos política da loja).
- A Meta pode reclassificar um modelo de "Utilidade" como "Marketing" automaticamente. Isso muda o preço por mensagem.
- Editar um modelo aprovado tem limite de vezes por mês. Mudou o texto na Meta → o código (`src/regras/modelos.ts`) tem de mudar igual, e vice-versa.

## Modelos (fonte: `src/regras/modelos.ts`)
O nome na Meta é o código no CRM. Texto inteiro no **Corpo** (sem rodapé). Botões de resposta rápida exatamente como abaixo. Qualquer botão "Não tenho interesse" (com ou sem ponto) vale como PARAR.

| Nome na Meta | Categoria | Variáveis | Botões | Estado |
|---|---|---|---|---|
| `retomada` | Marketing | — | Quero continuar! · Não tenho interesse | Aprovado 08/11/2026 |
| `primeiro_contato` | Marketing | — | Sim, tenho interesse! · Não tenho interesse. | Aprovado 08/11/2026 |
| `lembrete_medicao` | Utilidade | `{{data}}` `{{hora}}` | Sim, pode vir · Preciso remarcar | Aprovado 08/11/2026 |
| `lembrete_apresentacao` | Utilidade | `{{data}}` `{{hora}}` | Ok, pode confirmar! · Preciso remarcar | Aprovado 08/11/2026 |
| `retorno_atendimento` | Utilidade ou Marketing | — | Quero continuar · Não tenho interesse | **Falta criar** |

### Textos
- **retomada:** Oi! Aqui é da Eccellenza. Nossa conversa sobre o seu projeto de móveis planejados ficou parada. Podemos seguir? Responda PARAR para não receber mais mensagens.
- **primeiro_contato:** Olá! Aqui é da Eccellenza, loja de móveis planejados Italínea em Juazeiro do Norte. Vimos que você tem interesse em fazer seu projeto. Gostaria de fazer seu orçamento conosco? Responda PARAR para não receber mais mensagens.
- **lembrete_medicao:** Olá! Passando para lembrar da medição dos móveis planejados, marcada para {{data}} às {{hora}}. Podemos confirmar? Responda PARAR para não receber mais mensagens.
- **lembrete_apresentacao:** Olá! Estou passando para confirmar a apresentação do seu projeto aqui na Eccellenza, agendada para {{data}} às {{hora}}. Posso confirmar? Responda PARAR para não receber mais mensagens.
- **retorno_atendimento:** Olá! Aqui é da Eccellenza Móveis Planejados. Recebemos seu contato fora do nosso horário e agora já podemos continuar o atendimento do seu projeto. Podemos seguir? Responda PARAR para não receber mais mensagens.

## Como o CRM usa
- **Lembretes:** o consultor escolhe o modelo na conversa do cliente. A data ("terça, 12/11") e a hora ("15h" ou "15h30") saem do próximo compromisso daquele tipo marcado na agenda; a prévia já mostra o texto preenchido. Sem compromisso marcado, o CRM não deixa enviar. Não aparecem em "Nova mensagem" (número novo) nem no retorno automático.
- **retomada:** sai sozinha (rotina de retomada) e também pode ser enviada pelo consultor.
- **retorno_atendimento:** sai sozinho no horário do retorno com a loja fechada.
- Período de validade dos lembretes na Meta: 12 horas (o padrão de 10 minutos perde o lembrete se o celular do cliente estiver desligado).

## Como criar um modelo novo na Meta
1. business.facebook.com → **WhatsApp Manager → Modelos de mensagem → Criar modelo**.
2. Nome em minúsculas, idioma **Português (BR)**, tipo de variável **Nome** (variáveis com nome, ex.: `{{data}}`, e exemplo preenchido).
3. Corpo, botões de resposta rápida. Enviar para análise (até 24 h).
4. Antes de usar: pedir ao Claude para incluir no CRM com o mesmo nome, texto e botões. Recusado: anote o motivo e fale com o Claude antes de mudar o texto.

## Incertezas
- O envio real de modelo (e as variáveis nomeadas dos lembretes) ainda não foi testado com a Meta. Testar mandando para o próprio número.
