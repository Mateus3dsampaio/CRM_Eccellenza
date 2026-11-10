# Mapa do código

**Leia isto antes de editar.** Diz onde fica cada coisa, para não precisar vasculhar o projeto.
Este mapa é conferido por teste (`testes/unit/mapa.test.ts`): arquivo de código novo, apagado ou renomeado sem atualizar o mapa faz `npm test` falhar. O que mudou de função (não só de nome) é por conta de quem alterou: atualize a linha. Regra completa no `CLAUDE.md`.

## Como as camadas se falam
```
tela (src/app/(app)/*/page.tsx) → componente (src/componentes) → API (src/app/api/*/route.ts)
                                                                      ↓
                                      serviço (src/servicos, grava no banco) ← regras (src/regras, puras)
                                                                      ↓
                                                         banco (prisma/schema.prisma, SQLite)
bot (src/bot) usa os mesmos serviços, por ferramentas.
```
- **Regra de negócio sem banco** (24h, agenda, retomada, permissões) vai em `src/regras`.
- **Tudo que grava no banco** vai em `src/servicos`. As rotas da API só validam (zod), checam permissão (`exigirUsuario`) e chamam o serviço.
- Tempo: use `agora()` de `src/lib/relogio.ts`, nunca `Date.now()` (relógio simulado).
- Permissão: `src/regras/permissoes.ts` + `exigirUsuario("ação")` em `src/lib/sessao.ts`.

## Onde mexer para…
| Quero mudar… | Arquivos |
|---|---|
| O que o bot diz / como atende | Tudo fica nas instruções (tela Configurações, banco): as numeradas são coladas pelo Mateus do repositório de instruções dele (o projeto não tem cópia) e o Manual do CRM (fixo, fora da numeração) ensina as ferramentas. Sem instrução ativa o bot não atende e passa o cliente ao consultor (`src/bot/atendimento.ts`). Montagem do prompt: `src/bot/prompt.ts` |
| Abrir a ficha de um lead a partir de uma tela (card, lista, agenda) | Use `useGaveta().hrefDe(id)` (`src/componentes/ficha/gaveta.tsx`), nunca `/lead/ID` direto: abre a gaveta na tela atual. Só "Abrir ficha completa" vai para `/lead/[id]` |
| Ferramentas do bot (o que ele grava) | `src/bot/ferramentas.ts` (esquemas) + `src/bot/executor.ts` (execução) |
| O que o agente das instruções sabe do CRM (tarefa 38) | `docs/contrato-do-bot.md`, gerado por `src/bot/contrato.ts` (`npm run contrato:bot`); teste `testes/unit/contrato-bot.test.ts`. Mudou ferramenta, aviso, regra automática ou Manual: gere de novo |
| Colunas, etiquetas, classificações | `src/regras/etapas.ts` (nomes de fábrica). Nome das colunas editável pelo admin no Kanban (lápis ao lado do título): `src/servicos/etapas.ts` + `src/app/api/etapas/route.ts` + `src/componentes/etapas.tsx` (provedor `useNomesEtapas`). Qualquer tela que mostre o nome de uma etapa usa o provedor, não `nomeEtapa` |
| Regras da agenda (horário por dia, duração da visita e da medição, vagas, dias à frente): o admin edita em Configurações > Geral, gravado em `Configuracao` (chave `agenda`) | `src/regras/agenda.ts` (padrão e validação) + `src/servicos/configuracoes.ts` + `src/servicos/agenda.ts` |
| Retomada / "Parou de responder" (vai para Perdido) | `src/regras/retomada.ts` + `src/servicos/rotinas.ts` |
| Decisão pendente (data vencida: medição ou apresentação que passou, retorno da Negociação vencido; vence no dia seguinte) | Regra: `src/regras/decisao.ts`. Etiqueta e janela: `src/componentes/kanban/card.tsx` + `decisao.tsx` (ligada em `quadro.tsx`). Aviso diário ao dono e ao admin: `avisarDecisoesVencidas` em `src/servicos/alertas.ts`. Lista: `retornosDeHoje` em `src/servicos/consultas.ts`. Falta (remarcar depois da data): `src/servicos/agenda.ts` |
| Cliente de Perdido voltou a falar (card volta para a coluna em que estava; excluído começa do zero) | `src/servicos/mensagens.ts` (`registrarMensagemCliente`) + `etapaAntesDoPerdido` em `src/servicos/leads.ts` |
| Modelos de mensagem / janela de 24h | `src/regras/modelos.ts`, `src/regras/janela24h.ts`. Lembretes com data e hora: variáveis montadas em `enviarMensagemLoja` (`servicos/mensagens.ts`) e mandadas como `components` em `enviarPelaMeta` (`servicos/whatsapp.ts`); prévia na conversa: `previaDoModelo` em `componentes/ficha/conversa.tsx` |
| Motivos de perda e se Negociação exige próximo contato | Tela: `src/componentes/configuracoes/vendas.tsx`. Regras e gravação: `src/servicos/vendas.ts` + `src/regras/vendas.ts` (`faltaParaMover`). A janela de mover e a ficha leem de `/api/vendas/regras` |
| Retornos e lembretes (próximo contato com nota em qualquer etapa aberta, "Retornos de hoje" com botão que pulsa, destaque no card; no "Próximo passo" da gaveta e da ficha: `src/componentes/ficha/proximo-passo.tsx`; janela: `src/componentes/ficha/lembrete.tsx`) | `src/regras/vendas.ts` (`situacaoDoRetorno`) + `src/servicos/consultas.ts` (`retornosDeHoje`) + `src/servicos/alertas.ts` (`avisarRetornos`) + `src/componentes/retornos.tsx` |
| Avisos (som, notificação do navegador, número na aba) | Quando nasce o aviso: `src/servicos/alertas.ts` (chamado por `mensagens`, `agenda` e `bot/executor`). Texto: `src/regras/alertas.ts`. Tela: `src/componentes/alertas/` (ligar e desligar: menu do usuário > Avisos) |
| Espera do cliente (cor do card, prazos, ordem das colunas, bolinha de não lidas) | `src/regras/espera.ts` + `src/servicos/mensagens.ts` (grava) + `src/servicos/configuracoes.ts` (prazos) |
| Quem recebe cada lead | `src/regras/distribuicao.ts` + `src/servicos/distribuicao.ts` |
| Retorno do lead que chegou com a loja fechada (tarefa 36: bot grava o retorno com `registrar_retorno`, modelo `retorno_atendimento` com botões sai sozinho no horário, só com dono online; ajustes em Configurações > Geral > Retorno com a loja fechada) | Regra: `src/regras/retorno-fechada.ts` (+ `proximaAbertura` e `situacaoDaLoja` em `regras/presenca.ts`). Ferramenta: `src/bot/ferramentas.ts` + `src/bot/executor.ts`. Rotina: `src/servicos/retorno-fechada.ts` (chamada por `rotinas.ts`). Modelo e botões: `src/regras/modelos.ts`; toque no botão: `servicos/conversa.ts` (`botao`) + `regras/optout.ts`. Cartão: `RetornoComLojaFechada` em `configuracoes.tsx` |
| Presença dos vendedores e fila da loja fechada (tarefa 35: offline no fechamento, "Ficar online", fila repartida X min depois da abertura, aviso de quem não ficou online com compromisso, "Passar os de hoje"; ajustes em Configurações > Geral > Presença e fila) | Regra: `src/regras/presenca.ts` (horário vem de `regras/agenda.ts`). Rotinas e transferência: `src/servicos/presenca.ts` (chamada por `rotinas.ts`). Cartão: `PresencaEFila` em `src/componentes/configuracoes/configuracoes.tsx`. Botões: `src/componentes/presenca.tsx`. Janela: `src/componentes/equipe/passar-hoje.tsx` |
| Cores, sombras, espaçamentos | `src/app/tokens.css` |
| Abas, filtros de uma opção só, animação do menu | `src/componentes/entalhe/` (`Abas` para abas, com a pílula elástica; `Entalhe` para o menu). Toda aba nova usa `Abas` |
| Quem pode fazer o quê | `src/regras/permissoes.ts` |
| O que a exportação de desempenho leva | `src/servicos/vendas.ts` | Configurações de vendas: motivos de perda (carga inicial, criar, editar, reordenar, excluir só se sem uso) e o interruptor "Negociação exige próximo contato" (padrão ligado). `regrasDeVendas` entrega o que o `moverEtapa` confere |
| `src/servicos/exportacao.ts` (arquivos) + `src/regras/exportacao.ts` (período e cálculos) |
| WhatsApp real (receber, enviar, status, mídia) | Regras puras: `src/regras/whatsapp.ts`. Chamadas à Meta e processamento: `src/servicos/whatsapp.ts`. Rota: `src/app/api/whatsapp/webhook/route.ts`. Chaves: `src/lib/whatsapp-config.ts` (variáveis de ambiente). O envio pelo bot/consultor passa por `enviarMensagemLoja` em `src/servicos/mensagens.ts` |
| Limites do bot por cliente e uso da API | `src/regras/limite-bot.ts` (limites aprovados) + `src/bot/atendimento.ts` + `src/servicos/uso-api.ts` |
| LGPD (parar de receber, exportar, excluir com registro) | `src/regras/midia.ts` | Imagem, vídeo e PDF: tipos aceitos (imagem, vídeo, PDF, Word, Excel, DWG, ZIP e "arquivo genérico" só no recebimento, com lista de extensões bloqueadas; reconhece documento pela extensão quando o tipo vem genérico) e tipos que o vendedor pode enviar, limites por tamanho (PROVISÓRIOS), 180 dias, nome seguro de arquivo, Range de vídeo, rótulos e prévias |
| `src/regras/consentimento.ts` | Consentimento para modelos (mensagem iniciada pela loja): origens, `temConsentimento` e a decisão PROVISÓRIA "cliente que escreveu primeiro conta" |
| `src/regras/importar-instrucoes.ts` | Importar instruções de .txt: título (primeira linha, sem o número, maiúsculas viram frase), número (começo do texto ou nome do arquivo) e o plano por arquivo (atualiza a de mesmo número, nova, igual, erro). Roda na prévia da tela e no servidor |
| `src/regras/privacidade.ts` | Texto da política de privacidade e da página de exclusão de dados `secoesExclusao` (aprovada em 05/11/2026, prazo de 15 dias) (razão social, CNPJ, e-mail de contato e prazos já preenchidos pelo Mateus em 04/11/2026; sem base legal por decisão dele) |
| `src/regras/optout.ts` (frases e texto de confirmação PROVISÓRIO) + `src/servicos/lgpd.ts` |
| Rotinas automáticas (retomada etc.) rodando sozinhas | `src/servicos/agendador.ts` + `src/instrumentation.ts` (liga em produção) |
| Modo simulador (relógio, Simulador) ligado/desligado | `src/lib/modo.ts` (`MODO_SIMULADOR`; desligado em produção) + `src/lib/modo-rota.ts` |
| Login, tentativas, primeiro admin, criar usuário | `src/regras/tentativas-login.ts` + `src/app/api/login/route.ts` + `src/servicos/usuarios.ts` + `scripts/criar-usuario.ts` |
| Tela de login e a esfera de pontos (física, cores, colisão) | `src/app/login/page.tsx` + `src/componentes/login/esfera-3d.ts` (+ `esfera-shader.ts`) |
| Cadastro de usuários (criar, editar, nova senha, desativar, transferir leads), trocar a própria senha, regra da senha (6+, letra, número e maiúscula) | Tela: `src/componentes/configuracoes/equipe.tsx` (cartão Equipe em Configurações > Geral; `JanelaMinhaSenha` abre pelo cabeçalho). Regra: `src/regras/senha.ts`. Gravação: `src/servicos/usuarios.ts` + `transferirLeads` em `src/servicos/distribuicao.ts`. Rotas: `/api/configuracoes/usuarios`, `/api/leads/[id]/transferir`, `/api/conta/senha` |
| Colocar no ar (Railway, Postgres) | `Dockerfile`, `railway.json`, `prisma/postgres/` (esquema gerado + migrações), guia em `docs/colocar-no-ar.md` |
| Enviar/receber imagem, vídeo e PDF; galeria; apagar mídia | Tipos, limites, nome seguro, Range de vídeo: `src/regras/midia.ts` (limites de vídeo e PDF PROVISÓRIOS). Disco: `src/lib/midias.ts`. Apagar, limpeza de 180 dias, galeria, resumo antes de excluir, armazenamento: `src/servicos/midias.ts`. Envio pela Meta: `enviarPelaMeta` (`servicos/whatsapp.ts`) e `enviarMensagemLoja` (`anexo`). Tela: `src/componentes/galeria/galeria.tsx` e anexo em `src/componentes/ficha/conversa.tsx` |
| Tabelas do banco | `prisma/schema.prisma` (depois `npm run esquema:postgres` e uma migração nova em `prisma/postgres/migrations/`; o teste `esquema.test.ts` avisa se esquecer) (depois `npx prisma db push`; ajuste `prisma/seed.ts` e `testes/unit/ajuda.ts` se a tabela precisa ser limpa) |

## Banco (`prisma/schema.prisma`)
| Tabela | Guarda |
|---|---|
| `Usuario` | Admin e consultores (perfil, status online/almoço/offline; offline = não recebe lead, vira sozinho no fechamento da loja) |
| `Lead` | Ficha do cliente (inclui, nas vendas: `retornoModeloEm` (retorno marcado pelo bot com a loja fechada; vale para o envio automático do modelo só enquanto for igual a `proximoContatoEm`), `proximoContatoEm` (lembrete/retorno em qualquer etapa aberta, com `lembreteNota`), `valorOrcamento` e `valorFechado` em centavos, `motivoPerda` e `concorrente`): etapa, etiquetas, dados do projeto, consultor, modo (bot/humano), hora em que o bot repassou o lead (`repassadoEm`), desde quando o cliente espera um humano (`esperandoDesde`) mensagens que nenhum humano abriu (`naoLidas`) e para qual espera o admin já foi avisado do prazo vermelho (`alertaPrazoPara`) e para qual data de retorno o vendedor já foi avisado (`alertaContatoPara`), último aviso de decisão vencida (`alertaDecisaoEm`, um por dia). `naoReceberEm`: o cliente pediu para parar (sem bot, retomada nem modelos). `waId`: número como a Meta o conhece (no Brasil pode ser sem o 9). `consentimentoEm`/`consentimentoOrigem`: consentimento para modelos. `ordem` não é mais usada pelo kanban (a ordem das colunas vem de `regras/espera`) |
| `Mensagem` | Conversa (cliente, bot, consultor), status de envio, mídia (imagem, vídeo ou PDF: arquivo, tipo, nome original e tamanho). `idExterno` = id da Meta (único: a mesma mensagem não entra duas vezes) |
| `ConversaApi` | Histórico enviado à API do Claude por lead |
| `Medida`, `Nota`, `Alteracao` | Medidas, notas internas e histórico de quem mudou o quê |
| `MudancaEtapa` | Cada mudança de etapa do lead (de, para, quem, quando). Gravada em `moverEtapa` e na criação do lead. Alimenta a exportação de desempenho |
| `Visita`, `Bloqueio` | Agenda: compromissos (`tipo`: visita à loja, medição, apresentação) e bloqueios de horário |
| `EventoWebhook` | Caixa de entrada do webhook da Meta: o corpo (traz texto e telefone do cliente) é gravado antes do 200, processado depois e ESVAZIADO ao terminar; a linha some em 2 dias. Excluir um cliente apaga também os eventos pendentes dele |
| `EventoMetrica` | Contadores anônimos do painel |
| `AssinaturaPush` | Navegadores que aceitaram avisos com o CRM fechado: pessoa, endereço do navegador (único) e as chaves que só servem para criptografar o aviso para ele |
| `Alerta` | Avisos para quem atende (mensagem nova, lead passado, visita marcada, hora do retorno com o cliente, prazo vermelho vencido — este só o admin recebe; presença: `ausencia` e `compromisso_cedo`, com `paraTodos` = todos recebem): tipo, lead, dono na hora, texto. A tela busca só os novos pelo `id`; some em 1 dia |
| `Configuracao` | Pares chave/valor (chaves de API criptografadas, modo de distribuição, exigir próximo contato em Negociação, versão dos dados, segredo da sessão) |
| `RegistroRotina` | Log das rotinas e do relógio simulado |
| `MotivoPerda` | Motivos de perda editáveis (código, nome, pergunta extra, ordem, ativo). O lead guarda o código. Motivo em uso só desativa. Os 5 originais entram sozinhos na primeira consulta |
| `Instrucao` | Instruções do bot (título, texto, ordem, ativa, versão anterior). `tipo`: `roteiro` (numeradas, coladas pelo admin) ou `manual` (o Manual do CRM: um só, ordem 0, sempre ativo, título fixo) |
| `UsoApi` | Uma linha por chamada à API de texto (Claude ou GPT, sem distinguir): só contadores de tokens (sem texto de cliente). Alimenta "Uso do bot" em Configurações |
| `LogWebhook` | Log do que a Meta mandou e dos envios (sem conteúdo das mensagens, só tipo e final do telefone). Apagado após 14 dias |
| `PedidoLgpd` | Registro de exclusões e exportações de dados de cliente (só ação, quem fez e os 4 últimos dígitos do telefone) |

## Telas (`src/app/(app)`)
| Arquivo | Tela |
|---|---|
| `src/app/layout.tsx` | Layout raiz (fonte). O sistema é só escuro |
| `src/app/globals.css` | Estilos globais e as classes de "tecla" dos botões (`tecla`, `tecla-pri`, `tecla-perigo`) e `afundado` (selecionado), com `menu-fundo`, `menu-ativo` e `menu-ativo-filete` (luz e filete do menu lateral). No fim, o fundo, halo, anel do clique e entrada do cartão do login (`login-*`) |
| `src/app/tokens.css` | Design tokens: todas as cores, sombras, raios e espaços. Paleta azul-ardósia do modelo do Mateus; sistema só escuro. No fim, os temas de cor (`:root[data-tema=...]`, seis paletas que só informam as cores-base; o resto sai por mistura) |
| `src/app/login/page.tsx` | Login: esfera de pontos "Eccellenza" centralizada acima do cartão (título ECCELLENZA, "CRM de atendimento"), nas cores do tema deste aparelho. Sem 3D no navegador, mostra o nome parado. Estilos `login-*` em `globals.css` |
| `src/app/manifest.ts` | App instalável (PWA): nome, cores e ícones (`public/icone-*.png`, `public/apple-touch-icon.png`, o "E" azul provisório). Sem service worker e sem avisos de propósito (decisão do Mateus). No iPhone: Safari > Compartilhar > Adicionar à Tela de Início |
| `src/app/(app)/layout.tsx` | Moldura das telas logadas: exige login e põe cabeçalho, avisos e versão dos dados |
| `src/app/(app)/page.tsx` | Kanban |
| `src/app/(app)/lead/[id]/page.tsx` | Ficha completa do lead (dados, medidas, notas, histórico). O dia a dia usa a gaveta (`componentes/ficha/gaveta.tsx`) |
| `src/app/(app)/agenda/page.tsx` | Agenda |
| `src/app/(app)/painel/page.tsx` | Painel de métricas. Só admin (consultor volta ao Kanban; o menu também esconde o link) |
| `src/app/(app)/simulador/page.tsx` | Simulador (chat do cliente fictício) |
| `src/app/(app)/galeria/page.tsx` | Galeria de imagens, vídeos e PDFs |
| `src/app/privacidade/page.tsx` | Política de privacidade PÚBLICA (sem login; a Meta e os clientes abrem). Rascunho até `PRIVACIDADE_APROVADA=1`; contato em `PRIVACIDADE_CONTATO` |
| `src/app/exclusao-de-dados/page.tsx` | Instruções PÚBLICAS de exclusão de dados (sem login; endereço que a Meta pede nas configurações do app). Texto em `regras/privacidade.ts` (`secoesExclusao`), aprovado pelo Mateus em 05/11/2026; mesmo aviso de rascunho da política |
| `src/app/(app)/arquivados/page.tsx` | Arquivados |
| `src/app/(app)/configuracoes/page.tsx` | Configurações (só admin) |

## API (`src/app/api`) → serviço que usa
| Rota | O que faz | Serviço |
|---|---|---|
| `src/app/api/login/route.ts` | Entrar (limite de 5 erros em 15 min; cookie Secure só em https) | `lib/sessao`, `regras/tentativas-login` |
| `src/app/api/versao/route.ts` | Contador de mudanças (as telas recarregam). A cada consulta também confere os prazos vermelhos de espera e os retornos que chegaram na hora (falha aqui não derruba a rota) | `lib/versao`, `alertas` |
| `src/app/api/kanban/route.ts` | Cards do quadro (já ordenados) | `consultas`, `rotinas` |
| `src/app/api/alertas/route.ts` | Avisos novos para o usuário (`?depois=N`). Consultor: os dos seus leads; admin: todos | `alertas` |
| `src/app/api/retornos/route.ts` | "Retornos de hoje": leads em Orçamento/Negociação com retorno hoje, atrasado ou sem data (consultor: os dele; admin: todos) | `consultas` |
| `src/app/api/janelas/route.ts` | "Janelas fechando" (tarefa 37): leads em etapa aberta com a janela de 24h ainda aberta (consultor: os dele; admin: todos). A tela filtra os de menos de 2 h | `consultas` |
| `src/app/api/aguardando/route.ts` | Leads esperando um humano (consultor: os dele; admin: todos) e os prazos de cor. Alimenta o contador do topo, a lista e a cor dos cards | `consultas`, `configuracoes` |
| `src/app/api/leads/[id]/route.ts` | Ficha e correção de dados (inclui `venda`: data do retorno, valores, motivo) | `consultas`, `leads`, `historico` |
| `src/app/api/leads/[id]/conversa/route.ts` | Assumir, devolver ao bot, responder, marcar como vista (zera a bolinha) | `conversa` |
| `src/app/api/leads/[id]/medidas/route.ts` | Medidas | `leads`, `historico` |
| `src/app/api/leads/[id]/notas/route.ts` | Notas internas | `historico` |
| `src/app/api/leads/acoes/route.ts` | Mover (com os dados de venda e `cancelarCompromissos`; confere o lote todo antes), arquivar, excluir em lote (exclusão grava o registro LGPD) | `leads`, `lgpd` |
| `src/app/api/arquivados/route.ts` | Lista de arquivados | `consultas`, `rotinas` |
| `src/app/api/agenda/route.ts` | Agenda, visitas, bloqueios; com `livresPara` (+ `diaLivre`), horários livres em torno do dia escolhido | `agenda`, `consultas` |
| `src/app/api/painel/route.ts` | Métricas (atalho ou datas, filtro de vendedor). Só admin (`ver_metricas`; consultor recebe 403) | `painel` |
| `src/app/api/nova-mensagem/route.ts` | Mensagem para qualquer número (MSG). Acha o cliente com ou sem o 9; modelo exige consentimento (pede como o cliente autorizou) e não vale para quem pediu para parar | `conversa`, `leads`, `lgpd`, `consultas` |
| `src/app/api/simulador/route.ts` | Chat do cliente fictício. 404 fora do modo simulador | `conversa`, `mensagens`, `consultas` |
| `src/app/api/relogio/route.ts` | Avançar o relógio (horas ou 5–59 minutos) e rodar rotinas. 404 fora do modo simulador | `rotinas` |
| `src/app/api/teste/route.ts` | Interface de teste (`npm run simular`, cliente-simulado) | `conversa`, `rotinas`, `consultas` |
| `src/app/api/equipe/status/route.ts` | Consultor online/almoço/offline. Só volta quando ele (ou o admin) clica; offline sozinho só no fechamento da loja (rotina de presença) | `distribuicao` |
| `src/app/api/equipe/passar-hoje/route.ts` | GET: o que o vendedor ausente tem hoje e para quem dá para passar. POST: passar os leads e compromissos de hoje (qualquer logado; vai na ficha com o nome de quem passou) | `presenca` |
| `src/app/api/configuracoes/retorno-fechada/route.ts` | Gravar as regras do retorno com a loja fechada (só admin) | `configuracoes` |
| `src/app/api/configuracoes/presenca/route.ts` | Gravar as regras de presença e fila (só admin) | `configuracoes` |
| `src/app/api/configuracoes/usuarios/route.ts` | Criar usuário (só admin) | `usuarios` |
| `src/app/api/configuracoes/usuarios/[id]/route.ts` | Editar nome/perfil, redefinir senha, desativar/reativar (desativar consultor com leads exige `transferirPara`). Só admin | `usuarios` |
| `src/app/api/configuracoes/usuarios/transferir/route.ts` | Passar os leads em andamento de um consultor para outro. Só admin | `distribuicao` |
| `src/app/api/leads/[id]/transferir/route.ts` | Passar UM lead para outro consultor ativo (a ficha usa; o PATCH da ficha não troca mais o consultor). Só admin | `distribuicao` |
| `src/app/api/conta/senha/route.ts` | Trocar a própria senha (pede a atual; 5 erros em 15 min bloqueiam) | `usuarios` |
| `src/app/api/midias/[nome]/route.ts` | Serve imagem, vídeo (com Range) e documentos (PDF, Word, Excel, DWG: sempre baixam, nunca abrem dentro do site) (só logado); cabeçalhos de segurança.  Estava fora do Git por causa do `.gitignore` (`midias/`); agora o `.gitignore` só ignora `/midias/` da raiz | `lib/midias` |
| `src/app/api/configuracoes/route.ts` | Dados da tela de Configurações (inclui o período padrão da exportação) | `configuracoes`, `distribuicao` |
| `src/app/api/whatsapp/webhook/route.ts` | Webhook da Meta: GET verifica o token; POST valida a assinatura, GRAVA o evento (caixa de entrada) e responde 200; processa depois (a rotina reprocessa o que ficar pendente). Pública de propósito (a assinatura protege) | `whatsapp`, `regras/whatsapp` |
| `src/app/api/leads/[id]/anexo/route.ts` | Vendedor envia imagem, vídeo (MP4) ou PDF ao cliente, com legenda. Só dentro das 24h | `conversa` |
| `src/app/api/galeria/route.ts` | Galeria: mídias dos leads do vendedor (admin: todas, filtra por vendedor e tipo) | `midias` |
| `src/app/api/mensagens/[id]/midia/route.ts` | Apagar um arquivo de uma conversa. Só admin (`apagar_midia`) | `midias` |
| `src/app/api/midias/resumo/route.ts` | Antes de excluir leads: quantos arquivos e MB vão junto (por ids ou por coluna). Só quem pode excluir | `midias` |
| `src/app/api/configuracoes/armazenamento/route.ts` | Espaço ocupado pelas mídias (`MIDIAS_LIMITE_MB` mostra a porcentagem). Só admin | `midias` |
| `src/app/api/saude/route.ts` | "Está de pé?" para o Railway (pública, sem dados) | `lib/db` |
| `src/app/api/leads/[id]/exportar/route.ts` | LGPD: baixa todos os dados de um cliente (.zip). Só admin | `lgpd` |
| `src/app/api/configuracoes/whatsapp/route.ts` | Situação do WhatsApp (modo, nomes das variáveis que faltam, log do webhook). Só admin | `whatsapp`, `lib/whatsapp-config` |
| `src/app/api/configuracoes/chaves/route.ts` | Chaves de API (Anthropic e OpenAI): situação (só "configurada" e os 4 últimos caracteres), salvar, remover. Só admin | `chaves-api` |
| `src/app/api/configuracoes/provedor-bot/route.ts` | Ler/gravar qual IA atende o texto (Claude ou GPT) e o modelo de cada uma (grava só os campos enviados). Só admin | `provedor-bot` |
| `src/app/api/configuracoes/modelos-ia/route.ts` | Modelos disponíveis na conta da empresa (`?provedor=claude|openai`) para a escolha na tela. Só admin | `modelos-ia` |
| `src/app/api/configuracoes/uso-bot/route.ts` | Uso da API do Claude nos últimos 30 dias. Só admin | `uso-api` |
| `src/app/api/configuracoes/exportar-desempenho/route.ts` | Exporta .zip de desempenho de um vendedor (até 30 dias, mídia opcional). Só admin | `exportacao` |
| `src/app/api/configuracoes/vendas/route.ts` | Interruptor do próximo contato em Negociação e CRUD dos motivos de perda (criar, editar, ativar/desativar, reordenar, excluir). Só admin | `vendas` |
| `src/app/api/push/route.ts` | Avisos com o CRM fechado (Web Push): GET devolve a chave pública do servidor e se este navegador já está ligado; POST liga este navegador; DELETE desliga. Qualquer usuário logado, cada um no seu navegador | `push` |
| `src/app/api/push/teste/route.ts` | "Testar com o CRM minimizado" do sino: manda um aviso de teste em 5 s só para os navegadores de quem pediu | `push` |
| `src/app/api/etapas/route.ts` | Nomes das colunas do Kanban: GET qualquer usuário logado; PUT só admin (`configurar`), nome vazio volta ao de fábrica, nomes repetidos recusados | `etapas` |
| `src/app/api/vendas/regras/route.ts` | Regras de vendas e motivos para a janela de mover, a ficha e o card (qualquer usuário logado) | `vendas` |
| `src/app/api/configuracoes/distribuicao/route.ts` | Modo de distribuição | `configuracoes` |
| `src/app/api/configuracoes/prazos-espera/route.ts` | Prazos amarelo e vermelho da espera do cliente (minutos, PROVISÓRIO). Só admin | `configuracoes` |
| `src/app/api/configuracoes/agenda/route.ts` | Gravar as regras da agenda (só admin) | `configuracoes` |
| `src/app/api/configuracoes/instrucoes/route.ts` | Listar (numeradas + manual) e criar instruções | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/[id]/route.ts` | Editar, ativar/desativar, excluir (o manual só edita o texto) | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/[id]/voltar/route.ts` | Voltar para a versão anterior | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/manual-do-codigo/route.ts` | Botão "Usar o texto do código": Manual volta ao texto do código (o da tela fica como anterior) | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/reordenar/route.ts` | Reordenar | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/importar/route.ts` | Importar instruções de arquivos .txt (vários de uma vez; só admin) | `instrucoes`, `regras/importar-instrucoes` |
| `src/app/api/configuracoes/instrucoes/exportar/route.ts` | Exportar .txt ou .zip | `instrucoes`, `lib/zip` |

## Serviços (`src/servicos`) – gravam no banco
| Arquivo | Faz |
|---|---|
| `src/servicos/leads.ts` | Criar lead (acha o mesmo cliente com e sem o 9: `acharLeadPorTelefone`), mover etapa (voltar para Em qualificação com medição/apresentação marcada pede `cancelarCompromissos` e cancela o compromisso; ir para Perdido guarda a coluna anterior; `etapaAntesDoPerdido` descobre para onde voltar; recusa se faltar próximo contato, valor fechado ou motivo da perda; `conferirMudanca` só confere, sem gravar; também troca data/valores sem mudar de etapa), etiquetas, campos, arquivar, restaurar, excluir |
| `src/servicos/mensagens.ts` | Registrar mensagem do cliente e da loja (envio real pela Meta quando as chaves existem; senão simulado; em produção sem chaves a mensagem fica "falhou"), status (entregue/lido: o real vem do webhook). Cliente em Perdido que escreve volta o card para a coluna em que estava. Mantém `esperandoDesde` e `naoLidas`: mensagem do cliente com lead aguardando humano abre a espera e soma a bolinha; resposta do consultor encerra |
| `src/servicos/conversa.ts` | Mensagem do cliente → bot; assumir, devolver (encerra a espera), responder como consultor, marcar conversa como vista |
| `src/servicos/agenda.ts` | Horários livres por tipo de compromisso (`horariosLivresEmTorno`: dia escolhido no calendário, véspera e dia seguinte, sem o limite de dias à frente; hoje conta, a partir da próxima hora cheia), agendar (move o card: `etapaAoAgendar`; recusa horário antes da próxima hora cheia), cancelar (volta para Em qualificação), bloqueios |
| `src/servicos/conversao-funil.ts` | Conversão única das colunas antigas (Visita agendada, Orçamento apresentado, Sem resposta) para as novas, rodada ao subir o servidor |
| `src/servicos/distribuicao.ts` | Escolher consultor (rodízio ou menos leads), fila, status almoço (só muda por clique), `transferirLeads` (todos os leads em andamento de um consultor para outro) e `transferirLead` (um lead só), ambos com registro na ficha |
| `src/servicos/configuracoes.ts` | Ler/gravar configurações, modo de distribuição, prazos de espera |
| `src/servicos/push.ts` | Avisos com o CRM fechado (biblioteca `web-push`): chaves VAPID (variáveis `VAPID_*` ou criadas sozinhas e guardadas no banco, a privada criptografada com a `CHAVE_MESTRA`), contato VAPID válido para a Apple (`PUSH_CONTATO` ou o endereço público do Railway), guardar/cancelar o navegador de cada pessoa, enviar o aviso de cada alerta (`registrarAlerta` chama) a quem deve receber, remover navegador morto (404/410), aviso de teste. Nunca lança |
| `src/servicos/etapas.ts` | Nomes das colunas do Kanban: ler (de fábrica + o que o admin trocou, chave `nomes_etapas` em `Configuracao`) e renomear (valida, recusa repetido, guarda só o que difere do padrão) |
| `src/servicos/instrucoes.ts` | Instruções do bot: CRUD das numeradas, importar de arquivos .txt (tudo ou nada; atualizar guarda a versão anterior), Manual do CRM (cria uma vez; em banco antigo converte a antiga 15 e tira a 14), versão anterior, exportar; troca sozinho o Manual desatualizado (tarefa 38) e diz se está diferente do código |
| `src/servicos/exportacao.ts` | Monta o .zip de desempenho do vendedor: resumo, leads, mudanças de etapa, uma conversa por lead, mídias (opcional). Sem telefone/nome do cliente. Bot e consultor separados |
| `src/servicos/consultas.ts` | Dados prontos para as telas (`janelasAbertas` para o botão "Janelas fechando"; cards e ficha trazem os dados de venda) (kanban, ficha, agenda, arquivados, lista de aguardando). O kanban sai ordenado: quem espera resposta primeiro, depois pela última mensagem |
| `src/servicos/painel.ts` | Dados do Painel por período e vendedor (inclui `janelas`: leads ativos com a janela de 24h aberta e fechando, de agora) (inclui "Clientes que faltaram": medição/apresentação remarcada depois da data): contadores anônimos (geral) ou leads do vendedor, funil, tempo de resposta (bot e consultor) e vendas (total em negociação agora, total vendido e motivos de perda no período) Tarefa 21: apresentações e medições agendadas (principal), apresentações por consultor e conversão da agenda (`conversoesDoPeriodo`, a partir da tabela `Visita`). |
| `src/servicos/resumo.ts` | Resumo da ficha para o consultor copiar |
| `src/servicos/alertas.ts` | Guarda o aviso (mensagem do cliente, bot passou o lead, bot marcou visita, hora do retorno, decisão vencida uma vez por dia) e entrega os novos por usuário. Limpa os de mais de 1 dia. `avisarRetornos`: avisa o dono do lead (e o admin) na hora do próximo contato, uma vez por data marcada. `avisarPrazosVermelhos`: avisa o admin uma vez por espera quando um lead passa do prazo vermelho |
| `src/servicos/historico.ts` | Registro de quem mudou o quê |
| `src/servicos/metricas.ts` | Contadores anônimos |
| `src/servicos/rotinas.ts` | Retomada (pula quem pediu para parar), "Parou de responder" (Perdido), limpeza de arquivados (30 dias; quem está em Fechado espera 180 dias) e exclusão de clientes que fecharam 180 dias depois do fechamento (com registro LGPD), limpeza de logs antigos, relógio (também confere os prazos vermelhos) |
| `src/servicos/retorno-fechada.ts` | Rotina do retorno automático: no horário do retorno marcado pelo bot (`Lead.retornoModeloEm` igual a `proximoContatoEm`), com a janela de 24h fechada, envia o modelo; só com dono online (senão passa para quem está online; ninguém online: espera e avisa todos `retorno_sem_online`); nunca para quem pediu parar |
| `src/servicos/presenca.ts` | Rotinas de presença (a cada minuto, com marca por fechamento/abertura para não repetir): offline no fechamento, repartir a fila, verificar presença (aviso `ausencia`), aviso de compromisso cedo; `passarOsDeHoje` (leads com compromisso ou retorno hoje + visitas de hoje; horário ocupado do destino fica de fora) e `resumoDeHoje` |
| `src/servicos/agendador.ts` | Liga as rotinas de minuto em minuto no servidor (produção ou `ROTINAS_AUTO=1`), uma vez por processo, erro não derruba |
| `src/servicos/whatsapp.ts` | Meta: enviar texto/modelo (para o `wa_id`), status "entregue"/"lido" que chega antes da mensagem estar gravada fica pendente e é reaplicado (2 s, 10 s, 1 min, depois a rotina), baixar imagem e áudio (só de hosts da Meta, https, sem redirecionamento, com limite de tamanho), processar mensagens e status do webhook (sem duplicar), áudio → texto, caixa de entrada (`guardarEvento`, `processarEventoGuardado`, `reprocessarEventosPendentes`), log do webhook |
| `src/servicos/midias.ts` | Apagar arquivo de mensagem (fica o aviso na conversa; só um pedido ganha se dois chegarem juntos), limpeza automática de mídia com mais de 180 dias (um erro não para os outros), varredura de arquivos soltos sem mensagem (mais de 1 dia), resumo para o aviso de exclusão, armazenamento e galeria por vendedor |
| `src/servicos/chaves-api.ts` | Chaves de API da tela (Configurações > Chaves de API), uma por empresa: `anthropic` (Claude) e `openai` (GPT no texto e transcrição de áudio). `obterChave` (a da tela, criptografada no banco, vale mais que a variável de ambiente), salvar, remover, situação. No banco ficaram os nomes antigos (`api_chave_texto` = Anthropic, `api_chave_audio` = OpenAI). Em produção exige `CHAVE_MESTRA`; no computador usa o segredo local |
| `src/servicos/provedor-bot.ts` | Qual IA atende o texto (`claude` padrão ou `openai`) e o modelo de cada uma (padrões em `regras/modelos-ia.ts`). Chaves `bot_provedor`, `bot_modelo_claude` e `bot_modelo_openai` em `Configuracao` |
| `src/servicos/modelos-ia.ts` | Lista de modelos buscada na conta da Anthropic ou da OpenAI (com a chave de cada uma); sem chave ou com erro devolve a lista de reserva e o motivo. Nunca lança nem expõe a chave |
| `src/servicos/transcricao.ts` | Áudio → texto com o Whisper da OpenAI (chave OpenAI da tela ou `OPENAI_API_KEY`; modelo padrão `gpt-4o-mini-transcribe`, troca por `OPENAI_TRANSCRICAO_MODELO`). Só devolve texto; o áudio não é guardado. Nunca lança |
| `src/servicos/lgpd.ts` | Pedido de parar (etiqueta, confirmação PROVISÓRIA), liberar, registrar consentimento, exportar dados do cliente (.zip), excluir com registro |
| `src/servicos/uso-api.ts` | Guarda e soma o uso da API do Claude |
| `src/servicos/usuarios.ts` | Criar usuário, listar equipe (com leads em andamento), editar, redefinir senha, trocar a própria senha, desativar/reativar (nunca o último admin ativo, nunca a si mesmo; consultor com leads só com destino) e criar o primeiro admin a partir de `ADMIN_*` |

## Regras puras (`src/regras`)
| Arquivo | Regra |
|---|---|
| `src/regras/vendas.ts` | Acompanhamento de vendas: motivos de fábrica (carga inicial), dinheiro (centavos ↔ "R$ 1.621,00"), o que cada etapa exige para receber o card (próximo contato, valor fechado, motivo da perda; Negociação conforme o interruptor), data/hora de Fortaleza e situação do retorno (hoje, atrasado, sem data) |
| `src/regras/etapas.ts` | Colunas do kanban (funil da tarefa 21), funil do painel, colunas que exigem compromisso na agenda, códigos antigos, etiquetas, classificações (cidades e faixas ficam só nas instruções) |
| `src/regras/agenda.ts` | Regras da agenda como parâmetro (`primeiroHorarioPossivel`: marcar no mesmo dia vale a partir da próxima hora cheia; `primeiroDiaAgendavel`) (`RegrasAgenda`, padrão PROVISÓRIO, validação, vagas livres, janela). Não lê banco Tipos de compromisso (visita à loja, medição, apresentação), duração por tipo, medição não ocupa a loja. |
| `src/regras/retomada.ts` | Quando retomar e quando ir para Perdido ("Parou de responder"). Lead classificado como pós-venda nunca recebe retomada nem vai sozinho para Perdido |
| `src/regras/decisao.ts` | Decisão pendente do vendedor: data vencida (do dia seguinte em diante) de medição, apresentação ou retorno da Negociação; textos da etiqueta |
| `src/regras/janela24h.ts` | Texto livre só até 24h depois do cliente (Meta); `janelasFechando` (menos de 2 h), `resumoDasJanelas` (painel) e `situacaoDaJanela` dá faixa (verde/amarelo/vermelho/fechada, limites 6 h e 2 h PROVISÓRIOS), tempo restante e fração para o relógio do card (tarefa 37) |
| `src/regras/modelos.ts` | Modelos de mensagem aprovados na Meta (08/11/2026): nome = código, texto e botões idênticos aos da Meta. Lembretes (`lembrete_medicao`, `lembrete_apresentacao`) têm `compromisso` e as variáveis nomeadas `{{data}}`/`{{hora}}`, preenchidas com o próximo compromisso do tipo na agenda (`variaveisDoHorario`, `proximoCompromisso`, `preencherModelo`; sem compromisso, `faltaParaLembrete` recusa). `MODELOS_SEM_COMPROMISSO`: os que servem no envio automático e na mensagem para número novo |
| `src/regras/distribuicao.ts` | Modos de distribuição de leads |
| `src/regras/espera.ts` | Espera do cliente por um humano: faixa (normal, amarelo, vermelho), prazos padrão PROVISÓRIOS (10 e 30 min), desde quando o lead espera, validação, texto "12 min", ordem das colunas `idsCriticosDaColuna` (tarefa 33, PROVISÓRIO): só o pior vermelho da coluna (ou 24 h+) ganha o fundo vermelho inteiro |
| `src/regras/retorno-fechada.ts` | Retorno com a loja fechada: regras (padrão, validação) e `horarioDoRetorno` (sem horário escolhido: reabertura + X min; horário pedido com a loja fechada ou no passado o bot nem grava: `registrar_retorno` devolve o horário de atendimento para ele informar o cliente) |
| `src/regras/presenca.ts` | Presença e fila da loja fechada: regras (padrão, validação), loja aberta/fechada pela agenda, último fechamento, abertura atual, horários de repartir e verificar, `filaPodeSerEntregue`, `leadNovoPodeTerDono`, resumo dos itens do dia |
| `src/regras/almoco.ts` | Aviso ao cliente durante o almoço do consultor |
| `src/regras/permissoes.ts` | Quem pode o quê |
| `src/regras/proximo-passo.ts` | "Próximo passo" da gaveta e da ficha (09/11/2026): lista do que pede ação no lead (cliente esperando, janela de 24h fechando, decisão pendente, lembrete, compromissos), com a urgência (vermelho = atrasado/vencido/esperando além do prazo, amarelo = hoje, neutro = futuro) e a ordem (mais urgente primeiro). Datas relativas ("hoje, 16h", "amanhã, 9h") |
| `src/regras/limites.ts` | Limites usados na tela e no servidor (tamanho máximo de imagem) |
| `src/regras/limpeza.ts` | Quando um arquivado é excluído (30 dias) e quando um cliente que fechou é excluído (180 dias depois de fechar) |
| `src/regras/exportacao.ts` | Exportação de desempenho: período (máx. 30 dias), CSV |
| `src/regras/tempo-resposta.ts` | Tempo de resposta: por turno do cliente (bot ou consultor primeiro), do consultor em toda resposta (ignora o bot), 1ª resposta do consultor depois do repasse do bot; média/mediana e formatar duração. Usado pelo Painel e pela exportação |
| `src/regras/painel.ts` | Período do Painel: atalhos (hoje, 7 dias, 30 dias, semana, mês), datas livres, período anterior do mesmo tamanho |
| `src/regras/alertas.ts` | Avisos: texto de cada tipo (inclui o do retorno) ("para você" ou o nome do consultor), número no título da aba, preferências guardadas no navegador `agruparAlertas`/`textoDoGrupo`: avisos do mesmo tipo que chegam juntos viram um toast só (tarefa 25) |
| `src/regras/telefone.ts` | Telefone E.164, nome de exibição do lead e `variantesTelefone` (Brasil com e sem o 9) |
| `src/regras/tempo.ts` | Fuso de Fortaleza e contas de data |
| `src/regras/whatsapp.ts` | Webhook da Meta (e os textos que o bot recebe para áudio que falhou e tipos não suportados): assinatura HMAC, verificação do token, leitura do payload (texto, imagem, botões, tipos não suportados, status) |
| `src/regras/limite-bot.ts` | Limite de mensagens do cliente por minuto e por dia (8 e 150) |
| `src/regras/optout.ts` | Frases que contam como "parar" (a mensagem inteira) e o texto de confirmação (aprovado) |
| `src/regras/tentativas-login.ts` | Limite de tentativas de login (5 erros em 15 min) |
| `src/regras/chaves-api.ts` | Chaves de API: tipos (anthropic, openai), rótulos, conferência de formato e o final mostrável. Sem criptografia aqui (fica em `lib/cifra.ts`) |
| `src/regras/modelos-ia.ts` | Modelos de IA para a escolha: filtro da lista de cada empresa (Claude: o mais novo de cada família da geração 5+; GPT: só conversa, sem versão datada, até 8), frase de cada modelo, lista de reserva do Claude, padrões (`claude-sonnet-5-5`; GPT PROVISÓRIO `gpt-5.5`) |
| `src/regras/push.ts` | Web Push, só regra: quem recebe (admin tudo; consultor só os seus leads e nunca prazo vencido) e como o aviso é escrito (mensagem nova = nome do cliente no título + trecho de 110 letras; os outros usam `textoDoAlerta`) |
| `src/regras/temas.ts` | Temas de cor: código, nome e as 6 cores da bolinha. As cores de verdade ficam em `tokens.css` |
| `src/regras/senha.ts` | Regra da senha (decisão do Mateus 03/11/2026): mínimo 6, com letra, número e uma maiúscula |

## Bot (`src/bot`)
| Arquivo | Faz |
|---|---|
| `src/bot/atendimento.ts` | Chama a IA do texto (Claude, padrão, ou GPT conforme `servicos/provedor-bot`, com o modelo escolhido na tela e a chave da empresa; reserva automática de recusa só em Sonnet/Opus/Fable): histórico, cache, laço de ferramentas. As duas voltas (`voltaComClaude`, `voltaComGpt`) devolvem o mesmo formato. O bot só lê texto (áudio chega transcrito) e imagem (bloco `image`); PDF, vídeo e outros arquivos viram só um aviso de que chegaram (decisão do Mateus 05/11/2026) |
| `src/bot/openai-conversao.ts` | Funções puras: histórico guardado (formato Anthropic) ↔ mensagens/ferramentas/resposta da OpenAI. Permite trocar Claude/GPT no meio da conversa |
| `src/bot/avisos.ts` | Textos fixos que o bot recebe: abertura do prompt e avisos de cada mensagem (`<sistema>` com hora/loja/nome do perfil, arquivo que o bot não lê, imagem, mensagem de consultor/sistema). Funções puras, usadas pelo bot e pelo contrato do bot (tarefa 38) |
| `src/bot/prompt.ts` | Monta o prompt: abertura fixa (de `avisos.ts`) + instruções numeradas ativas + Manual do CRM, tudo do banco. Não lê nenhum arquivo |
| `src/bot/manual-inicial.ts` | Texto do Manual do CRM. Só muda aqui, com aprovação do Mateus; o sistema troca sozinho o do banco se ninguém editou na tela (ver `manual-versoes.ts`) |
| `src/bot/manual-versoes.ts` | Impressão (sha256) de cada versão do Manual que o código já teve e a regra `situacaoDoManual` (igual, desatualizado → troca sozinho, editado → aviso na tela, voltou → respeita) |
| `src/bot/ferramentas.ts` | Esquemas das ferramentas e validação (inclui `registrar_retorno`, tarefa 36). O bot não agenda (sem ferramenta de horários/agendamento) |
| `src/bot/executor.ts` | Executa cada ferramenta (grava no CRM) |
| `src/bot/contrato.ts` | Monta o contrato do bot (`docs/contrato-do-bot.md`, tarefa 38): prompt, avisos de cada mensagem, ferramentas, o que o sistema faz sozinho e o Manual, a partir das mesmas constantes do bot. Função pura, sem data. Lido pelo agente das instruções (outro repositório) |
| `src/bot/saida.ts` | Limpa o texto do bot antes de ir ao cliente e junta os textos das voltas sem repetir fala igual |

## Componentes (`src/componentes`)
| Arquivo | Faz |
|---|---|
| `src/componentes/ui.tsx` | Peças comuns: Botao, Modal, Campo, Avatar, Etiqueta, estados vazio/erro `Popover` (tarefa 27): conteúdo ancorado num botão, fecha com Esc/clique fora, folha de baixo no celular. `Dica` (tarefa 29): ícone ⓘ com tooltip ao passar o mouse/focar |
| `src/componentes/dados.tsx` | `chamarApi`, `useDados` (recarrega com a versão), avisos (toasts) Toasts (tarefa 25): canto inferior direito, até 3 visíveis + "e mais N", somem sozinhos (ok/erro 6 s, alerta 15 s), pausa com o mouse, botão de ação opcional (`avisar(texto, tipo, { acao })`) |
| `src/componentes/estilos.ts` | Cores por código e `juntar` |
| `src/componentes/titulo-tela.tsx` | Título da barra de cima definido pela tela (`useDefinirTituloTela`): a ficha mostra avatar, nome, telefone e etapa do cliente no lugar de "Ficha do lead" (tarefa 28) |
| `src/componentes/cabecalho.tsx` | Barra de cima: título da tela e ações ("Retornos N", "Esperando N" com texto a partir de 1280px, Nova mensagem, avisos, menu do avatar). No celular tem que caber em 375px sem rolar para o lado |
| `src/componentes/menu-usuario.tsx` | Menu do avatar (tarefa 26): nome e perfil, Avisos (abre a janela do antigo sino), trocar minha senha, tema de cores (atalho do Configurações > Temas) e sair |
| `src/componentes/menu-lateral.tsx` | Menu lateral (computador), em grupos separados por traço (trabalho do dia · Arquivados · Simulador, tarefa 32). Fundo com a luz da marca no topo (`menu-fundo`), logo = mini esfera + "ECCELLENZA" espaçado (como o login). Aberto: um indicador afundado, com luz e filete da marca (`menu-ativo`), desliza por cima da barra toda, inclusive até Configurações no rodapé; encolhido: entalhe flutuante (inclui Configurações). Guarda a escolha de encolher. No celular vira a barra de baixo, com a bolinha do entalhe |
| `src/componentes/menu-esfera.tsx` | `MenuEsfera`: mini esfera de pontos do topo do menu lateral, em canvas 2D (sem Three.js, que só baixa no login). Gira devagar; parada com "reduzir movimento"; cor do tema (`--color-marca-texto`) e acompanha a troca de tema |
| `src/componentes/entalhe/geometria.ts` | Contas puras do entalhe flutuante (modelo `docs/referencia/modelos_interacao.html`, barra 3: salto, abertura, recorte em caminho SVG, nas duas orientações) e a mola |
| `src/componentes/entalhe/entalhe.tsx` | `Entalhe`: recorte + pílula que salta e pousa no item novo. Usado só no menu (encolhido no computador e barra de baixo do celular). Anima direto no DOM; respeita "reduzir movimento" |
| `src/componentes/entalhe/pilula.tsx` | `Pilula`: pílula elástica (barra 1 da referência), em vidro escuro nas abas e como anel nos temas. Duas bordas em molas diferentes: a da frente chega primeiro e a de trás alcança com um leve estalo |
| `src/componentes/entalhe/abas.tsx` | `Abas`: PADRÃO de qualquer escolha de abas ou filtro de uma opção só (Configurações, Galeria, Painel, Agenda, ficha no celular), com a pílula elástica. Use no lugar de botões `role="tab"` soltos |
| `src/componentes/espera.tsx` | Espera do cliente na tela: provedor (uma consulta a `/api/aguardando` para a tela toda), hora do servidor, tempo e faixa de cor, classes de cor |
| `src/componentes/alertas/provedor.tsx` | Busca os avisos novos a cada mudança de versão, toca o som, mostra a notificação do navegador (aba em segundo plano; não mostra se este navegador recebe o Web Push, para o aviso não sair em dobro) ou o aviso na tela (aba na frente) e põe "(3)" no título da aba |
| `src/componentes/alertas/janela-avisos.tsx` | Janela "Avisos" aberta pelo menu do usuário (o sino saiu do topo para caber no celular em pé): liga/desliga som, notificações do Windows (escondidas no iPhone) e avisos com o CRM fechado, testar aviso; textos próprios do iPhone. Também renova o push ao abrir o CRM |
| `src/componentes/alertas/push.ts` | Lado do navegador do Web Push: registrar `/sw.js`, pedir permissão, assinar, ligar/desligar, pausar ao sair do CRM e renovar ao abrir (quem já ligou neste navegador), saber se é iPhone |
| `src/componentes/alertas/som.ts` | Som feito no navegador (sem arquivo de áudio) |
| `src/componentes/retornos.tsx` | Botão "Retornos de hoje" no topo (com retorno vencendo, pisca em âmbar: `animate-chamar` em `tokens.css`) e a lista, provedor (uma consulta a `/api/retornos` para a tela toda), situação e destaque do retorno no card |
| `src/componentes/janelas.tsx` | Botão "Janelas fechando" no topo (tarefa 37): leads com menos de 2 h de texto livre, do mais urgente ao menos, com a prévia; provedor com uma consulta a `/api/janelas`. O filtro usa o relógio do servidor, então a lista anda sozinha |
| `src/componentes/aguardando.tsx` | Botão "X aguardando você" no topo e a lista que ele abre |
| `src/componentes/vendas/regras.tsx` | Provedor das regras de vendas (uma consulta para a tela toda): motivos e se Negociação exige o retorno |
| `src/componentes/vendas/janela-mudanca.tsx` | Janela que pede o que a etapa exige ao mover o card (Negociação: próximo contato + valor do orçamento; valor fechado; motivo da perda) e `CampoDinheiro` (máscara R$ 1.621,00, biblioteca react-currency-input-field). Usada no quadro e na ficha |
| `src/componentes/etapas.tsx` | Provedor dos nomes das colunas (uma consulta a `/api/etapas` para a tela toda): `useNomesEtapas` entrega `nome(codigo)`, `lista` e `renomear`. Usado no Kanban, menu de mover, ficha, janela de mover e retornos |
| `src/componentes/usuario.tsx` | Usuário logado no contexto |
| `src/componentes/texto.ts` | Formatação de texto |
| `src/componentes/chat.tsx` | Bolhas de conversa |
| `src/componentes/presenca.tsx` | Botões do consultor no cabeçalho: "Ficar online" / "Offline" e almoço |
| `src/componentes/equipe/passar-hoje.tsx` | Janela "Passar os de hoje" (aviso de ausência e cartão Equipe) |
| `src/componentes/nova-mensagem.tsx` | Janela de nova mensagem |
| `src/componentes/arquivados.tsx` | Lista de arquivados (Excluir discreto, em vermelho, afastado de Restaurar) |
| `src/componentes/kanban/decisao.tsx` | Janela de decisão da data vencida (medição feita/remarcar/desistiu; fechou/negociando/não veio/desistiu; fechou/ainda negociando/não fechou). Cada botão abre a janela que já existe (agenda ou dados da etapa) |
| `src/componentes/kanban/quadro.tsx` | Abre a janela de decisão pela etiqueta do card. Quadro com arrastar e soltar; o admin renomeia a coluna pelo lápis ao lado do título (`NomeDaColuna`) (etapas que exigem dados abrem a janela antes de mover), busca e filtros (inclui "Esperando resposta" e "Meus leads"; etiqueta/cidade/zoom num popover, filtros ligados viram chips com "x", tarefa 27; Fechado/Perdido recolhidas e zoom automático, tarefa 24) Arrastar para Medição/Apresentação abre a janela de agendar (agendar já move o card). Arrastar para Em qualificação um card com medição/apresentação marcada pergunta se cancela o compromisso (`agendados` do card). |
| `src/componentes/kanban/card.tsx` | Card do lead: relógio da janela de 24h logo abaixo do nome (`RelogioJanela`), cor por espera (vermelho com halo que "respira", `animate-respirar` em `tokens.css`), etiqueta piscante de decisão pendente (abre a janela de decisão; card com borda vermelha), etiqueta piscante "Sem data – marque na agenda" em Medição/Apresentação sem o compromisso marcado (`semData`, calculado em `consultas.ts`; `animate-piscar`), "esperando há X min", bolinha de não lidas, retorno (hoje/atrasado destacado), valor (orçamento ou fechado). Sem consultor (fila): etiqueta "Na fila – sem consultor"; lembrete com a nota |
| `src/componentes/kanban/relogio-janela.tsx` | Relógio da janela de 24h da Meta no card (tarefa 37): anel que esvazia, horas restantes, cor por faixa (verde/amarelo/vermelho piscando) e "Só modelo" quando fechada; some em Fechado e Perdido; dica com a hora exata |
| `src/componentes/kanban/bolinha.tsx` | Bolinha verde com o número de mensagens não lidas |
| `src/componentes/kanban/zoom.ts` | Zoom do quadro: níveis fixos ou "auto" (padrão, tarefa 24), que `zoomParaCaber` calcula para as colunas abertas caberem na tela (mínimo 75%) |
| `src/componentes/ficha/gaveta.tsx` | Gaveta do lead (tarefa 23): `ProvedorGaveta` (no layout) lê `?lead=ID` da URL e abre um painel à direita por cima de qualquer tela, sem rolagem própria. É o acesso rápido (arranjo de 09/11/2026): cabeçalho com a etapa como botão, faixa "Agora" com pílulas coloridas do que pede ação (`PilulasAgora`), uma linha do cliente com "Ver resumo" e a conversa ocupando o resto, com os atalhos Agendar, Lembrete e Nota acima do campo de envio. Classificação, etiquetas, consultor e medidas ficam só na ficha completa. Com a gaveta aberta os avisos (toasts) vão para a esquerda dela (`globals.css`); `useGaveta().hrefDe(id)` é o link que todo card/lista usa para abrir (kanban, agenda, arquivados, retornos, esperando, galeria). "Abrir ficha completa" leva a `/lead/[id]`. Fechar usa `replace` para "voltar" não reabrir |
| `src/componentes/ficha/ficha.tsx` | Ficha completa (arranjo de 09/11/2026, sem layout personalizável): no PC, conversa à esquerda (abas Conversa | Notas | Histórico) e à direita uma coluna só em ordem de prioridade (Próximo passo, Cliente, Notas, Medidas, Gestão) que recolhe num trilho com os ícones de urgência (escolha guardada no navegador); no celular, abas Conversa/Ficha. Cliente, etapa (botão que troca; a partir de 1440px na barra de cima, abaixo disso na linha das abas), Arquivar e o menu "⋯" (exportar LGPD, excluir) na barra de cima (`AcoesFicha`). A altura sai da janela: a conversa, com o campo de envio, cabe sem rolar a página. Com a aba visível, marca a conversa como vista (zera as não lidas) |
| `src/componentes/ficha/dados-lead.tsx` | Blocos sem cor da coluna da ficha: `BlocoCliente` (o antigo resumo e os dados do lead juntos, só o preenchido; vazios atrás de "Mostrar campos vazios"; Copiar resumo e Editar), `BlocoNotas` (as 2 mais recentes), `BlocoMedidas`, `BlocoGestao` (consultor, classificação e etiquetas, recolhido). `Bloco` vira uma linha quando vazio. `CamposDoCliente` e `linhaDoCliente` servem também à gaveta |
| `src/componentes/ficha/acoes-lead.tsx` | `useAcoesDoLead`: tudo o que a gaveta e a ficha fazem com o lead (trocar etapa com a janela que a etapa pede, agendar, cancelar compromisso, lembrete, decisão pendente, nota rápida, copiar resumo) e as janelas disso. `SeletorEtapa` (etapa como botão) e `MenuAgendar` (visita, medição ou apresentação) |
| `src/componentes/ficha/proximo-passo.tsx` | Tela do "Próximo passo" (regra em `regras/proximo-passo.ts`): `PilulasAgora` (faixa colorida da gaveta; a pílula abre a linha com as ações), `BlocoProximoPasso` (bloco em destaque da ficha, com o valor da venda da etapa; vazio, convida a marcar retorno ou compromisso), `LinhaPasso` e `IconesDoPasso` (ficha recolhida) |
| `src/componentes/ficha/conversa.tsx` | Conversa na ficha e na gaveta (`atalhos`: linha de botões acima do campo de envio, usada pela gaveta). Campo de envio fixo embaixo (a lista de mensagens é que encolhe): caixa de texto que cresce até ~6 linhas (Enter envia, Shift+Enter quebra linha) ou, com modelo escolhido, a prévia inteira; barra com modelo, anexo e Enviar sempre à vista. Faixa da janela de 24h (tarefa 37): com menos de 6 h avisa a hora de fechar; fora da janela, botão "Reabrir com modelo" só escolhe o modelo `retomada` (o vendedor envia) |
| `src/componentes/ficha/lembrete.tsx` | `JanelaLembrete` (tarefa 22): data, hora e nota opcional em qualquer etapa aberta. Em Negociação é o próximo contato (obrigatório conforme o interruptor). Quem mostra o lembrete é o "Próximo passo"; quem abre a janela é `useAcoesDoLead` |
| `src/componentes/ficha/agendar.tsx` | Agendar/remarcar visita à loja, medição ou apresentação (pela ficha, pela agenda ou ao arrastar o card), só com horários livres do tipo . Calendário para escolher hoje (se ainda há horário depois da próxima hora cheia) ou qualquer data futura (até 12 meses) e, ao lado, os horários livres da véspera, do dia escolhido e do dia seguinte |
| `src/componentes/ficha/calendario.tsx` | `Calendario`: calendário de um mês para escolher o dia (bloqueia dias passados e dias em que a loja fecha) e utilitários de data "AAAA-MM-DD" |
| `src/componentes/agenda/agenda.tsx` | Grade da agenda. Marca o dia de hoje (pelo relógio do servidor); o "+" de bloquear só aparece ao passar o mouse (sempre visível em telas de toque) Cor e ícone por tipo; compromisso longo (medição) aparece em todas as horas que ocupa. |
| `src/componentes/painel/painel.tsx` | Painel de métricas (cartões "Janela de 24h da Meta (agora)", tarefa 37; grade 3×3 de leads + conversão da agenda com "Clientes que faltaram", botão "Exportar" do admin abre `exportar-desempenho` numa janela, tarefa 30): atalhos e datas, filtro de vendedor (admin), total em negociação, total vendido, motivos de perda, tempo médio de resposta, funil. Resultado em cima; variação dos indicadores diz "+2 em relação ao período anterior (era 1)" e a cor segue o sentido bom/ruim de cada indicador (PROVISÓRIO: só "Sem resposta" é pior ao subir) Bloco "Conversão da agenda" (tarefa 21). |
| `src/componentes/simulador/simulador.tsx` | Tela do simulador |
| `src/componentes/simulador/relogio.tsx` | Controle do relógio simulado (+15 min, +30 min, horas e dias; saltos de +7 dias ou mais pedem confirmação) |
| `src/componentes/configuracoes/equipe.tsx` | Cartão Equipe: novo usuário, editar, nova senha, transferir leads, desativar/reativar, almoço, colocar online e passar os de hoje de quem está offline; e `JanelaMinhaSenha` (cabeçalho) |
| `src/componentes/configuracoes/vendas.tsx` | Aba Vendas: interruptor do próximo contato em Negociação e lista editável de motivos de perda |
| `src/componentes/configuracoes/barra-salvar.tsx` | Barra "Alterações não salvas · Descartar · Salvar" fixa no rodapé das Configurações (tarefa 31): `useBlocoSalvavel` registra cada bloco com rascunho; `pedirSaida` pergunta antes de trocar de seção |
| `src/componentes/configuracoes/configuracoes.tsx` | Configurações com submenu vertical, pílula de mola que anda entre as opções (`Pilula` com `eixo="y"`) e barra de rolagem sempre reservada para o menu não pular (Geral, Equipe, Vendas, Instruções, Chaves de API, Armazenamento, Temas; `?secao=` na URL, tarefa 31). A Geral tem distribuição, prazos de espera, regras da agenda, equipe (cadastro em `equipe.tsx`) e armazenamento. A Chave API reúne chaves de API, uso do bot e WhatsApp |
| `src/componentes/galeria/galeria.tsx` | Galeria: tamanho dos blocos pequeno/médio/grande (como no Windows; guardado no navegador), filtros por tipo e vendedor, baixar, abrir, ver a conversa, apagar (só admin), aviso de "será apagado em N dias" |
| `src/componentes/midias/aviso-midias.tsx` | Aviso "também serão apagados N arquivos (X MB)" nas janelas de excluir (ficha, quadro, arquivados) |
| `src/componentes/configuracoes/armazenamento.tsx` | Cartão "Armazenamento de arquivos" em Configurações |
| `src/componentes/configuracoes/whatsapp.tsx` | Cartão do WhatsApp em Configurações: modo, variáveis que faltam, endereço do webhook, últimos avisos da Meta |
| `src/componentes/configuracoes/chaves-api.tsx` | Aba Chaves de API, dois cartões. "Atendimento por texto": abas Claude/GPT, lista de modelos da conta (escolher um troca quem atende), chave da empresa da aba. "Transcrição de áudio": sempre OpenAI, chave OpenAI (a mesma do GPT). Chave em pontinhos, mostra só o final, salvar/remover |
| `src/componentes/configuracoes/temas.tsx` | Aba Temas: uma bolinha por tema (as cores por dentro); o anel de escolha anda de uma à outra como mola (`Pilula`, variante anel). A escolha vale só neste aparelho |
| `src/componentes/login/esfera-3d.ts` | Esfera do login em Three.js (`iniciarEsfera`, devolve a função de parar): nuvem → nome → esfera, onda a cada ~8 s, mouse, clique de gel, arrastar e arremessar, colisão mole com a tela e o cartão (amassa reta na face, o canto arredondado afunda nela). Lança erro sem WebGL. Three.js só baixa nesta tela |
| `src/componentes/login/esfera-shader.ts` | Shaders da esfera (placa de vídeo): mistura das formas, ondas, gel, esticão e o contato que prende os pontos fora do cartão e dentro da tela |
| `src/componentes/tema.ts` | `lerTema` e `aplicarTema` (`data-tema` na página, localStorage `tema` e cor da barra do celular). O script de `src/app/layout.tsx` aplica o tema guardado antes de pintar |
| `src/componentes/configuracoes/uso-bot.tsx` | Cartão "Uso do bot" (tokens em 30 dias e os limites) |
| `src/componentes/configuracoes/exportar-desempenho.tsx` | Exportação de desempenho (aberta pelo botão "Exportar" do Painel, tarefa 30): vendedor, período, incluir mídia, baixar .zip |
| `src/componentes/configuracoes/instrucoes.tsx` | Aba de instruções: botão Importar (seletor de vários .txt do Windows + prévia do que será criado/atualizado), lista numerada, aviso de "sem instruções", cartão do Manual do CRM, edição, exportar, excluir; aviso "Manual diferente do código" com botão "Usar o texto do código" |

## Infra (`src/lib`, `scripts`, `prisma`)
| Arquivo | Faz |
|---|---|
| `src/lib/db.ts` | Cliente do banco (um só; banco separado nos testes) |
| `src/lib/api.ts` | `rota()`: transforma erros em respostas JSON em português |
| `src/lib/sessao.ts` | Login, cookie assinado, `exigirUsuario` |
| `src/lib/senha.ts` | Hash de senha |
| `src/lib/relogio.ts` | `agora()` e avanço do relógio simulado |
| `src/lib/versao.ts` | Contador de mudanças (`marcarMudanca`) |
| `src/lib/midias.ts` | Fotos e plantas fora da pasta pública (`MIDIAS_DIR` aponta para o volume no Railway) |
| `src/lib/esquema-venda.ts` | Validação (zod) dos dados de venda que chegam da tela e conversão para o serviço |
| `src/lib/json.ts` | `lerLista`/`gravarLista`: listas guardadas como JSON em texto (SQLite) |
| `src/lib/modo.ts`, `src/lib/modo-rota.ts` | Modo simulador (liga em dev/teste, desligado em produção, `MODO_SIMULADOR` manda) e o 404 das rotas de simulação |
| `src/lib/whatsapp-config.ts` | Lê as 4 variáveis do WhatsApp (só nomes aparecem na tela). `whatsappRealAtivo` = 4 variáveis E simulador desligado: só então algo sai pela Meta |
| `src/instrumentation.ts` | Roda ao subir o servidor: cria o primeiro admin e liga o agendador |
| `src/lib/cifra.ts` | Criptografia AES-256-GCM de segredos guardados no banco (chaves de API) |
| `src/lib/zip.ts` | Gerador de .zip simples, texto ou binário (exportar instruções e desempenho) |
| `prisma/seed.ts` | Dados fictícios (apaga tudo e recria, menos as instruções do bot) |
| `scripts/gerar-contrato-bot.ts` | `npm run contrato:bot`: grava `docs/contrato-do-bot.md`. Rodar ao mudar ferramenta, aviso do bot, regra automática ou Manual |
| `scripts/simular.ts` | `npm run simular`: conversa com o bot pelo terminal |
| `scripts/gerar-planta.ts` | Gera a planta fictícia de teste |
| `scripts/criar-usuario.ts` | Cria usuário no banco configurado |
| `scripts/registrar-numero.ts` | Registra o número do WhatsApp na API da Meta com o PIN (passo obrigatório antes de enviar) |
| `scripts/bloquear-producao.ts` | Primeiro passo do `npm run seed`: recusa rodar em produção (o seed apaga tudo) |
| `scripts/gerar-esquema-postgres.ts` | `npm run esquema:postgres`: copia o schema SQLite para `prisma/postgres/schema.prisma` trocando só o tipo de banco |
| `scripts/testar-postgres.ts` | `npm run test:postgres`: roda os testes num Postgres de teste e volta o cliente para SQLite |

## Testes
| Arquivo | Cobre |
|---|---|
| `testes/unit/regras.test.ts` | Regras puras (24h, retomada, agenda, permissões) |
| `testes/unit/proximo-passo.test.ts` | Próximo passo do lead: cores de urgência, datas relativas, decisão pendente no lugar do compromisso vencido, ordem |
| `testes/unit/fluxos.test.ts` | Fluxos com banco: retomada, distribuição, agenda, mensagens |
| `testes/unit/decisao.test.ts` | Decisão pendente: regra (vence no dia seguinte), card, lista de retornos, aviso diário, falta ao remarcar |
| `testes/unit/instrucoes.test.ts` | Instruções: banco vazio, Manual do CRM (criação, conversão do banco antigo, proteções), edição, versão anterior, exclusão, zip, bot sem instruções |
| `testes/unit/manual-versoes.test.ts` | Versões do Manual: impressão atual na lista, troca automática, editado na tela, voltar para a anterior. Usa `manual-antigo.txt` (versão de 04/11 congelada) |
| `testes/unit/painel.test.ts` | Painel: período, duração, filtro por vendedor, tempo de resposta |
| `testes/unit/exportacao.test.ts` | Exportação de desempenho: período, tempo de resposta, CSV, zip por vendedor |
| `testes/unit/alertas.test.ts` | Avisos: textos, título da aba, quem recebe cada um, passar o lead e visita marcada pelo bot, limpeza, prazo vermelho (uma vez por espera, só admin) |
| `testes/unit/espera.test.ts` | Espera do cliente: faixas, ordem das colunas, não lidas, fim da espera, prazos, lista de aguardando |
| `testes/unit/vendas.test.ts` | Vendas: dinheiro, o que cada etapa exige, limpeza ao sair da etapa, retornos (aviso uma vez por data, lista de hoje), painel de vendas, configurações de vendas (motivos editáveis, interruptor) |
| `testes/unit/agendador.test.ts` | Rotinas rodam sozinhas, uma vez, erro não derruba |
| `testes/unit/producao.test.ts` | Modo simulador: rotas 404 e relógio real em produção |
| `testes/unit/protecao-bot.test.ts` | Limite de mensagens, pausa do bot, uso da API, rota de saúde |
| `testes/unit/avisos.test.ts` | Textos que o bot recebe (abertura e avisos), fixados palavra por palavra |
| `testes/unit/contrato-bot.test.ts` | `docs/contrato-do-bot.md` igual ao código (senão: rode `npm run contrato:bot`) |
| `testes/unit/saida.test.ts` | Junção dos textos do bot sem repetir fala igual |
| `testes/unit/janela24h.test.ts` | Faixas e tempo restante da janela de 24h |
| `testes/unit/janelas-abertas.test.ts` | Consulta das janelas abertas (etapa, arquivado, dono do lead) |
| `testes/unit/lgpd.test.ts` | Parar de receber, exportar, excluir com registro |
| `testes/unit/whatsapp.test.ts` | Webhook: assinatura, verificação, payloads, duplicata, envio real (simulado com fetch falso), status, mídia, produção sem chaves |
| `testes/unit/midias.test.ts` | Imagem, vídeo e PDF: regras, guardar com validação, receber e enviar pelo WhatsApp, bot sem imagem falsa, galeria por vendedor, apagar, aviso, 180 dias, armazenamento |
| `testes/unit/pendencias-meta.test.ts` | Nono dígito, consentimento, bloqueio de modelo, caixa de entrada do webhook, transcrição de áudio (OpenAI simulada) |
| `testes/unit/chaves-api.test.ts` | Chaves de API: criptografia, tela vale mais que a variável, mesma chave nos dois campos, CHAVE_MESTRA ausente/trocada |
| `testes/unit/modelos-ia.test.ts` | Escolha de modelo: filtro das listas Claude e GPT, modelo salvo sempre visível, busca na conta (OpenAI simulada), sem chave e chave recusada (reserva sem vazar a chave) |
| `testes/unit/provedor-gpt.test.ts` | GPT como IA do texto: conversão de histórico/ferramentas/resposta, bot com a OpenAI simulada, troca de provedor |
| `testes/unit/seguranca.test.ts` | Limite de login, usuários, primeiro admin, cookie Secure |
| `testes/unit/retorno-fechada.test.ts` | Retorno com a loja fechada: próxima abertura, situação da loja para o bot, horário do retorno, `registrar_retorno`, modelo com botões, botão como PARAR, rotina (dono online, passa para quem está online, ninguém online, nunca parar/janela aberta/desligado) |
| `testes/unit/presenca.test.ts` | Presença: regras puras (loja aberta, fechamento, fila), offline no fechamento, lead sem dono fora do horário, repartir a fila, verificação e aviso de ausência (todos/só admin), compromisso cedo, passar os de hoje |
| `testes/unit/equipe.test.ts` | Regra da senha, redefinir/trocar senha, desativar (último admin, leads), transferir leads (em lote e um só), almoço só manual |
| `testes/unit/esquema.test.ts` | Esquema Postgres em sincronia e migrações cobrindo todas as tabelas e colunas |
| `testes/unit/push.test.ts` | Web Push (biblioteca trocada por uma falsa): quem recebe, texto do aviso, 410 remove o navegador, trocar de pessoa no mesmo navegador, chaves criptografadas, teste do sino |
| `testes/unit/sw.test.ts` | O `public/sw.js` rodando numa casca falsa: mostra o cartão minimizado, não mostra com o CRM na frente, clique abre a conversa |
| `testes/unit/etapas.test.ts` | Nome das colunas: validação, mesclar com o padrão, renomear/voltar ao padrão, nome repetido, histórico com o nome atual |
| `testes/unit/temas.test.ts` | Temas: códigos válidos, cada tema tem seu bloco em `tokens.css`, cores das bolinhas |
| `testes/unit/entalhe.test.ts` | Contas do entalhe flutuante (salto, abertura, forma, eixos, caminho) |
| `testes/unit/privacidade.test.ts` | Política aponta para a página de exclusão; página de exclusão tem as seções e o contato |
| `testes/unit/mapa.test.ts` | Este mapa está completo e sem arquivo fantasma |
| `testes/unit/ajuda.ts` | Limpar banco, criar consultores de teste e um roteiro de EXEMPLO para os testes do bot (não é o que o bot usa) |
| `testes/unit/preparar.ts` | Cria o banco só dos testes |
| `testes/e2e/telas.spec.ts` | Telas no computador e no celular, com prints |
| `testes/e2e/gaveta-ficha.spec.ts` | Gaveta e ficha completa em 1440×900 e 1280×720 (só no computador): gaveta abre no topo com resumo e etapa recolhidos, modelo longo com prévia inteira e Enviar à vista, Arquivar/⋯ no cabeçalho, caixa de texto que cresce (Shift+Enter) e envio sem rolar a página |
| `testes/e2e/presenca-retorno.spec.ts` | Telas das tarefas 35 e 36 (só no computador): botões online/offline do consultor, cartões Presença e fila e Retorno com a loja fechada, "Passar os de hoje" na Equipe, botões do modelo de retorno no simulador e "Não tenho interesse" como parar |

## Fora do código
- `public/sw.js`: service worker dos avisos (recebe o push e mostra o cartão do sistema; no iPhone/Mac mostra sempre, mesmo com o CRM na frente, senão a Apple corta os avisos; sem cache). `next.config.ts` serve ele sem cache. Ícones e PWA também ficam em `public/`.
- Instruções de atendimento: NÃO ficam no projeto. Vêm do repositório de instruções do Mateus e são coladas em Configurações > Instruções de atendimento.
- `tarefas/`: tarefas numeradas, uma por vez. 1–4: Bloco 1 (avisos e leads esperando resposta). 5–8: Bloco 2 (acompanhamento de vendas). `tarefas/futuras/`: caderno de melhorias futuras do Mateus, um arquivo por tópico e um índice no `README.md` (sem urgência; fora da numeração).
- `docs/`: `briefing.md`, `requisitos.md`, `design.md`, `rodadas/` (relatórios), `referencia/` (modelos HTML de layout e interação, só para consulta). `.claude/agents` e `.claude/skills`: revisores e comandos.
