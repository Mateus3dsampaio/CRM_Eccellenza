# Tarefa 38 – Contrato do bot (o agente de instruções sempre sabe como o CRM funciona)

## Problema
O agente que escreve as instruções do bot fica no outro repositório (`agente-whatsapp-eccellenza`) e só conhece uma cópia manual do Manual do CRM (`contexto/manual-crm.md`). Cópias manuais ficam velhas: cada mudança no CRM exige atualizar o agente à mão, e ele escreve instruções que pedem o que o CRM não faz ou repetem o que o CRM já faz sozinho.

## Solução (decidida com o Mateus em 08/11/2026)
- Os projetos **continuam separados**. Juntar levaria prints com dados de clientes (`casos/`) para o repositório e para a imagem do Railway (`COPY . .` no Dockerfile) e misturaria duas regras de trabalho opostas.
- O CRM **gera sozinho** `docs/contrato-do-bot.md`: um retrato curto, sem código, de tudo o que o bot recebe, pode fazer e o que o sistema faz por ele.
- Um teste barra o trabalho se o arquivo ficar desatualizado em relação ao código.
- O agente de instruções lê esse arquivo **direto do GitHub do CRM (branch `main`)** no começo de cada sessão, na nuvem ou no PC. Só esse arquivo entra no contexto dele; ele não abre outros arquivos do CRM.

## O que o contrato deve ter (curto: poucas páginas, sem código)
1. **Abertura fixa do prompt**: o texto de `src/bot/prompt.ts` (identidade e tags `<cliente>`/`<sistema>`) e a ordem em que o prompt é montado (instruções numeradas → Manual do CRM).
2. **O que chega a cada mensagem**: os avisos `<sistema>` que o bot recebe (data/hora, situação da loja, nome do perfil na primeira mensagem, arquivos que ele não abre, mensagem enviada por consultor/sistema etc.), em linguagem simples.
3. **Ferramentas**: para cada uma (`registrar_lead`, `atualizar_lead`, `classificar_lead`, `registrar_medidas`, `registrar_retorno`, `passar_para_consultor`), o que faz, os campos e as opções aceitas. Gerado a partir de `src/bot/ferramentas.ts`.
4. **O que o sistema faz sozinho** (o bot não precisa nem deve fazer): pausa total depois de passar ao consultor, "PARAR" e o texto de confirmação, limites do bot (por minuto/dia) e o que acontece ao atingir, sem instrução ativa → direto ao consultor, mídias que o bot não lê, horário da loja vindo da agenda, retorno com a loja fechada. Valores tirados das constantes em `src/regras/` (não digitados de novo).
5. **Manual do CRM**: o texto de `src/bot/manual-inicial.ts`, com o aviso de que o texto que vale é o da tela (ver decisão pendente abaixo).
6. Cabeçalho: "gerado automaticamente em <data>, não edite à mão".

## Etapas (uma por vez, com validação do Mateus)
- [ ] 1. **Mapear as fontes**: listar de onde sai cada item acima no código. O que hoje está só dentro de função (ex.: frases dos avisos `<sistema>` em `src/bot/atendimento.ts`, abertura em `src/bot/prompt.ts`) passa a ser constante exportada, para o gerador e o bot usarem o mesmo texto. Sem mudar o comportamento do bot.
- [ ] 2. **Gerador**: `scripts/gerar-contrato-bot.ts` + comando `npm run contrato:bot`, que escreve `docs/contrato-do-bot.md`. Mostrar o arquivo gerado ao Mateus para validar se está claro e no tamanho certo.
- [ ] 3. **Teste de atualização**: `testes/unit/contrato-bot.test.ts` gera o texto em memória e compara com o arquivo; falha com a mensagem "rode `npm run contrato:bot`".
- [ ] 4. **Regras do CRM**: no `CLAUDE.md` do CRM, regra "mudou ferramenta, aviso `<sistema>`, regra automática ou manual do bot → `npm run contrato:bot` na mesma alteração". Atualizar `docs/mapa-do-codigo.md` (gerador, teste, contrato).
- [ ] 5. **Projeto de instruções** (outro repositório; pelas regras de lá, só com autorização do Mateus para cada mudança):
  - No `CLAUDE.md` de lá: "Antes de qualquer trabalho, traga o repositório `Mateus3dsampaio/CRM_Eccellenza` para a sessão e leia só `docs/contrato-do-bot.md` da branch `main`. É a única fonte sobre o CRM. Não abra outros arquivos do CRM. Se uma instrução precisar de algo que não está lá, avise o Mateus para pedir ao CRM."
  - Apagar `contexto/manual-crm.md` e as referências a ele.
  - Tirar do caminho do agente o legado da Meta (`painel-meta/` e a seção do painel no `CLAUDE.md`): apagar ou mover para uma pasta `arquivo/` que o agente não lê (Mateus escolhe).
- [ ] 6. **Teste real**: abrir uma sessão na nuvem do projeto de instruções e conferir que o agente traz o CRM, lê o contrato e responde corretamente "o que o bot faz quando a loja está fechada?".

## Decisão pendente do Mateus
- **Manual do CRM**: o que vale é o texto do banco (editável na tela). O contrato mostra o do código (`manual-inicial.ts`), que pode estar diferente do que roda no Railway. Proposta: o Manual **só muda junto com o código**, por proposta aprovada pelo Mateus, e a mudança aprovada é aplicada no arquivo e na tela na mesma vez. Assim contrato e bot real não se separam.

## Fora desta tarefa
- Painel de análise de atendimentos dentro do CRM (substituiria o segundo projeto). Registrar em `tarefas/futuras/` se o Mateus quiser.
