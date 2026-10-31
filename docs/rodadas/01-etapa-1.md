# Rodada 1 – Etapa 1 (31/10/2026)

## O que foi feito
Construção do sistema inteiro do zero:
- **Base:** Next.js 16 + TypeScript, SQLite com Prisma 6, Tailwind 4 (tokens em `src/app/tokens.css`), dnd-kit, Framer Motion, SDK da Anthropic, Playwright (navegador instalado dentro do projeto).
- **Bot:** prompt montado a cada resposta a partir de `agente/instrucoes/*.txt` + `agente/loja.md` + `agente/complemento-crm.md`; modelo `claude-sonnet-5-5`; 7 ferramentas com validação (zod); fallback do servidor ligado; cache de prompt; histórico que só cresce; erro da API marca "aguardando humano".
- **Telas:** login, kanban (8 colunas, cards ricos, filtros, busca, arrastar no computador e toque longo no celular, menu "Mover para...", seleção múltipla, limpar coluna), ficha (resumo copiável, edição, medidas, visita, notas, histórico), simulador do cliente (texto, imagem, áudio transcrito) com relógio simulado, nova mensagem (24h e modelos), agenda (dia/semana, bloqueios, remarcar, cancelar), painel (semana/mês, funil) e arquivados.
- **Regras:** retomada, "Sem resposta", exclusão em 30 dias, permissões no servidor, contadores anônimos.
- **Testes:** 20 testes de regra (`npm test`) e 12 de tela em 1440px e 375px (`npm run test:tela`).

## Apontamentos dos revisores

### Revisor de código
| # | Tipo | Apontamento | Decisão |
|---|---|---|---|
| C1 | Bloqueante | `/api/teste` acessível por outro computador da rede e por outros sites (CSRF) | Corrigir: servidor só em 127.0.0.1, exige JSON e cabeçalho próprio |
| C2 | Bloqueante | Arquivo `CHAVE API.txt` na raiz | **Decisão do Mateus**: não abro nem apago. Coloquei no `.gitignore`. Ele deve mover a chave para o `.env` e apagar o arquivo |
| C3 | Bloqueante | Bot e consultor respondendo ao mesmo tempo | Corrigir: o bot confere o modo antes de cada ferramenta e antes de enviar |
| C4 | Bloqueante | "Voltar ao horário real" fazia o bot ignorar mensagens | Corrigir: progresso do bot marcado por mensagem; botão de voltar o relógio removido (para recomeçar, `npm run seed`) |
| C5 | Bloqueante | Resposta cortada no meio de ferramenta estragava o histórico | Corrigir: toda ferramenta sem resultado recebe resultado de erro |
| C6–C13 | Sugestões | Textos perdidos em falha, histórico sem teto, tempo limite longo, VACUUM, transações, IDs inválidos, testes de rota, duplicações | Rápidas: tempo limite menor, duplicações, IDs inválidos. Demais ficam para a próxima rodada |

### Revisor de requisitos
| # | Tipo | Apontamento | Decisão |
|---|---|---|---|
| R1 | Bloqueante | Retomada ia para lead com visita marcada ou já passado ao consultor | Corrigir: retomada só quando o bot está atendendo, o card está em "Novo" e o cliente deve resposta |
| R2 | Bloqueante | Funil pulava "Pronto" e remarcação contava visita nova | Corrigir: etapas puladas contam no funil; visita conta uma vez por lead |
| R3 | Bloqueante | Bot mudo depois de passar o lead (conflito com instrução 01 não listado) | **Decisão do Mateus** (ver abaixo) |
| R4 | Bloqueante | "Uma visita por horário" virou "por consultor" | Corrigir seguindo o complemento: **uma visita por horário na loja** (PROVISÓRIO, constante única) |
| R5 | Bloqueante | `CHAVE API.txt` | Igual a C2 |
| S1–S8 | Sugestões | Lead vazio criado em envio recusado; feriados; distribuição de leads; visita passada; resumo sem observações; consultor sem "arquivar coluna"; agenda de colegas; ideias para o consultor | Rápidas: S1, S5, S6. Feriados, distribuição e permissão de agenda dependem do Mateus |

### Revisor de design
| # | Tipo | Apontamento | Decisão |
|---|---|---|---|
| D1 | Bloqueante | Botão "⋮" por cima dos metadados do card | Corrigir |
| D2 | Bloqueante | Simulador com rolagem lateral no celular | Corrigir |
| D3 | Bloqueante | Colunas desiguais na agenda semanal | Corrigir |
| D4 | Bloqueante | Texto fraco abaixo do contraste AA | Corrigir token |
| Sugestões | | Maiúsculas nas datas, moeda no card, toque < 44px, contraste dos avatares, quebras de linha, estados | Rápidas: datas, toque, avatares, quebras, estado vazio, carregando no simulador. Moeda: o campo guarda a fala do cliente; fica para a etapa 2 |

### Cliente simulado (20 conversas, todas responderam)
Passaram nas regras comerciais: nenhum preço fora da regra, nenhum desconto, nenhum prazo garantido, nenhuma agenda em conflito, nenhuma segunda retomada.
| # | Tipo | Apontamento | Decisão |
|---|---|---|---|
| CS1 | Bloqueante | Bot mandou ao cliente uma anotação interna ("Segunda insistência: oferecer o caminho.") | Corrigir: regra no prompt + filtro antes de enviar |
| CS2 | Bloqueante | Retomada para leads passados ao consultor | Igual a R1 |
| CS3 | Bloqueante | Dados ditos não foram para a ficha (arquiteta "casa toda"; medida por texto só em observações) | Corrigir no prompt (orientação de uso das ferramentas, sem mudar instrução da loja) |
| Sugestões | | Repetição de pergunta (3 de 20), faixa para "só portas", endereço sem saudação, horário pedido fora das 6 vagas, 2º silêncio, pausa x instrução 01, peça gravada como ambiente | Corrigir: horário pedido (ferramenta aceita dia específico), peça x ambiente, motivo em observações. Faixa para "só portas" e 2º silêncio: decisão do Mateus |

## Decisões que dependem do Mateus
1. **Bot depois de passar o lead (R3):** hoje ele pausa (complemento). A instrução 01 manda responder uma vez ao "ok" e sempre a perguntas novas. Opções: (a) manter a pausa e listar o conflito no complemento; (b) bot continua respondendo dúvidas das instruções 08–13 e o único "ok", e só pausa quando um consultor clica em "Assumir".
2. **Arquivo `CHAVE API.txt`:** mover a chave para o `.env` e apagar o arquivo (e gerar outra chave se ele já foi compartilhado).
3. **Agenda:** quantas visitas ao mesmo tempo a loja comporta; feriados e dias fechados; como distribuir leads entre consultores; consultor pode mexer na agenda do colega?
4. **Faixa de valor para "só portas/frentes"** e o que fazer no 2º silêncio depois da retomada.

## Dados
O relógio simulado foi avançado durante a revisão (+73 h e +96 h). Para recomeçar: `npm run seed`.
