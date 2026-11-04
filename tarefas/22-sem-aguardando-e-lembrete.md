# Tarefa 22 – Sem "Aguardando consultor" e lembrete na ficha

Pedido e aprovado pelo Mateus em 04/11/2026. **Status: feito em 04/11/2026.**

## O que mudou
- **Sai a coluna "Aguardando consultor".** O bot repassa direto para "Em qualificação", já com o vendedor do rodízio. Sem consultor disponível, o lead fica na fila (sem dono) dentro de Em qualificação, com a etiqueta "Na fila – sem consultor", até alguém ficar online. "Esperando resposta" continua no topo da coluna e em vermelho.
- **Em qualificação não pede mais o próximo contato** ao receber o card. A data que importa é a da medição ou da apresentação (agenda).
- **Lembrete na ficha**, em qualquer etapa aberta: data, hora e nota opcional (ex.: "pediu para chamar daqui a 30 dias"). Aparece no card e em "Retornos de hoje" no dia, com aviso na hora. Concluir apaga; Fechado e Perdido apagam. Em Negociação o lembrete é o próximo contato (obrigatório conforme Configurações > Vendas).
- **Botão "Retornos de hoje" pulsa** quando há retorno para hoje ou atrasado.
- Funil do painel: IA atendendo → Em qualificação → Apresentação agendada → Fechado.
- Cards em "Aguardando consultor" passam sozinhos para Em qualificação ao subir o servidor.
- Banco: campo `lembreteNota` no lead (migração Postgres `0006_lembrete_nota`).
- Manual do CRM (texto inicial): "move o card para Em qualificação". Mateus precisa conferir o manual na tela, se já tiver o texto antigo.
