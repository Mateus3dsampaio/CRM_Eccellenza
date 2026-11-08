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
- [x] 1. **Mapear as fontes**: listar de onde sai cada item acima no código. O que hoje está só dentro de função (ex.: frases dos avisos `<sistema>` em `src/bot/atendimento.ts`, abertura em `src/bot/prompt.ts`) passa a ser constante exportada, para o gerador e o bot usarem o mesmo texto. Sem mudar o comportamento do bot.
- [ ] 2. **Gerador** (pronto; falta o Mateus validar o arquivo): `scripts/gerar-contrato-bot.ts` + comando `npm run contrato:bot`, que escreve `docs/contrato-do-bot.md`. Mostrar o arquivo gerado ao Mateus para validar se está claro e no tamanho certo.
- [ ] 3. **Teste de atualização**: `testes/unit/contrato-bot.test.ts` gera o texto em memória e compara com o arquivo; falha com a mensagem "rode `npm run contrato:bot`".
- [ ] 4. **Regras do CRM**: no `CLAUDE.md` do CRM, regra "mudou ferramenta, aviso `<sistema>`, regra automática ou manual do bot → `npm run contrato:bot` na mesma alteração". Atualizar `docs/mapa-do-codigo.md` (gerador, teste, contrato).
- [x] 4b. **Manual atualiza sozinho** (pedido do Mateus 08/11/2026): `src/bot/manual-versoes.ts` guarda a impressão de cada versão do Manual. Ao subir uma versão nova, o sistema troca o Manual do banco se ele for uma versão antiga sem edição (a antiga fica como "anterior"). Editado na tela: não mexe, a tela avisa e oferece "Usar o texto do código". "Voltar para a anterior" é respeitado.
- [ ] 5. **Projeto de instruções** (outro repositório; pelas regras de lá, só com autorização do Mateus para cada mudança):
  - No `CLAUDE.md` de lá: "Antes de qualquer trabalho, traga o repositório `Mateus3dsampaio/CRM_Eccellenza` para a sessão e leia só `docs/contrato-do-bot.md` da branch `main`. É a única fonte sobre o CRM. Não abra outros arquivos do CRM. Se uma instrução precisar de algo que não está lá, avise o Mateus para pedir ao CRM."
  - Apagar `contexto/manual-crm.md` e as referências a ele.
  - Tirar do caminho do agente o legado da Meta (`painel-meta/` e a seção do painel no `CLAUDE.md`): apagar ou mover para uma pasta `arquivo/` que o agente não lê (Mateus escolhe).
- [ ] 6. **Teste real**: abrir uma sessão na nuvem do projeto de instruções e conferir que o agente traz o CRM, lê o contrato e responde corretamente "o que o bot faz quando a loja está fechada?".

## Fontes de cada parte do contrato (etapa 1, 08/11/2026)
| Parte | De onde sai |
|---|---|
| Abertura do prompt | `ABERTURA_DO_PROMPT` em `src/bot/avisos.ts` (o bot usa a mesma constante em `prompt.ts`) |
| Ordem do prompt | `src/bot/prompt.ts`: abertura → instruções numeradas ativas → Manual do CRM |
| Avisos de cada mensagem | Funções de `src/bot/avisos.ts` (`avisoDoTurno`, `avisoArquivoNaoLido`, `avisoImagem`, `mensagemDoCliente`, `avisoMensagemEnviada`), chamadas pelo gerador com exemplos. Situação da loja: `situacaoDaLoja` (`regras/presenca.ts`); nome do arquivo: `descricaoDoTipo` (`regras/midia.ts`) |
| Ferramentas | `FERRAMENTAS` (`src/bot/ferramentas.ts`) + nomes das classificações em `CLASSIFICACOES` (`regras/etapas.ts`) |
| Limites do bot | `LIMITE_POR_MINUTO`, `LIMITE_POR_DIA` (`regras/limite-bot.ts`) |
| PARAR | `PEDIDOS_PARA_PARAR`, `TEXTO_CONFIRMA_PARAR` e botão "Não tenho interesse" (`regras/optout.ts`) |
| Horário da loja | `descreverHorarioDeFuncionamento` com a agenda padrão (`regras/presenca.ts`); o real vem da agenda da tela |
| Manual do CRM | `MANUAL_INICIAL` (`src/bot/manual-inicial.ts`) |

Limite honesto: o que é **comportamento** (pausa depois de passar ao consultor, sem instrução → consultor, consultor assumiu no meio) não é um texto no código. O gerador descreve isso numa frase curta escrita nele, usando as constantes acima onde houver número ou texto. Essas frases são a única parte que pode ficar velha; ficam juntas num só lugar do gerador para revisar quando o comportamento mudar.
Fora por enquanto: as respostas do sistema a cada ferramenta (`src/bot/executor.ts`, ex.: "Gravado."). A única que importa para as instruções (horário recusado em `registrar_retorno`) já está na descrição da ferramenta.

## Decisão do Mateus (08/11/2026)
- **Manual do CRM só muda junto com o código**, por proposta aprovada pelo Mateus; a mudança aprovada é aplicada no arquivo (`manual-inicial.ts`) e na tela na mesma vez. Assim o contrato e o bot real não se separam. Entra no `CLAUDE.md` do CRM na etapa 4.

## Fora desta tarefa
- Painel de análise de atendimentos dentro do CRM (substituiria o segundo projeto). Registrar em `tarefas/futuras/` se o Mateus quiser.
