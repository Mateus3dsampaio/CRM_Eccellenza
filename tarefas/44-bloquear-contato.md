# Tarefa 44 – Bloquear contato que não é cliente

Objetivo: parar de gastar com a IA (e com transcrição de áudio) em quem clica no anúncio e manda conversa sem relação com a loja.

## Decisões do Mateus (16/11/2026)
- **Quem bloqueia:** a IA sozinha e também um botão para o vendedor.
- **Duração:** 30 dias (é o prazo em que o arquivo exclui o contato de vez).
- **A IA não responde nada** ao encerrar.
- **Exemplos reais que motivaram** (sem dados de cliente aqui): contatos que chegam pelo anúncio e mandam áudio com assunto pessoal, paquera ou fala desconexa, sem nenhuma relação com móveis.

## Etapas
- [x] 1. Banco: `Lead.bloqueadoEm` e `bloqueadoPor`; migração `0014_contato_bloqueado`.
- [x] 2. `src/servicos/bloqueio.ts`: bloquear (vai direto para o arquivo, sem Perdido; sai da espera; registro na ficha). Restaurar do arquivo desbloqueia.
- [x] 3. Mensagem nova de bloqueado: só fica guardada. Sem IA, sem transcrição de áudio, sem baixar arquivo, sem aviso, sem sair do arquivo.
- [x] 4. Ferramenta do bot `encerrar_contato` (motivo obrigatório). O turno para ali e nada é enviado, nem o texto que a IA escrever junto. Recusada para lead que já foi passado ao consultor.
- [x] 5. Telas: "Bloquear contato" no menu do card e no cabeçalho da conversa (com confirmação); selo "Bloqueado" e botão "Desbloquear" em Arquivados; aviso no cabeçalho da conversa.
- [x] 6. Painel: "Contatos bloqueados" no bloco Automação de leads (e no arquivo exportado).
- [x] 7. Contrato do bot, mapa do código e pendências.
- [ ] 8. Manual do CRM: linha da ferramenta nova, **proposta ao Mateus**. Só com a aprovação: `manual-inicial.ts`, `manual-versoes.ts` e `npm run contrato:bot`.

## Como ficou
- Bloquear usa a permissão de arquivar (vendedor e admin). Desbloquear é o "Restaurar" de sempre, com outro nome no botão.
- O bloqueio não sobrevive à exclusão: passados os 30 dias do arquivo, se o contato escrever de novo entra como lead novo. Guardar o telefone depois da exclusão iria contra a política de privacidade.
- Não zera o gasto: a IA precisa ler as primeiras mensagens para perceber. O que acaba é o gasto dali em diante, inclusive a transcrição dos áudios.

## Do Mateus
- Aprovar a linha do Manual (etapa 8).
- Pôr nas instruções numeradas o critério de quando encerrar e o que fazer na dúvida. Sem isso a IA tem a ferramenta, mas não tem regra para usar.

## Pronto quando
No simulador: o vendedor bloqueia um card, ele vai para Arquivados com o selo, uma mensagem nova do contato não acorda nada, e "Desbloquear" devolve ao kanban. Com a chave da IA e a instrução colada: um contato falando de assunto sem relação é encerrado sem resposta.
