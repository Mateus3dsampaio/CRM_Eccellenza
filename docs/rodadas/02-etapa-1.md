# Rodada 2 – Etapa 1 (31/10/2026)

## O que foi feito (correções da rodada 1)
- Rota de teste fechada (servidor só em 127.0.0.1, JSON + cabeçalho próprio). `CHAVE API.txt` no `.gitignore` (decisão do Mateus: mover a chave para o `.env` e apagar o arquivo).
- Bot: confere se o consultor assumiu antes de cada ferramenta e antes de enviar; progresso marcado por mensagem; relógio só anda para a frente; ferramentas sem resultado recebem resultado de erro; filtro de anotação interna; prompt com orientações de uso das ferramentas (ambiente x peça, medidas, motivo em observações, não repetir pergunta, dia pedido pelo cliente).
- Retomada só para card em "Novo" com o bot atendendo, sem visita marcada. Funil conta etapas puladas; visita conta uma vez por lead. Agenda: uma visita por horário na loja (PROVISÓRIO). Envio recusado não cria lead. Resumo com observações.
- Design: "⋮" sem cobrir texto, simulador sem rolagem lateral, agenda com colunas iguais, contraste AA nos textos e avatares, datas com maiúscula só no início, áreas de toque, estado vazio.
- Testes: 21 de regra, 12 de tela.

## Apontamentos dos revisores
| Revisor | Bloqueantes da rodada 1 | Novos bloqueantes |
|---|---|---|
| Código | C1, C3, C4, C5 e agenda confirmados | **F1** filtro de anotação apaga falas normais e deixa o cliente sem resposta; **F2** visita de lead arquivado continua ocupando o horário |
| Requisitos | R1, R2, R4, S1 confirmados | **F2** (mesmo); **F3** tela da agenda descreve a regra antiga ("por consultor") |
| Design | D1–D4 confirmados | **F3** (mesmo); **F4** contraste do cabeçalho verde do chat e dos avisos vermelhos |
| Cliente simulado | Nenhum bloqueante. 12 conversas: nenhuma regra comercial violada, agendamento sem conflito, retomada só para quem deve | — |

## O que vou corrigir agora
- F1: filtro só com padrões claramente internos; se o filtro apagar tudo, o lead fica "aguardando humano" com aviso.
- F2: arquivar cancela as visitas futuras do lead (com registro no histórico).
- F3: texto da agenda montado a partir da regra do código.
- F4: novo token de cabeçalho verde escuro e vermelho de alerta mais escuro.
- Sugestões rápidas: consultor que responde lead "pausado" passa a "humano"; preparo do banco de teste à prova de reformatação; README com 127.0.0.1; "+" escondido em horário com visita; reforço no prompt sobre repetir pergunta e sobre endereço; cabeçalhos do celular; toques menores que 44px; teste do funil; visita inexistente → 404; aviso do relógio explica a quem a retomada vale.

## Ficam para depois (com motivo)
- Texto padrão de confirmação de visita, medida por texto "confirmada" (conflito 11 x complemento), lead iniciado pela loja contar como "lead novo", extração de dados com o bot pausado, feriados: **decisões do Mateus**.
- Teste automático do bot com API simulada (mock), teto do histórico da API, VACUUM após exclusão, tokens de largura de contêiner, cor das barras por consultor: melhorias sem impacto nos critérios de aceite; próxima etapa.
