# Tarefa 5 – Base do acompanhamento de vendas

Itens 13, 15 e 16 (dados e regras; sem tela nova).

- `Lead` ganha `proximoContatoEm`, `valorOrcamento` e `valorFechado` (centavos, inteiro), `motivoPerda` e `concorrente`.
- Regras puras em `src/regras/vendas.ts`: motivos de perda, dinheiro (R$ 1.621,00 e o contrário), o que cada etapa exige.
- `moverEtapa` recusa no servidor: Orçamento/Negociação sem próximo contato; Fechado sem valor fechado; Perdido sem motivo (concorrente exige o nome).
- Ao sair de Orçamento/Negociação para Fechado ou Perdido ou etapas anteriores, o próximo contato é limpo. Sair de Perdido limpa o motivo; sair de Fechado limpa o valor fechado.
- Rota de mover aceita os dados; rota da ficha aceita editar data e valores.

Pronto quando: `npm test`, `npm run tipos` e `npm run lint` passam; mapa atualizado.
