# Tarefa 36 – Retorno do lead que chega com a loja fechada (janela de 24h)

Decidida com o Mateus em 06/11/2026. **Status: a fazer.** Depende da **tarefa 35** (presença e fila).

## Problema
Lead que chega com a loja fechada (ex.: sábado 15h) tem a janela de 24h da Meta fechada antes de a loja abrir (segunda 8h). Depois disso só sai modelo aprovado. Vale para fim de semana e para noites de dia de semana (18h às 8h).

## Regras decididas
1. **O bot passa a saber data, hora e se a loja está aberta.** Hoje o prompt (`src/bot/prompt.ts`) não leva isso. Incluir na abertura fixa algo como: "agora: sábado 06/11 15:20; loja fechada; reabre segunda 08:00" (horário da agenda).
2. **Com a loja fechada, o bot**: qualifica normalmente, avisa quando a loja reabre, pergunta o melhor horário para o consultor chamar e grava com a ferramenta nova **`registrar_retorno`**.
   - Grava `proximoContatoEm` (retorno, já aparece no card e avisa o vendedor) e `lembreteNota` com o que o cliente disse (ex.: "Cliente pediu contato segunda de manhã – chegou com a loja fechada").
   - O sistema valida: horário com a loja fechada ou no passado → usa a reabertura e guarda só a nota. Não sobrescreve retorno já marcado por um humano.
   - "Perguntar o melhor horário" é regra do bot: vai nas **instruções numeradas do Mateus**, não no código nem na tela de configurações.
3. **No horário do retorno, se a janela de 24h estiver fechada, o modelo sai automaticamente** — mas só se o lead tiver dono **online**:
   - lead sem dono online → passa para quem está online e o modelo sai em seguida;
   - ninguém online → o modelo espera e todos recebem aviso.
   - Cliente que pediu para parar (`naoReceberEm`) nunca recebe.
4. **Sem horário escolhido pelo cliente**: o modelo sai X min depois da abertura (padrão 30, depois da repartição e da verificação da tarefa 35).
5. **Modelo novo com botões** (aprovado pelo Mateus em 06/11/2026), código `retorno_atendimento`:
   > Olá! Aqui é da Eccellenza Móveis Planejados. Recebemos seu contato fora do nosso horário e agora já podemos continuar o atendimento do seu projeto. Podemos seguir?
   > Responda PARAR para não receber mais mensagens.
   >
   > Botões de resposta rápida: **[Quero continuar]** **[Não tenho interesse]**
   - "Quero continuar" reabre a janela de 24h (é resposta do cliente).
   - "Não tenho interesse" = pedido para parar (mesmo efeito do PARAR, `regras/optout.ts`).
   - Hoje `regras/modelos.ts` só tem texto: acrescentar suporte a botões no envio (`servicos/whatsapp.ts`) e entender o toque no botão no webhook (mensagem tipo `button`/`interactive`).

## Configurações (cartão "Retorno com a loja fechada", só admin)
| Opção | Tipo | Padrão |
|---|---|---|
| Enviar o modelo de retorno automaticamente | liga/desliga | ligado (desligado = vendedor recebe aviso e clica para enviar) |
| Qual modelo usar | escolha entre os modelos cadastrados | `retorno_atendimento` |
| Sem horário escolhido pelo cliente, enviar | minutos depois da abertura | 30 |

**Fixo, sem opção na tela** (decisão 06/11/2026): horário da loja (vem da agenda), texto do modelo (a Meta exige o texto aprovado), "só envia com dono online" (proteção).

## Etapas
1. [ ] Data/hora e situação da loja no prompt do bot (reaproveitar a regra de loja aberta/fechada da tarefa 35).
2. [ ] Ferramenta `registrar_retorno` em `src/bot/ferramentas.ts` + executor + validação. Testes.
3. [ ] **Propor ao Mateus** o parágrafo do Manual do CRM sobre `registrar_retorno` e aplicar só depois da aprovação.
4. [ ] Modelo com botões: `regras/modelos.ts`, envio em `servicos/whatsapp.ts`, recebimento do toque no webhook, "Não tenho interesse" como opt-out.
5. [ ] Rotina do retorno automático (janela fechada + dono online + consentimento + sem opt-out), com as regras do item 3.
6. [ ] Cartão "Retorno com a loja fechada" nas Configurações.
7. [ ] Simulador: botões do modelo clicáveis na tela do cliente simulado; testar sábado 15h → segunda.
8. [ ] Atualizar `docs/mapa-do-codigo.md`, `docs/pendencias.md` (incluir "cadastrar o modelo na Meta" como pendência do Mateus).
9. [ ] Testes (`npm run tipos`, `npm run lint`, `npm test`) e conversa de teste com o `cliente-simulado`.

## O que fica com o Mateus
- Incluir nas **instruções numeradas** (repositório dele): "com a loja fechada, avise quando reabre e pergunte o melhor horário para o consultor chamar".
- Aprovar o texto do Manual do CRM (etapa 3).
- **Cadastrar o modelo na Meta** com os dois botões, com o mesmo código e texto. Incerto: a Meta pode classificar como "utilidade" ou "marketing" (só muda o preço, centavos).

## Pronto quando
Lead de sábado 15h, no simulador: bot pergunta o horário, retorno aparece para o vendedor, na segunda o modelo sai sozinho no horário (só com dono online), o toque em "Quero continuar" reabre a conversa e "Não tenho interesse" registra o pedido para parar.
