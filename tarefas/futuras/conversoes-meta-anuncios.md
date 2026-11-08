# Tópico: Avisar a Meta quando o lead do anúncio avança (API de Conversões)

**Estado:** ideia registrada em 08/11/2026. Nenhuma etapa feita. Sem urgência.

## Objetivo
Aumentar a quantidade de apresentações e de vendas fechadas vindas dos anúncios. Para isso, o CRM avisa a Meta quando um lead que veio de anúncio avança no funil (lead qualificado, visita ou medição marcada, apresentação, venda com valor). Com o tempo, a Meta aprende o perfil de quem fecha. Ela passa a mostrar o anúncio para gente parecida e menos para quem só conversa e some ou mora fora da área atendida.

## Contexto (Mateus, 08/11/2026)
- Os anúncios levam direto ao WhatsApp (clique para conversar), sem site.
- Os leads caíram em quantidade e qualidade, e chegam muitos de outras cidades. A causa provável é o mesmo anúncio rodando por muito tempo (saturação).
- O Mateus vai trocar o objetivo da campanha de Tráfego para Vendas, para testar.
- Ele viu a opção do pixel, mas nunca usou, porque não havia site para marcar conversão.

## Como funciona
- O **pixel** é para site. Para anúncio que leva ao WhatsApp, o equivalente é a **API de Conversões para mensagens** (Conversions API for Business Messaging), ligada a um conjunto de dados (dataset) no Gerenciador de Eventos.
- Quando a pessoa clica no anúncio e manda a primeira mensagem, o webhook do WhatsApp traz junto o código do clique (`ctwa_clid`) e os dados do anúncio de origem (campo `referral`).
- O CRM guarda esse código no lead. Em cada avanço de etapa, o CRM envia o evento para a Meta com o código, o telefone criptografado (hash) e, no caso da venda, o valor.

## Decisões e recomendação (a confirmar com o Mateus)
- **Não otimizar a campanha por "venda".** A Meta precisa de cerca de 50 eventos por semana por conjunto de anúncios para sair da fase de aprendizado, e móvel planejado não fecha nesse volume. Além disso, a Meta só aceita eventos até cerca de 7 dias depois do clique, e muitas vendas fecham depois disso. Os dois números precisam ser confirmados na documentação.
- **Otimizar por um evento mais cedo e mais frequente:** "lead qualificado" (cidade atendida e projeto real) ou "agendou visita/medição". Apresentação e venda vão como eventos extras, com valor.
- "Lead qualificado" só dispara quando a cidade é atendida. Assim também ensina a Meta a evitar leads de fora.
- **Ganho rápido, sem CRM:** subir a lista de quem já comprou como Público Personalizado e criar um Público Semelhante. Em Localização, usar "Pessoas que moram ou estiveram recentemente neste local".

## Etapas
- [ ] **1. Confirmar na documentação da Meta:** nomes exatos dos eventos aceitos para mensagens (não cravar de memória), prazo máximo para enviar o evento, campos obrigatórios e como o `ctwa_clid` chega no webhook.
- [ ] **2. Decidir com o Mateus** qual etapa do kanban dispara cada evento e qual será o evento de otimização da campanha.
- [ ] **3. Guardar a origem do anúncio:** na primeira mensagem, salvar `ctwa_clid`, id do anúncio e título. Precisa de campo novo no banco (esquema SQLite + Postgres + migração). Hoje o CRM **não guarda** isso: em 08/11/2026 não havia `referral` nem `ctwa` em `src/`.
- [ ] **4. Enviar os eventos** quando o card muda de etapa, com fila e nova tentativa se a Meta falhar, sem envio duplicado e com log sem dados pessoais. Token e id do dataset só em variável de ambiente.
- [ ] **5. Mostrar na ficha do lead** de qual anúncio ele veio e quais eventos já foram enviados.
- [ ] **6. Painel:** qual anúncio traz lead que vira apresentação e venda. Também serve à análise de origem em [`analises-com-claude.md`](analises-com-claude.md).
- [ ] **7. Revisar a política de privacidade** (aprovada em 05/11/2026) para citar o envio de dados à Meta para medir anúncios. O Mateus aprova o texto.
- [ ] **8. Testar em produção** com um anúncio real e conferir no Gerenciador de Eventos se os eventos chegam e se são associados ao clique.

## Riscos e cuidados
- **LGPD:** o envio de dados do cliente à Meta para fins de anúncio precisa constar na política de privacidade antes de ligar. O telefone vai criptografado (hash), mas continua sendo dado pessoal.
- **Não dá para testar no simulador.** Só funciona com o WhatsApp oficial da Meta em produção, que ainda está pendente (`docs/pendencias.md`).
- **Volume baixo:** com poucos eventos, a otimização demora ou não sai da fase de aprendizado. O ganho vem mais do evento cedo (qualificado/agendou) que da venda.
- **Marcação errada no kanban ensina errado:** se o vendedor não mover o card, ou mover para a etapa errada, a Meta aprende com dado ruim.
- Só os leads que chegaram por anúncio de clique para o WhatsApp têm o código do clique. Os orgânicos e os de indicação não entram.

## Em aberto
- Quantas visitas, medições e vendas por semana vêm hoje dos anúncios (define qual evento tem volume para otimizar).
- Se o dataset e o token da API de Conversões ficam na mesma conta do WhatsApp oficial.
