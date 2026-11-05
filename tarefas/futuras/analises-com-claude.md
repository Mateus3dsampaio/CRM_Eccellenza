# Tópico: Análises da equipe de vendas com o Claude

**Estado:** ideia aprovada pelo Mateus em 05/11/2026. Nenhuma etapa feita. Sem urgência.

## Objetivo
Dar ao Mateus, como gestor, relatórios pontuais (só quando ele pedir) que mostrem onde a equipe de vendas erra e o que funciona, para **treinar os vendedores com casos reais**. Não é automático e não roda sozinho.

## Decisão de desenho (05/11/2026)
- **A análise NÃO roda dentro do CRM e NÃO usa a API do Claude.** O CRM só **exporta os dados**. A análise é feita no **Claude Code, na assinatura do Mateus**, num projeto separado, fora do CRM. Motivos: menos código no CRM, custo menor para uso pontual e instrução fácil de evoluir.
- **A instrução de cada análise mora só no projeto de análise**, nunca no CRM, para não existirem duas cópias que divergem. O zip do CRM leva apenas a identificação da análise (ex.: `autopsia-perdidos`), o período, os filtros e a data da extração.
- **Um zip separado por tipo de análise.** O Mateus marca uma ou várias análises e o CRM gera um zip para cada.
- Reaproveitar a exportação de desempenho que já existe (`src/servicos/exportacao.ts`, `src/regras/exportacao.ts`, botão "Exportar" do Painel), em vez de criar sistema novo.
- Volume informado: cerca de 200 leads por mês, 6 a 10 por dia, e muitos nem respondem. É pouco para o Claude Code.

## As análises escolhidas
1. **Autópsia dos perdidos:** o consultor conduziu bem? O cliente estava mesmo perdido ou a abordagem foi errada? Comparar o motivo marcado com o que a conversa mostra. Saída: lista por lead com veredito curto e o trecho que justifica.
2. **Fechados × perdidos:** o que os vendedores fazem nas vendas fechadas e não fazem nas perdidas (perguntas, momento de pedir medidas e de falar de preço, convite à loja). Base para roteiro de treino.
3. **Onde o lead trava no funil e por quê:** a contagem mostra a etapa; o Claude lê as conversas daquela etapa e diz o que acontece.
4. **Qualidade do follow-up depois do orçamento:** quantas vezes, em quanto tempo e se a mensagem ajuda o cliente a decidir ou é só "viu o orçamento?".
5. **Objeções reais:** lista das mais frequentes e como cada vendedor responde, com o que funcionou.

Ficaram para depois (sem decisão): qualidade da passagem bot → consultor, perfil do lead que fecha, comparação entre vendedores, origem dos leads (anúncios) e auditoria do bot.

## O que cada zip precisa levar
- Conversa completa, com quem falou (cliente, bot, consultor) e a hora de cada mensagem.
- Etapas por onde o lead passou e quando (`MudancaEtapa`).
- Valor do orçamento e valor fechado, motivo da perda e concorrente.
- Compromissos marcados (`Visita`), retornos (`proximoContatoEm`) e notas internas.
- **O id do lead**, para o Mateus abrir a ficha pela gaveta (`?lead=ID`) quando o relatório citar um caso.
- **Sem nome e sem telefone do cliente** (como a exportação de desempenho já faz).

## Etapas
- [ ] **1. Definir o formato do zip** de cada uma das 5 análises (quais arquivos, quais campos). Conferir com o Mateus antes de codar. A qualidade da análise depende disto.
- [ ] **2. No CRM:** estender a exportação para escolher uma ou mais análises, período e vendedor, gerando um zip por análise com a identificação da análise dentro. Só admin. Atualizar `docs/mapa-do-codigo.md`.
- [ ] **3. Projeto de análise (fora do CRM):** estrutura de pastas, uma pasta por análise com a instrução. Começar pela autópsia dos perdidos. O Mateus decide onde criar o repositório.
- [ ] **4. Rodar a primeira vez com um mês de dados**, revisar o resultado com o Mateus e ajustar a instrução.
- [ ] **5. As outras quatro análises**, uma por vez, na ordem 4, 2, 3, 5 (follow-up primeiro, por ser o mais barato de acertar).
- [ ] **6. Rotina de uso:** como o Mateus leva os achados para a reunião da equipe (casos reais com o trecho da conversa, sem ranking individual).

## Riscos e cuidados
- **LGPD:** conversas de clientes ficam no computador do Mateus. Apagar o zip depois de cada análise e guardar só o relatório. O hábito é dele, o sistema não garante. Conferir também se a política de privacidade (aprovada em 05/11/2026) cobre "análise interna de qualidade"; se não, propor ajuste e o Mateus aprova.
- **Termos de dados da assinatura:** NÃO confirmado se são iguais aos da API (treinamento do modelo etc.). O Mateus confere nas configurações de privacidade da conta antes de enviar conversas reais.
- **Limite de uso da assinatura:** não se sabe quanto uma análise consome. Com 20 a 50 conversas por rodada deve caber; se estourar, dividir em lotes.
- **Amostra pequena engana** (principalmente a análise 2). Abaixo de umas 15 a 20 vendas por grupo, desconfiar de "padrões". O relatório deve informar quantos casos sustentam cada conclusão.
- **O resultado é opinião da IA**, ponto de partida para o Mateus conferir na conversa, não sentença.
- **Equipe:** se for virar avaliação individual, os vendedores devem saber que as conversas são analisadas. Treino coletivo com casos sem nome gera menos atrito que ranking.
- **O que fica fora da IA:** contagens (tempo de resposta, conversão por etapa, compromissos marcados, retornos atrasados) saem do banco ou do Painel, com número exato.

## Em aberto
- Onde criar o projeto de análise e como ele se chama.
- Se o CRM deve guardar a origem do lead (anúncio), o que habilitaria a análise de origem. Não confirmado se o campo já existe.
- Quantos leads perdidos e fechados existem por mês (o Mateus estimou 200 leads/mês, mas não a divisão).
