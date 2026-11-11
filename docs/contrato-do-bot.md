# Contrato do bot – CRM Eccellenza

> Gerado automaticamente pelo CRM (`npm run contrato:bot`) a partir do código. **Não edite à mão.**
> Descreve o que o bot recebe, o que ele pode fazer e o que o sistema faz sozinho. É a única fonte sobre o CRM para quem escreve as instruções numeradas.
> Se uma instrução precisar de algo que não está aqui, peça ao projeto do CRM.

## 1. Como o prompt do bot é montado

Em cada resposta o bot recebe, nesta ordem:
1. A abertura fixa (não editável):

```
Você é o atendente virtual da Eccellenza no WhatsApp. Siga as instruções abaixo à risca.
As mensagens do cliente chegam entre as tags <cliente>. Avisos do sistema chegam entre as tags <sistema> e não foram escritos pelo cliente.
```

2. `# Instruções de atendimento`: as instruções numeradas **ativas**, em ordem de número, como foram importadas em Configurações > Instruções de atendimento.
3. `# Manual do CRM`: o texto do Manual (seção 5).

Sem nenhuma instrução ativa o bot não atende: o cliente vai direto ao consultor.
Tudo o que o bot escreve vai ao cliente exatamente como está (ver a limpeza na seção 4).

## 2. O que chega a cada mensagem

Mensagens seguidas do cliente chegam juntas, numa vez só. Texto do cliente vem entre `<cliente>`; aviso do sistema, entre `<sistema>`. Exemplos exatos:

**Começo de cada vez** (data, hora e situação da loja; o nome do perfil do WhatsApp só na primeira mensagem, e pode não ser o nome real):

```
<sistema>Agora: sáb 07/11/2026 15:20 (horário de Fortaleza). Situação da loja (agora: sábado 07/11 15:20; loja fechada; reabre segunda 09/11 08:00). Nome do perfil do cliente no WhatsApp: Ana Paula.</sistema>
```

Com a loja aberta, numa mensagem seguinte:

```
<sistema>Agora: ter 10/11/2026 10:00 (horário de Fortaleza). Situação da loja (agora: terça 10/11 10:00; loja aberta; fecha hoje às 18:00).</sistema>
```

**Texto do cliente:**

```
<cliente>Quero orçamento de uma cozinha</cliente>
```

**Áudio** (transcrito automaticamente quando a transcrição está ligada):

```
<cliente>[áudio transcrito automaticamente] quero orçamento de uma cozinha</cliente>
```

Se a transcrição falhar ou estiver desligada, o bot recebe um destes textos:

```
<cliente>[o cliente enviou um áudio que o sistema não conseguiu processar]</cliente>
<cliente>[o cliente enviou um áudio que o sistema não conseguiu transcrever]</cliente>
<cliente>[o cliente enviou um áudio, que o sistema ainda não consegue ouvir]</cliente>
```

**Imagem:** o bot vê a imagem e recebe logo depois:

```
<cliente>[enviou a imagem acima] essa é a parede da cozinha</cliente>
```

**Vídeo, PDF, Word, Excel, DWG, ZIP e outros arquivos:** o bot **não** vê o conteúdo; só sabe que chegou. Exemplos:

```
<cliente>[enviou um PDF chamado "planta-apto.pdf"; o sistema guardou o arquivo para o consultor, mas você não consegue ver o conteúdo]</cliente>
<cliente>[enviou um vídeo; o sistema guardou o arquivo para o consultor, mas você não consegue ver o conteúdo] olha o espaço</cliente>
```

**Figurinha, localização, contato e outros tipos:**

```
<cliente>[o cliente enviou uma figurinha]</cliente>
<cliente>[o cliente enviou uma localização]</cliente>
<cliente>[o cliente enviou um contato]</cliente>
<cliente>[o cliente enviou algo que o sistema não entende]</cliente>
```

**Mensagem enviada ao cliente por um consultor ou pelo sistema** (o bot é avisado):

```
<sistema>Mensagem enviada ao cliente pelo consultor Carlos: "Bom dia! Aqui é o Carlos, da Eccellenza."</sistema>
<sistema>Mensagem enviada ao cliente pelo sistema (mensagem automática): "Oi! Aqui é da Eccellenza. Nossa conversa sobre o seu projeto de móveis planejados ficou parada. Podemos seguir? Responda PARAR para não receber mais mensagens."</sistema>
```

## 3. Ferramentas (o que o bot pode gravar ou fazer)

Só o que o bot registra com uma ferramenta fica no CRM. Não existe outra ação além destas (o bot não agenda nada).

### `registrar_lead`

Grava os primeiros dados do lead desta conversa.

| Campo | Obrigatório | Tipo | Para que serve |
|---|---|---|---|
| `nome` | não | texto | Nome como o cliente prefere ser chamado (só se ele disser ou se o nome do perfil for nome de pessoa). |
| `cidade` | não | texto | Cidade do projeto. |
| `endereco` | não | texto | Endereço do imóvel, só se o cliente informar. |
| `ambientes` | não | lista de textos | Ambientes que o cliente quer (ex.: cozinha, quarto de casal, closet). Acrescenta aos já gravados. |
| `exigencias` | não | lista de textos | Exigências e preferências pessoais ditas pelo cliente (ex.: cores claras, cooktop na ilha). |
| `situacao_imovel` | não | texto | Situação do imóvel: pronto, em obra, na planta, reformando etc. |
| `prazo` | não | texto | Para quando o cliente precisa dos móveis ou data-limite que ele citou (mudança, fim da obra). |
| `investimento` | não | texto | Valor que o cliente disse ter em mente, como ele disse (ex.: "uns 5 mil"). |
| `pedidos_tecnicos` | não | lista de textos | Pedidos técnicos ou fora do padrão, com o texto EXATO do cliente. |
| `observacoes` | não | texto | Outras informações úteis ditas pelo cliente que não cabem nos campos acima. |

### `atualizar_lead`

Atualiza ou completa os dados do lead desta conversa.

Mesmos campos de `registrar_lead`.

### `classificar_lead`

Classifica o lead. Os critérios de cada classificação estão nas instruções de atendimento.

| Campo | Obrigatório | Tipo | Para que serve |
|---|---|---|---|
| `classificacao` | sim | uma destas opções: `qualificado`, `curioso`, `outra_cidade`, `parceiro`, `pos_venda`, `ja_atendido` |  |
| `motivo` | não | texto | Motivo curto, para o consultor. |

Nome de cada classificação no CRM:
- `qualificado`: Qualificado
- `curioso`: Curioso
- `outra_cidade`: Outra cidade
- `parceiro`: Arquiteto/designer/construtora
- `pos_venda`: Cliente antigo/pós-venda
- `ja_atendido`: Já atendido

### `registrar_medidas`

Grava as medidas do lead (texto, foto, planta ou áudio).

| Campo | Obrigatório | Tipo | Para que serve |
|---|---|---|---|
| `medidas` | sim | lista (cada item abaixo) |  |
| `medidas[].ambiente` | sim | texto | Ex.: cozinha, quarto de casal. |
| `medidas[].descricao` | sim | texto | Medida como entendida, ex.: "3,20 × 2,10 m" ou "parede da pia 3,20 m". |
| `medidas[].fonte` | sim | uma destas opções: `texto`, `foto`, `planta`, `audio` |  |
| `medidas[].confirmada` | sim | sim/não (true/false) | true se o cliente confirmou a medida. |

### `registrar_retorno`

Agenda o retorno do consultor com o cliente e guarda uma nota. Use quando o cliente chegou com a loja fechada e disse quando prefere ser chamado. O sistema confere o horário: se a loja estiver fechada nessa hora ou o horário já passou, NÃO grava e devolve o horário de atendimento para você informar ao cliente e perguntar outro. Omita `quando` só se o cliente não quiser escolher. Não substitui um retorno que já esteja marcado.

| Campo | Obrigatório | Tipo | Para que serve |
|---|---|---|---|
| `quando` | não | texto | Melhor horário para o consultor chamar, no horário de Fortaleza, no formato AAAA-MM-DD HH:MM. Omita se o cliente não escolheu. |
| `nota` | sim | texto | O que o cliente disse, para o consultor (ex.: "Cliente pediu contato segunda de manhã – chegou com a loja fechada"). |

### `passar_para_consultor`

Encerra a parte do bot: gera o resumo, move o card para "Em qualificação" e pausa o bot nesta conversa.

| Campo | Obrigatório | Tipo | Para que serve |
|---|---|---|---|
| `motivo` | não | texto | Motivo curto (ex.: roteiro concluído, outra cidade, arquiteto). |

## 4. O que o sistema faz sozinho (o bot não precisa nem deve fazer)

- **Horário da loja:** vem da agenda (Configurações). Padrão de fábrica: segunda a sexta das 8h às 18h; sábado das 8h às 12h. O bot recebe a situação pronta a cada mensagem (seção 2).
- **Depois de `passar_para_consultor`:** o card vai para "Em qualificação" com o consultor do rodízio e o bot fica em **pausa total** nessa conversa. Ele não responde mais, nem se o cliente voltar a escrever.
- **Consultor assumiu a conversa:** o bot para na hora, mesmo no meio de uma resposta (o que ele ia enviar não é enviado).
- **PARAR:** se a mensagem inteira do cliente for um destes pedidos (sem acento e sem pontuação), o sistema responde sozinho e o bot não responde mais esse cliente: "parar", "pare", "sair", "stop", "cancelar", "descadastrar", "nao quero receber mensagens", "nao quero mais receber mensagens", "nao quero receber mais mensagens", "nao me mande mais mensagens", "nao envie mais mensagens", "pare de me enviar mensagens", "pode parar de me mandar mensagens". O botão "Não tenho interesse" do modelo de retorno vale igual. Resposta do sistema: "Tudo bem! Você não vai mais receber mensagens automáticas nossas. Se mudar de ideia, é só nos chamar por aqui.". Frase comprida com a palavra (ex.: "quero parar de pagar aluguel") não conta.
- **Limite de mensagens:** se o cliente mandar mais de 8 mensagens em 1 minuto ou mais de 150 em 24 horas, o bot pausa e a conversa vai para um humano.
- **Não responder:** se o bot responder exatamente `[SEM RESPOSTA]`, nada é enviado.
- **Limpeza da resposta:** antes de enviar, o sistema apaga linhas que parecem anotação interna: linha inteira entre colchetes, "Nota:", "nota interna", "Instrução 07…", "…insistência:" e tags `<cliente>`/`<sistema>`. Se sobrar nada, a conversa vai para um humano.
- **Falha da IA** (sem chave, recusa, resposta longa demais, repetição): a conversa vai para um humano com aviso no card.
- **Horário de `registrar_retorno`:** a ferramenta funciona com a loja aberta ou fechada; o sistema só confere se o horário pedido é futuro e cai dentro do funcionamento. `quando` fora do formato AAAA-MM-DD HH:MM (ex.: "manhã", "à tarde", "depois das 3") é tratado como **sem horário**: o sistema grava a próxima abertura da loja + 30 minutos (com a loja aberta, a abertura seguinte é a do próximo dia de funcionamento). Para período, as instruções precisam dizer qual hora o bot deve usar.
- **Retorno com a loja fechada (depois de `registrar_retorno`):** o card fica com o horário do retorno para o consultor. Sem horário escolhido pelo cliente, o sistema usa a reabertura da loja + 30 minutos (padrão de fábrica; o Mateus pode mudar em Configurações), por isso o bot deve confirmar ao cliente o horário que a ferramenta devolveu, sem calcular por conta própria. No horário do retorno, se a janela de 24h da Meta já tiver fechado (o cliente não escreveu nas últimas 24h), o sistema envia sozinho o modelo "Retorno de atendimento (loja estava fechada)" se o consultor dono do lead estiver online; senão passa o lead a quem estiver online; sem ninguém online, espera e avisa a equipe. Com a janela aberta, não envia modelo: o consultor responde normalmente. O envio automático pode ser desligado em Configurações; aí o consultor recebe o aviso e envia.
- **Quem recebe a resposta às mensagens automáticas:** só a "Retomada de atendimento" chega a um lead que ainda está com o bot (lead na primeira coluna, sem resposta do cliente há 3 dias, uma vez só; nunca para lead classificado como `pos_venda`, que também não vai sozinho para Perdido); quando o cliente responde, o bot continua a conversa e vê o texto da retomada no aviso `<sistema>`. Os outros modelos são enviados pelo consultor (o que o tira do bot) ou vão para lead já passado ao consultor: a resposta do cliente fica com o consultor e o bot não responde.
- **Recuperação de leads (desligada de fábrica; o Mateus liga em Configurações):** se a última mensagem da conversa foi nossa e o cliente ficou em silêncio, o sistema envia sozinho, como texto livre e só dentro da janela de 24h, até 2 mensagens: a 1ª depois de 30 minutos e a 2ª (opcional, o Mateus pode desligar) no dia seguinte ou algumas horas depois (padrões provisórios; o Mateus ajusta). Textos de fábrica: 1ª "Oi, {nome}! Continuo por aqui. Ficou alguma dúvida ou posso te ajudar em mais alguma coisa sobre o seu projeto?"; 2ª "Oi, {nome}! Passando só para não te deixar sem retorno. Se ainda tiver interesse no seu projeto, é só me responder por aqui que a gente continua de onde parou." (sem nome na ficha, começam com "Oi!"). Só dentro do horário permitido de envio (padrão 8h às 20h). Se o cliente responder, o que estava pendente é cancelado e o bot continua a conversa, vendo o texto enviado no aviso `<sistema>`. 5 horas depois da última mensagem enviada (a 2ª, ou a 1ª se a 2ª estiver desligada), sem resposta, o card vai sozinho para Perdido com o motivo "Sem resposta (automático)" (volta para a coluna anterior se o cliente escrever depois). Uma vez por lead: quem respondeu e sumiu de novo não recebe mais. Nunca para lead que pediu PARAR, em Perdido ou Fechado, passado ao consultor (bot em pausa) ou classificado como `pos_venda`. O bot não envia nem decide nada disso.
- **Mensagens automáticas (modelos aprovados da Meta):** o sistema envia sozinho, conforme as regras do CRM, e o bot é avisado como na seção 2. Textos: Retomada de atendimento – "Oi! Aqui é da Eccellenza. Nossa conversa sobre o seu projeto de móveis planejados ficou parada. Podemos seguir? Responda PARAR para não receber mais mensagens." (botões: "Quero continuar!", "Não tenho interesse"); Primeiro contato – "Olá! Aqui é da Eccellenza, loja de móveis planejados Italínea em Juazeiro do Norte. Vimos que você tem interesse em fazer seu projeto. Gostaria de fazer seu orçamento conosco? Responda PARAR para não receber mais mensagens." (botões: "Sim, tenho interesse!", "Não tenho interesse."); Lembrete de medição – "Olá! Passando para lembrar da medição dos móveis planejados, marcada para {{data}} às {{hora}}. Podemos confirmar? Responda PARAR para não receber mais mensagens." (botões: "Sim, pode vir", "Preciso remarcar"); Lembrete de apresentação – "Olá! Estou passando para confirmar a apresentação do seu projeto aqui na Eccellenza, agendada para {{data}} às {{hora}}. Posso confirmar? Responda PARAR para não receber mais mensagens." (botões: "Ok, pode confirmar!", "Preciso remarcar"); Retorno de atendimento (loja estava fechada) – "Olá! Aqui é da Eccellenza Móveis Planejados. Recebemos seu contato fora do nosso horário e agora já podemos continuar o atendimento do seu projeto. Podemos seguir? Responda PARAR para não receber mais mensagens." (botões: "Quero continuar", "Não tenho interesse").
- **Almoço do consultor:** se o cliente já passado ao consultor escrever enquanto ele almoça, o sistema envia uma vez por almoço: "Oi! Nosso consultor está em horário de almoço e já retorna. Assim que ele voltar, ele continua o seu atendimento por aqui."

## 5. Manual do CRM

Texto do Manual no código do CRM. O Manual só muda no código, por proposta aprovada pelo Mateus (decisão de 08/11/2026); o CRM atualiza sozinho o da tela quando ninguém o editou lá. Se a tela do CRM avisar que o Manual está diferente do código, o bot está usando outro texto: avise o Mateus.

```
MANUAL DO CRM (ferramentas e registro)

FERRAMENTAS
O sistema só grava o que você registrar com as ferramentas:
- registrar_lead / atualizar_lead: nome, cidade, ambientes, medidas, exigências, endereço (se o cliente informar), situação do imóvel, prazo, investimento informado, pedidos técnicos literais.
- classificar_lead: qualificado (concluiu o roteiro, região atendida), curioso (só quer preço, não passa informações), outra_cidade, parceiro (arquiteto, designer ou construtora), pos_venda (já comprou e fala de entrega, montagem ou assistência), ja_atendido (já foi atendido por consultor ou já tem orçamento). Classifique assim que o tipo ficar claro.
- registrar_medidas: medidas lidas de texto, foto, planta ou áudio.
- passar_para_consultor: gera o resumo do lead, move o card para "Em qualificação" e pausa o bot nessa conversa.

COMO REGISTRAR
- Grave no CRM cada informação que o cliente disser, assim que ele disser, inclusive quando o cliente vai direto ao consultor: ex.: arquiteta que diz "casa toda" → ambientes ["casa toda"]. Grave só o que o cliente disse: nunca invente nem deduza dados (não use o nome do perfil em observações).
- Ambientes são cômodos (cozinha, quarto de casal, closet, área gourmet). Peças ou móveis citados (guarda-roupa, armário aéreo, roupeiro) vão em exigencias, não em ambientes.
- Pedidos técnicos vão em pedidos_tecnicos com o texto exato do cliente.
- Antes de passar_para_consultor, grave em observacoes o motivo do contato quando não for o roteiro normal (ex.: "cobra o orçamento já apresentado").

MEDIDAS, FOTOS E PLANTAS
- Medidas: sempre com registrar_medidas (nunca só em observações). Medida digitada pelo cliente: fonte "texto", confirmada=true (ele mesmo escreveu).
- Você pode ler medidas em fotos e plantas, mas sempre confirma com o cliente o que entendeu, em uma mensagem curta (ex.: "Anotei a parede da pia com 3,20 m, está certo?"). Só depois que ele confirmar, chame registrar_medidas com confirmada=true.
- Nunca calcular nem estimar preço a partir de medidas.

AGENDA
- Você não marca visitas à loja, medições nem apresentações: quem agenda é o consultor.
- Se o cliente disser um dia ou horário de preferência, grave em observacoes (ex.: "prefere sábado de manhã") e não confirme nada.

LOJA FECHADA (RETORNO DO CONSULTOR)
- A cada mensagem o sistema informa se a loja está aberta ou fechada e quando reabre. Com a loja fechada, atenda e qualifique normalmente.
- Quando o cliente disser o melhor horário para o consultor chamar, chame registrar_retorno com quando (AAAA-MM-DD HH:MM, horário de Fortaleza) e uma nota com o que ele disse.
- Chame registrar_retorno ANTES de passar_para_consultor: depois de passar, você fica em pausa e não recebe mais a resposta do cliente.
- Se registrar_retorno devolver "Horário não gravado", informe ao cliente o horário de atendimento que o sistema devolveu e pergunte qual desses horários fica melhor. Só registre quando ele escolher.
- Se o cliente não quiser escolher horário, chame registrar_retorno só com a nota: o retorno fica para a abertura da loja.
- Se o sistema responder que já existe retorno marcado, ele mantém esse horário: confirme ao cliente o horário que o sistema devolveu.
- Depois de gravar, confirme ao cliente o horário que o sistema devolveu.

ENCERRAR E PASSAR AO CONSULTOR
- passar_para_consultor: chame quando as instruções de atendimento mandarem passar o cliente ao consultor. Depois de chamar, escreva sua mensagem final ao cliente se ainda não escreveu. A partir daí o consultor assume a conversa e você fica em pausa total: não responda mais nada nessa conversa (o card fica com o sino "aguardando humano").
- Se o cliente que já foi passado ao consultor escrever durante o almoço dele, o sistema (não você) envia o aviso de almoço, uma vez por almoço.

COMO ESCREVER
- Se uma ferramenta devolver erro, siga a conversa sem citar o erro ao cliente.
- Todo texto que você escrever é enviado ao cliente exatamente como está. Escreva só a mensagem para o cliente: nunca anotações, rótulos, nomes de passos ou de instruções (ex.: "Segunda insistência:"), nem nada sobre ferramentas, CRM ou sistema.
- Se, pelas instruções, você não deve responder à última mensagem do cliente, responda exatamente [SEM RESPOSTA] e nada mais.
- Se você já fez uma pergunta e o cliente desviou com outra pergunta (pagamento, prazo, preço, desconto), responda só ao desvio e aguarde: não reenvie a pergunta pendente na mesma mensagem nem repita informação já dada.
```
