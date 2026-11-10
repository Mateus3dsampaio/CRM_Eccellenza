# Publicar o app da Meta (CRM Eccellenza): por onde começar

Auditoria feita em 04/11/2026. Objetivo: colocar o app em produção (modo Live) sem interromper o WhatsApp que já funciona.

**Regra de ouro:** não mexa em webhook, token, segredo do app (`META_APP_SECRET`) nem na assinatura da conta (`subscribed_apps`) durante este processo. Mexer nisso derruba o recebimento de mensagens.

## Ordem das etapas (uma por vez)

| # | Etapa | Arquivo | Quem | Estado |
|---|---|---|---|---|
| 1 | Confirmar que app e conta do WhatsApp estão na mesma empresa | `01-confirmar-portfolio.md` | Mateus | [x] 10/11/2026 |
| 2 | Aprovar os textos (exclusão de dados, privacidade) | `02-textos-para-aprovar.md` | Mateus | [x] 05/11/2026 |
| 3 | Aprovar os modelos de mensagem | `03-modelos-de-mensagem.md` | Mateus | [x] 05 e 06/11/2026 (textos em `src/regras/modelos.ts`) |
| 4 | Subir o código das páginas e dos modelos | `04-codigo.md` | Claude (com autorização do Mateus para o push) | [x] páginas no ar (conferido 08/11/2026) |
| 5 | Criar os modelos na Meta (**antes de publicar**) | `03-modelos-de-mensagem.md` | Mateus | [x] 4 aprovados em 08/11/2026; falta `retorno_atendimento` |
| 6 | Nome de exibição e pagamento | `05-nome-de-exibicao-e-pagamento.md` | Mateus | [ ] |
| 7 | Configurar o app na Meta e publicar | `06-configurar-e-publicar-app.md` | Mateus | [x] publicado (Live) em 10/11/2026 |
| 8 | Conferir depois de publicar | `06-configurar-e-publicar-app.md` (final) | Mateus + Claude | [ ] |
| 9 | Migrar o Railway para o Pro e ligar backup; Instagram | `07-depois.md` | Mateus | [ ] |

A relação completa do que foi auditado (pronto / configuração na Meta / código) está em `08-auditoria.md`.

## O que ainda não está confirmado (confira antes de agir)
- O que o modo Live muda exatamente para o WhatsApp. A documentação só diz que alguns webhooks não são enviados em modo de desenvolvimento.
- Se o painel exige o campo "URL de exclusão de dados" para um app só de WhatsApp.
- Nomes exatos dos menus da Meta (mudam com frequência). Se algo não bater, anote o que aparece na tela.
