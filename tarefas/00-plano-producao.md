# Plano: deixar o CRM pronto para uso real (fase "produção")

Base: comparação com o Twenty (só como ideia, sem copiar código — licença AGPL) e leitura do nosso código em 03/11/2026.
Regra: uma tarefa por vez, testada e validada pelo Mateus antes da próxima. Nada de push/deploy/mensagem real sem autorização dele.

## Ordem de execução (numeração dos itens 1–7 da conversa entre parênteses)
| Tarefa | Assunto | Depende do Mateus? |
|---|---|---|
| 10 | Banco Postgres (item 2) | Criar o projeto no Railway e o Postgres |
| 11 | Rotinas automáticas no servidor (item 3) | Não |
| 12 | Login seguro e usuários (item 4) | Escolher as senhas reais |
| 13 | Modo produção: sem simulador/relógio (item 5) | Não |
| 14 | Proteção do bot e custo (item 6) | Decidir os limites |
| 15 | LGPD: apagar dados e parar de receber (item 7) | Aprovar os textos para o cliente |
| 16 | WhatsApp real: webhook e envio (item 1) | Conta Meta, número, token, modelos aprovados |
| 17 | Colocar no ar (Railway) e checklist final | Variáveis, domínio, autorização do push |

WhatsApp fica por último porque sem banco estável, rotina e proteção ele não é seguro de ligar. O código dele (16) já pode ser feito e testado com mensagens de exemplo da Meta antes de a conta estar pronta.

## O que eu NÃO consigo fazer sozinho
- Criar conta/projeto no Railway e na Meta, verificar a empresa, ter número liberado, gerar token. Só você.
- Colocar segredos (`ANTHROPIC_API_KEY`, token da Meta, `DATABASE_URL`) nas variáveis do Railway.
- Testar com WhatsApp de verdade: eu valido com payloads de exemplo; o teste real é com você, no seu celular.
- Aprovar textos que o cliente final lê e valores de política (limites, retenção).
- Autorizar push e deploy.

## Situação em 03/11/2026
| Tarefa | Estado |
|---|---|
| 10 Banco Postgres | Feita: esquema Postgres gerado, migração inicial aplicada e **148 testes passando num Postgres 16**; `npm run test:postgres`. Falta só o Mateus criar o Postgres no Railway |
| 11 Rotinas no servidor | Feita e testada |
| 12 Login e usuários | Feito o mínimo (cookie Secure em https, limite de tentativas, primeiro admin por variável, seed bloqueado em produção, senha mínima 10, script para criar usuário, cabeçalhos de segurança). **Falta** a tela de usuários e "trocar minha senha" (a pedido do Mateus, depois) |
| 13 Modo produção | Feita e testada |
| 14 Proteção do bot | Feita e testada (limites PROVISÓRIOS, uso da API, `/api/saude`) |
| 15 LGPD | Feita e testada (textos PROVISÓRIOS) |
| 16 WhatsApp webhook e envio | Feita e testada com payloads de exemplo e `fetch` falso. **Nunca testada com a Meta de verdade** |
| 17 Colocar no ar | Dockerfile, `railway.json`, `.env.example` e guia prontos; sistema compilado e testado em modo produção com Postgres local. **Nunca rodou no Railway** |
