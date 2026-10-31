# Rodada 4 – Instruções de atendimento editáveis (rodada 1 desta funcionalidade)

Pedido do Mateus em 31/10/2026. Requisitos INST-01 a INST-06 em `docs/requisitos.md`.

## O que foi feito
- Tabela `Instrucao` no banco; carga inicial das 13 instruções de `agente/instrucoes/` quando a tabela está vazia. O bot lê do banco (`src/bot/prompt.ts`).
- Aba "Instruções de atendimento" em Configurações: criar, editar, reordenar (setas), ativar/desativar, voltar para a anterior, exportar (.zip com um .txt por instrução ou .txt único, com seleção), aviso de confirmação ao salvar, atalho "Testar no simulador".
- API só para admin (`configurar`). Zip gerado sem biblioteca externa (`src/lib/zip.ts`), validado com leitor externo.
- `CLAUDE.md`, `agente/ORIGEM.md`, `agente/complemento-crm.md` e a skill `/sincronizar-instrucoes` atualizados: as instruções deixaram de ser cópia.
- Testes: 45 passando (tipos e lint limpos).

## Revisores
| Revisor | Resultado |
|---|---|
| requisitos | Nenhum bloqueante. INST-01 a 06 e BOT-01 atendidos (401 sem login, 403 para consultor em todas as rotas). |
| código | Nenhum bloqueante. |
| design | 1 bloqueante (cartão espremido no celular). |
| cliente simulado | Nenhum bloqueante. 4 conversas: o bot atendeu como antes lendo do banco. |

## Corrigido nesta rodada
- **Bloqueante de design:** setas, Editar e Ativa foram para uma linha própria; o título passou de ~90 px para ~265 px no celular. Sem rolagem lateral.
- Renomear só o título não apaga mais a versão anterior do texto.
- Editar e "voltar" agora rodam em transação; a carga inicial usa uma execução única (sem erro com requisições simultâneas).
- Não deixa desativar a última instrução ativa (409). Desativar pede confirmação.
- Corpo que não é JSON dá 400 (antes 500).
- Atalho "Testar no simulador" aparece também depois de voltar, desativar, ativar e reordenar.
- Resumo do cartão não repete o título em caixa alta; textarea menor no celular; aviso de confirmação rola para a vista; campos travados durante a confirmação; mensagem de lista vazia.

## Deixado para depois
- Excluir instrução (hoje só desativar; evita perder texto sem histórico).
- Mostrar data/quem editou em cada cartão; importar de volta um .zip.
- Remissões por número no `complemento-crm.md` ("instrução 11") quebram se a ordem mudar. Os textos originais trazem o número no título ("11. ..."), então o número vale mesmo reordenando. Citar por título exige aprovação do Mateus.
- Datas gravadas com o relógio real, não o simulado (são registro administrativo, como a sessão).
- Data/hora dentro do zip ficam zeradas (abre normalmente).
- Limite de quantidade/tamanho total das instruções.

## PROVISÓRIO / decisão do Mateus
- Nada de política da loja foi criado. Textos novos são só de funcionamento da tela.
- Quer excluir instruções de verdade (com confirmação)? Hoje só desativa.
