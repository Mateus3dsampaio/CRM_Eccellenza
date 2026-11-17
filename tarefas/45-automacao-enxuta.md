# Tarefa 45 – Automação de leads enxuta (caminho único)

Objetivo: trocar o conjunto de regras das tarefas 40 a 44 por um caminho único e simples, sem regra pela metade entre o CRM e as instruções.

## Decisões do Mateus (17/11/2026)
- **Divisão:** o CRM cuida do tempo e de mover os cards; as instruções cuidam só do que o bot fala e de como ele classifica (regra registrada no `CLAUDE.md`).
- **Caminho único:**
  1. Lead parado com a IA: mensagens de recuperação (já existia e está ligada).
  2. Continua sem responder: Perdido. Rede de segurança: parado 5 dias com a IA, sem mensagem do cliente, vai para Perdido (pós-venda vai para o arquivo).
  3. Perdido: 7 dias (movido pelo sistema) ou 60 dias (marcado pelo vendedor) e vai para o arquivo.
  4. Arquivo: 30 dias e é excluído (já existia).
  5. Não é cliente (conversa sem relação com móveis): a IA bloqueia e arquiva na hora, sem responder. Não conta como lead perdido.
- **Perdido** é lead possível que se perdeu. Contato sem relação com a loja não é lead e nunca vai para Perdido.
- **Lead que já passou por um consultor nunca mais recebe mensagem automática** nem é movido pelas rotinas, mesmo devolvido ao bot. Quem decide é o vendedor.
- **A IA encerra já na primeira mensagem claramente sem relação; na dúvida segue mais um pouco e encerra assim que tiver certeza.**
- Linha do Manual do CRM sobre `encerrar_contato` aprovada.

## Etapas
- [x] 1. Sai a regra de outra cidade / curioso / sem perfil (tarefa 40) e a linha "sem perfil" do Manual.
- [x] 2. Sai a retomada antiga (modelo após 3 dias); o modelo `retomada` continua disponível para o vendedor enviar à mão.
- [x] 3. Trava "passou por um consultor" na recuperação e na rede de segurança (`src/servicos/passou-por-humano.ts`).
- [x] 4. Linha do `encerrar_contato` no Manual do CRM; contrato do bot gerado de novo.
- [x] 5. Tela Configurações > Automação de leads só com a rede de segurança e o arquivar perdidos (o bloqueio não tem ajuste).
- [x] 6. Mapa do código, requisitos (RET-01 a RET-03), pendências e `CLAUDE.md`.
- [ ] 7. Mateus: colar a instrução nova (contato que não é cliente), conferir no simulador, trocar no Railway o branch conectado e ligar os dois blocos em Configurações > Automação de leads, olhando antes quantos cards cada um pega.

## Se em produção algum bloco da tarefa 40 tiver sido ligado
A chave `desclassificados` fica no banco e é ignorada. Leads que ela tenha movido continuam em Perdido e seguem o arquivamento normal. Os motivos "Outra cidade (automático)" e "Curioso / sem perfil (automático)" continuam na lista de Configurações > Vendas, se tiverem sido criados; dá para desativar.
