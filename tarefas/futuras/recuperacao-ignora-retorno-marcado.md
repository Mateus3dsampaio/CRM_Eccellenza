# A recuperação de leads ignora o retorno marcado (a rede de segurança respeita)

## O que é
Visto ao montar o acompanhamento visual da automação (tarefa 48, 25/11/2026). Um lead com **retorno marcado para o futuro** (`proximoContatoEm`) é segurado pela **rede de segurança**: ela espera a data do retorno (`avaliarRede`). Mas a **recuperação de leads** não olha esse campo (`avaliarRecuperacao` nem recebe `proximoContatoEm`). Resultado: um lead com retorno marcado para daqui a 5 dias ainda recebe a 1ª e a 2ª mensagem automática ("Continuo por aqui...") e vai para **Perdido** poucas horas depois da última, bem antes da data do retorno.

## Por que vale olhar
O retorno marcado diz "este cliente pediu para falarmos em tal dia". Mandar mensagem de recuperação e mover para Perdido antes dessa data contraria o combinado com o cliente, e o vendedor perde o card do retorno. A tela da tarefa 48 mostra o que cada rotina fará, então o admin vai enxergar essa diferença.

## Decisões já tomadas
- Nenhuma. A tarefa 48 só mostra: **não mudou nenhuma regra**.

## Etapas
- [ ] 1. Decidir com o Mateus: lead com retorno marcado no futuro deve ficar fora da recuperação (como na rede de segurança)? Ou a recuperação é de propósito independente?
- [ ] 2. Se sim: incluir `proximoContatoEm` em `EstadoRecuperacao`/`avaliarRecuperacao` e em `rodarRecuperacao` (mesma condição da rede: retorno no futuro segura o lead), atualizar `previsaoRecuperacao` e o contrato do bot (seção 4), e os testes (`recuperacao.test.ts`, `previsao-automacao.test.ts`).

## Em aberto
- Se o retorno marcado pelo **bot com a loja fechada** (tarefa 36, `retornoModeloEm`) deve valer igual ao retorno marcado por uma pessoa.
