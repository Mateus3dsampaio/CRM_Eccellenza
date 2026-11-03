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
| O que o bot diz / como atende | Tudo fica nas instruções (tela Configurações, banco): roteiro 01-13, dados da loja 14, regras do CRM e ferramentas 15. Montagem do prompt: `src/bot/prompt.ts` |
| Ferramentas do bot (o que ele grava) | `src/bot/ferramentas.ts` (esquemas) + `src/bot/executor.ts` (execução) |
| Colunas, etiquetas, classificações | `src/regras/etapas.ts` |
| Regras da agenda (horário por dia, duração, vagas, dias à frente): o admin edita em Configurações > Geral, gravado em `Configuracao` (chave `agenda`) | `src/regras/agenda.ts` (padrão e validação) + `src/servicos/configuracoes.ts` + `src/servicos/agenda.ts` |
| Retomada / "Sem resposta" | `src/regras/retomada.ts` + `src/servicos/rotinas.ts` |
| Modelos de mensagem / janela de 24h | `src/regras/modelos.ts`, `src/regras/janela24h.ts` |
| Motivos de perda e se Negociação exige próximo contato | Tela: `src/componentes/configuracoes/vendas.tsx`. Regras e gravação: `src/servicos/vendas.ts` + `src/regras/vendas.ts` (`faltaParaMover`). A janela de mover e a ficha leem de `/api/vendas/regras` |
| Retornos (próximo contato, "Retornos de hoje", destaque no card) | `src/regras/vendas.ts` (`situacaoDoRetorno`) + `src/servicos/consultas.ts` (`retornosDeHoje`) + `src/servicos/alertas.ts` (`avisarRetornos`) + `src/componentes/retornos.tsx` |
| Avisos (som, notificação do navegador, número na aba) | Quando nasce o aviso: `src/servicos/alertas.ts` (chamado por `mensagens`, `agenda` e `bot/executor`). Texto: `src/regras/alertas.ts`. Tela: `src/componentes/alertas/` |
| Espera do cliente (cor do card, prazos, ordem das colunas, bolinha de não lidas) | `src/regras/espera.ts` + `src/servicos/mensagens.ts` (grava) + `src/servicos/configuracoes.ts` (prazos) |
| Quem recebe cada lead | `src/regras/distribuicao.ts` + `src/servicos/distribuicao.ts` |
| Cores, sombras, espaçamentos | `src/app/tokens.css` |
| Quem pode fazer o quê | `src/regras/permissoes.ts` |
| O que a exportação de desempenho leva | `src/servicos/vendas.ts` | Configurações de vendas: motivos de perda (carga inicial, criar, editar, reordenar, excluir só se sem uso) e o interruptor "Negociação exige próximo contato" (padrão ligado). `regrasDeVendas` entrega o que o `moverEtapa` confere |
| `src/servicos/exportacao.ts` (arquivos) + `src/regras/exportacao.ts` (período e cálculos) |
| WhatsApp real (receber, enviar, status, mídia) | Regras puras: `src/regras/whatsapp.ts`. Chamadas à Meta e processamento: `src/servicos/whatsapp.ts`. Rota: `src/app/api/whatsapp/webhook/route.ts`. Chaves: `src/lib/whatsapp-config.ts` (variáveis de ambiente). O envio pelo bot/consultor passa por `enviarMensagemLoja` em `src/servicos/mensagens.ts` |
| Limites do bot por cliente e uso da API | `src/regras/limite-bot.ts` (valores PROVISÓRIOS) + `src/bot/atendimento.ts` + `src/servicos/uso-api.ts` |
| LGPD (parar de receber, exportar, excluir com registro) | `src/regras/consentimento.ts` | Consentimento para modelos (mensagem iniciada pela loja): origens, `temConsentimento` e a decisão PROVISÓRIA "cliente que escreveu primeiro conta" |
| `src/regras/privacidade.ts` | Texto PROPOSTO da política de privacidade (trechos [entre colchetes] a preencher) |
| `src/regras/optout.ts` (frases e texto de confirmação PROVISÓRIO) + `src/servicos/lgpd.ts` |
| Rotinas automáticas (retomada etc.) rodando sozinhas | `src/servicos/agendador.ts` + `src/instrumentation.ts` (liga em produção) |
| Modo simulador (relógio, Simulador) ligado/desligado | `src/lib/modo.ts` (`MODO_SIMULADOR`; desligado em produção) + `src/lib/modo-rota.ts` |
| Login, tentativas, primeiro admin, criar usuário | `src/regras/tentativas-login.ts` + `src/app/api/login/route.ts` + `src/servicos/usuarios.ts` + `scripts/criar-usuario.ts` |
| Colocar no ar (Railway, Postgres) | `Dockerfile`, `railway.json`, `prisma/postgres/` (esquema gerado + migrações), guia em `docs/colocar-no-ar.md` |
| Tabelas do banco | `prisma/schema.prisma` (depois `npm run esquema:postgres` e uma migração nova em `prisma/postgres/migrations/`; o teste `esquema.test.ts` avisa se esquecer) (depois `npx prisma db push`; ajuste `prisma/seed.ts` e `testes/unit/ajuda.ts` se a tabela precisa ser limpa) |

## Banco (`prisma/schema.prisma`)
| Tabela | Guarda |
|---|---|
| `Usuario` | Admin e consultores (perfil, status online/almoço) |
| `Lead` | Ficha do cliente (inclui, nas vendas: `proximoContatoEm`, `valorOrcamento` e `valorFechado` em centavos, `motivoPerda` e `concorrente`): etapa, etiquetas, dados do projeto, consultor, modo (bot/humano), hora em que o bot repassou o lead (`repassadoEm`), desde quando o cliente espera um humano (`esperandoDesde`) mensagens que nenhum humano abriu (`naoLidas`) e para qual espera o admin já foi avisado do prazo vermelho (`alertaPrazoPara`) e para qual data de retorno o vendedor já foi avisado (`alertaContatoPara`). `naoReceberEm`: o cliente pediu para parar (sem bot, retomada nem modelos). `waId`: número como a Meta o conhece (no Brasil pode ser sem o 9). `consentimentoEm`/`consentimentoOrigem`: consentimento para modelos. `ordem` não é mais usada pelo kanban (a ordem das colunas vem de `regras/espera`) |
| `Mensagem` | Conversa (cliente, bot, consultor), status de envio, mídia. `idExterno` = id da Meta (único: a mesma mensagem não entra duas vezes) |
| `ConversaApi` | Histórico enviado à API do Claude por lead |
| `Medida`, `Nota`, `Alteracao` | Medidas, notas internas e histórico de quem mudou o quê |
| `MudancaEtapa` | Cada mudança de etapa do lead (de, para, quem, quando). Gravada em `moverEtapa` e na criação do lead. Alimenta a exportação de desempenho |
| `Visita`, `Bloqueio` | Agenda: visitas e bloqueios de horário |
| `EventoWebhook` | Caixa de entrada do webhook da Meta: o corpo (traz texto e telefone do cliente) é gravado antes do 200, processado depois e ESVAZIADO ao terminar; a linha some em 2 dias. Excluir um cliente apaga também os eventos pendentes dele |
| `EventoMetrica` | Contadores anônimos do painel |
| `Alerta` | Avisos para quem atende (mensagem nova, lead passado, visita marcada, hora do retorno com o cliente, prazo vermelho vencido — este só o admin recebe): tipo, lead, dono na hora, texto. A tela busca só os novos pelo `id`; some em 1 dia |
| `Configuracao` | Pares chave/valor (modo de distribuição, exigir próximo contato em Negociação, layout da ficha, versão dos dados, segredo da sessão) |
| `RegistroRotina` | Log das rotinas e do relógio simulado |
| `MotivoPerda` | Motivos de perda editáveis (código, nome, pergunta extra, ordem, ativo). O lead guarda o código. Motivo em uso só desativa. Os 5 originais entram sozinhos na primeira consulta |
| `Instrucao` | Instruções de atendimento do bot (título, texto, ordem, ativa, versão anterior) |
| `UsoApi` | Uma linha por chamada à API do Claude: só contadores de tokens (sem texto de cliente). Alimenta "Uso do bot" em Configurações |
| `LogWebhook` | Log do que a Meta mandou e dos envios (sem conteúdo das mensagens, só tipo e final do telefone). Apagado após 14 dias |
| `PedidoLgpd` | Registro de exclusões e exportações de dados de cliente (só ação, quem fez e os 4 últimos dígitos do telefone) |

## Telas (`src/app/(app)`)
| Arquivo | Tela |
|---|---|
| `src/app/layout.tsx` | Layout raiz (fonte). O sistema é só escuro |
| `src/app/globals.css` | Estilos globais e as classes de "tecla" dos botões (`tecla`, `tecla-pri`, `tecla-perigo`) e `afundado` (selecionado) |
| `src/app/tokens.css` | Design tokens: todas as cores, sombras, raios e espaços. Paleta azul-ardósia do modelo do Mateus; sistema só escuro |
| `src/app/login/page.tsx` | Login |
| `src/app/(app)/layout.tsx` | Moldura das telas logadas: exige login e põe cabeçalho, avisos e versão dos dados |
| `src/app/(app)/page.tsx` | Kanban |
| `src/app/(app)/lead/[id]/page.tsx` | Ficha do lead |
| `src/app/(app)/agenda/page.tsx` | Agenda |
| `src/app/(app)/painel/page.tsx` | Painel de métricas |
| `src/app/(app)/simulador/page.tsx` | Simulador (chat do cliente fictício) |
| `src/app/privacidade/page.tsx` | Política de privacidade PÚBLICA (sem login; a Meta e os clientes abrem). Rascunho até `PRIVACIDADE_APROVADA=1`; contato em `PRIVACIDADE_CONTATO` |
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
| `src/app/api/aguardando/route.ts` | Leads esperando um humano (consultor: os dele; admin: todos) e os prazos de cor. Alimenta o contador do topo, a lista e a cor dos cards | `consultas`, `configuracoes` |
| `src/app/api/leads/[id]/route.ts` | Ficha e correção de dados (inclui `venda`: data do retorno, valores, motivo) | `consultas`, `leads`, `historico` |
| `src/app/api/leads/[id]/conversa/route.ts` | Assumir, devolver ao bot, responder, marcar como vista (zera a bolinha) | `conversa` |
| `src/app/api/leads/[id]/medidas/route.ts` | Medidas | `leads`, `historico` |
| `src/app/api/leads/[id]/notas/route.ts` | Notas internas | `historico` |
| `src/app/api/leads/acoes/route.ts` | Mover (com os dados de venda; confere o lote todo antes), arquivar, excluir em lote (exclusão grava o registro LGPD) | `leads`, `lgpd` |
| `src/app/api/arquivados/route.ts` | Lista de arquivados | `consultas`, `rotinas` |
| `src/app/api/agenda/route.ts` | Agenda, visitas, bloqueios | `agenda`, `consultas` |
| `src/app/api/painel/route.ts` | Métricas (atalho ou datas, vendedor só para admin) | `painel` |
| `src/app/api/nova-mensagem/route.ts` | Mensagem para qualquer número (MSG). Acha o cliente com ou sem o 9; modelo exige consentimento (pede como o cliente autorizou) e não vale para quem pediu para parar | `conversa`, `leads`, `lgpd`, `consultas` |
| `src/app/api/simulador/route.ts` | Chat do cliente fictício. 404 fora do modo simulador | `conversa`, `mensagens`, `consultas` |
| `src/app/api/relogio/route.ts` | Avançar o relógio e rodar rotinas. 404 fora do modo simulador | `rotinas` |
| `src/app/api/teste/route.ts` | Interface de teste (`npm run simular`, cliente-simulado) | `conversa`, `rotinas`, `consultas` |
| `src/app/api/equipe/status/route.ts` | Consultor online/almoço | `distribuicao` |
| `src/app/api/midias/[nome]/route.ts` | Serve fotos/plantas (só logado). Estava fora do Git por causa do `.gitignore` (`midias/`); agora o `.gitignore` só ignora `/midias/` da raiz | `lib/midias` |
| `src/app/api/configuracoes/route.ts` | Dados da tela de Configurações (inclui o período padrão da exportação) | `configuracoes`, `distribuicao` |
| `src/app/api/whatsapp/webhook/route.ts` | Webhook da Meta: GET verifica o token; POST valida a assinatura, GRAVA o evento (caixa de entrada) e responde 200; processa depois (a rotina reprocessa o que ficar pendente). Pública de propósito (a assinatura protege) | `whatsapp`, `regras/whatsapp` |
| `src/app/api/saude/route.ts` | "Está de pé?" para o Railway (pública, sem dados) | `lib/db` |
| `src/app/api/leads/[id]/exportar/route.ts` | LGPD: baixa todos os dados de um cliente (.zip). Só admin | `lgpd` |
| `src/app/api/configuracoes/whatsapp/route.ts` | Situação do WhatsApp (modo, nomes das variáveis que faltam, log do webhook). Só admin | `whatsapp`, `lib/whatsapp-config` |
| `src/app/api/configuracoes/uso-bot/route.ts` | Uso da API do Claude nos últimos 30 dias. Só admin | `uso-api` |
| `src/app/api/configuracoes/exportar-desempenho/route.ts` | Exporta .zip de desempenho de um vendedor (até 30 dias, mídia opcional). Só admin | `exportacao` |
| `src/app/api/configuracoes/vendas/route.ts` | Interruptor do próximo contato em Negociação e CRUD dos motivos de perda (criar, editar, ativar/desativar, reordenar, excluir). Só admin | `vendas` |
| `src/app/api/vendas/regras/route.ts` | Regras de vendas e motivos para a janela de mover, a ficha e o card (qualquer usuário logado) | `vendas` |
| `src/app/api/configuracoes/distribuicao/route.ts` | Modo de distribuição | `configuracoes` |
| `src/app/api/configuracoes/prazos-espera/route.ts` | Prazos amarelo e vermelho da espera do cliente (minutos, PROVISÓRIO). Só admin | `configuracoes` |
| `src/app/api/configuracoes/layout-ficha/route.ts` | Layout padrão da ficha (chave `layout_ficha` em `Configuracao`) | `regras/layout-ficha` |
| `src/app/api/configuracoes/agenda/route.ts` | Gravar as regras da agenda (só admin) | `configuracoes` |
| `src/app/api/configuracoes/instrucoes/route.ts` | Listar e criar instruções | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/[id]/route.ts` | Editar, ativar/desativar, excluir | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/[id]/voltar/route.ts` | Voltar para a versão anterior | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/reordenar/route.ts` | Reordenar | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/exportar/route.ts` | Exportar .txt ou .zip | `instrucoes`, `lib/zip` |

## Serviços (`src/servicos`) – gravam no banco
| Arquivo | Faz |
|---|---|
| `src/servicos/leads.ts` | Criar lead (acha o mesmo cliente com e sem o 9: `acharLeadPorTelefone`), mover etapa (recusa se faltar próximo contato, valor fechado ou motivo da perda; `conferirMudanca` só confere, sem gravar; também troca data/valores sem mudar de etapa), etiquetas, campos, arquivar, restaurar, excluir |
| `src/servicos/mensagens.ts` | Registrar mensagem do cliente e da loja (envio real pela Meta quando as chaves existem; senão simulado; em produção sem chaves a mensagem fica "falhou"), status (entregue/lido: o real vem do webhook). Mantém `esperandoDesde` e `naoLidas`: mensagem do cliente com lead aguardando humano abre a espera e soma a bolinha; resposta do consultor encerra |
| `src/servicos/conversa.ts` | Mensagem do cliente → bot; assumir, devolver (encerra a espera), responder como consultor, marcar conversa como vista |
| `src/servicos/agenda.ts` | Horários livres, agendar, cancelar visita, bloqueios |
| `src/servicos/distribuicao.ts` | Escolher consultor (rodízio ou menos leads), fila, status almoço |
| `src/servicos/configuracoes.ts` | Ler/gravar configurações, modo de distribuição, prazos de espera |
| `src/servicos/instrucoes.ts` | Instruções do bot: carga inicial, CRUD, versão anterior, exportar |
| `src/servicos/exportacao.ts` | Monta o .zip de desempenho do vendedor: resumo, leads, mudanças de etapa, uma conversa por lead, mídias (opcional). Sem telefone/nome do cliente. Bot e consultor separados |
| `src/servicos/consultas.ts` | Dados prontos para as telas (cards e ficha trazem os dados de venda) (kanban, ficha, agenda, arquivados, lista de aguardando). O kanban sai ordenado: quem espera resposta primeiro, depois pela última mensagem |
| `src/servicos/painel.ts` | Dados do Painel por período e vendedor: contadores anônimos (geral) ou leads do vendedor, funil, tempo de resposta (bot e consultor) e vendas (total em negociação agora, total vendido e motivos de perda no período) |
| `src/servicos/resumo.ts` | Resumo da ficha para o consultor copiar |
| `src/servicos/alertas.ts` | Guarda o aviso (mensagem do cliente, bot passou o lead, bot marcou visita, hora do retorno) e entrega os novos por usuário. Limpa os de mais de 1 dia. `avisarRetornos`: avisa o dono do lead (e o admin) na hora do próximo contato, uma vez por data marcada. `avisarPrazosVermelhos`: avisa o admin uma vez por espera quando um lead passa do prazo vermelho |
| `src/servicos/historico.ts` | Registro de quem mudou o quê |
| `src/servicos/metricas.ts` | Contadores anônimos |
| `src/servicos/rotinas.ts` | Retomada (pula quem pediu para parar), "Sem resposta", limpeza de arquivados e de logs antigos, relógio (também confere os prazos vermelhos) |
| `src/servicos/agendador.ts` | Liga as rotinas de minuto em minuto no servidor (produção ou `ROTINAS_AUTO=1`), uma vez por processo, erro não derruba |
| `src/servicos/whatsapp.ts` | Meta: enviar texto/modelo (para o `wa_id`), baixar imagem e áudio (só de hosts da Meta, https, sem redirecionamento, com limite de tamanho), processar mensagens e status do webhook (sem duplicar), áudio → texto, caixa de entrada (`guardarEvento`, `processarEventoGuardado`, `reprocessarEventosPendentes`), log do webhook |
| `src/servicos/transcricao.ts` | Áudio → texto com o Whisper da OpenAI (`OPENAI_API_KEY`; modelo `whisper-1`, troca por `OPENAI_TRANSCRICAO_MODELO`). Só devolve texto; o áudio não é guardado. Nunca lança |
| `src/servicos/lgpd.ts` | Pedido de parar (etiqueta, confirmação PROVISÓRIA), liberar, registrar consentimento, exportar dados do cliente (.zip), excluir com registro |
| `src/servicos/uso-api.ts` | Guarda e soma o uso da API do Claude |
| `src/servicos/usuarios.ts` | Criar usuário (senha mínima 10) e criar o primeiro admin a partir de `ADMIN_*` |

## Regras puras (`src/regras`)
| Arquivo | Regra |
|---|---|
| `src/regras/vendas.ts` | Acompanhamento de vendas: motivos de fábrica (carga inicial), dinheiro (centavos ↔ "R$ 1.621,00"), o que cada etapa exige para receber o card (próximo contato, valor fechado, motivo da perda; Negociação conforme o interruptor), data/hora de Fortaleza e situação do retorno (hoje, atrasado, sem data) |
| `src/regras/etapas.ts` | Colunas do kanban, etiquetas, classificações, cidades atendidas |
| `src/regras/agenda.ts` | Regras da agenda como parâmetro (`RegrasAgenda`, padrão PROVISÓRIO, validação, vagas livres, janela). Não lê banco |
| `src/regras/retomada.ts` | Quando retomar e quando ir para "Sem resposta" |
| `src/regras/janela24h.ts` | Texto livre só até 24h depois do cliente (Meta) |
| `src/regras/modelos.ts` | Modelos de mensagem aprovados (fictícios) |
| `src/regras/distribuicao.ts` | Modos de distribuição de leads |
| `src/regras/espera.ts` | Espera do cliente por um humano: faixa (normal, amarelo, vermelho), prazos padrão PROVISÓRIOS (10 e 30 min), desde quando o lead espera, validação, texto "12 min", ordem das colunas |
| `src/regras/almoco.ts` | Aviso ao cliente durante o almoço do consultor |
| `src/regras/permissoes.ts` | Quem pode o quê |
| `src/regras/layout-ficha.ts` | Grade da ficha do lead. Padrão: conversa à esquerda e ficha à direita (campo de resposta visível em 1280×720) |
| `src/regras/limites.ts` | Limites usados na tela e no servidor (tamanho máximo de imagem) |
| `src/regras/limpeza.ts` | Quando um arquivado é excluído (30 dias) |
| `src/regras/exportacao.ts` | Exportação de desempenho: período (máx. 30 dias), CSV |
| `src/regras/tempo-resposta.ts` | Tempo de resposta: por turno do cliente (bot ou consultor primeiro), do consultor em toda resposta (ignora o bot), 1ª resposta do consultor depois do repasse do bot; média/mediana e formatar duração. Usado pelo Painel e pela exportação |
| `src/regras/painel.ts` | Período do Painel: atalhos (hoje, 7 dias, 30 dias, semana, mês), datas livres, período anterior do mesmo tamanho |
| `src/regras/alertas.ts` | Avisos: texto de cada tipo (inclui o do retorno) ("para você" ou o nome do consultor), número no título da aba, preferências guardadas no navegador |
| `src/regras/telefone.ts` | Telefone E.164, nome de exibição do lead e `variantesTelefone` (Brasil com e sem o 9) |
| `src/regras/tempo.ts` | Fuso de Fortaleza e contas de data |
| `src/regras/whatsapp.ts` | Webhook da Meta: assinatura HMAC, verificação do token, leitura do payload (texto, imagem, botões, tipos não suportados, status) |
| `src/regras/limite-bot.ts` | Limite de mensagens do cliente por minuto e por dia (PROVISÓRIO: 8 e 150) |
| `src/regras/optout.ts` | Frases que contam como "parar" (a mensagem inteira) e o texto de confirmação (PROVISÓRIO) |
| `src/regras/tentativas-login.ts` | Limite de tentativas de login (5 erros em 15 min) |

## Bot (`src/bot`)
| Arquivo | Faz |
|---|---|
| `src/bot/atendimento.ts` | Chama a API do Claude (modelo, histórico, cache, laço de ferramentas) |
| `src/bot/prompt.ts` | Monta o prompt: abertura fixa (identidade e tags) + instruções ativas do banco. Não lê mais nenhum arquivo |
| `src/bot/ferramentas.ts` | Esquemas das ferramentas e validação |
| `src/bot/executor.ts` | Executa cada ferramenta (grava no CRM) |
| `src/bot/saida.ts` | Limpa o texto do bot antes de ir ao cliente |

## Componentes (`src/componentes`)
| Arquivo | Faz |
|---|---|
| `src/componentes/ui.tsx` | Peças comuns: Botao, Modal, Campo, Avatar, Etiqueta, estados vazio/erro |
| `src/componentes/dados.tsx` | `chamarApi`, `useDados` (recarrega com a versão), avisos (toasts) |
| `src/componentes/estilos.ts` | Cores por código e `juntar` |
| `src/componentes/cabecalho.tsx` | Barra de cima: título da tela e ações (retornos de hoje, "X aguardando você", Nova mensagem, avisos, usuário, sair). No celular tem que caber em 375px sem rolar para o lado |
| `src/componentes/menu-lateral.tsx` | Menu lateral (computador) com indicador que desliza e opção de encolher (guarda a escolha); no celular vira a barra de baixo |
| `src/componentes/espera.tsx` | Espera do cliente na tela: provedor (uma consulta a `/api/aguardando` para a tela toda), hora do servidor, tempo e faixa de cor, classes de cor |
| `src/componentes/alertas/provedor.tsx` | Busca os avisos novos a cada mudança de versão, toca o som, mostra a notificação do navegador (aba em segundo plano) ou o aviso na tela (aba na frente) e põe "(3)" no título da aba |
| `src/componentes/alertas/botao-avisos.tsx` | Sino do topo: liga/desliga som e notificações, pede a permissão do navegador, testar aviso (só no computador) |
| `src/componentes/alertas/som.ts` | Som feito no navegador (sem arquivo de áudio) |
| `src/componentes/retornos.tsx` | Botão "Retornos de hoje" no topo e a lista, provedor (uma consulta a `/api/retornos` para a tela toda), situação e destaque do retorno no card |
| `src/componentes/aguardando.tsx` | Botão "X aguardando você" no topo e a lista que ele abre |
| `src/componentes/vendas/regras.tsx` | Provedor das regras de vendas (uma consulta para a tela toda): motivos e se Negociação exige o retorno |
| `src/componentes/vendas/janela-mudanca.tsx` | Janela que pede o que a etapa exige ao mover o card (próximo contato + valor do orçamento, valor fechado, motivo da perda) e `CampoDinheiro` (máscara R$ 1.621,00, biblioteca react-currency-input-field). Usada no quadro e na ficha |
| `src/componentes/usuario.tsx` | Usuário logado no contexto |
| `src/componentes/texto.ts` | Formatação de texto |
| `src/componentes/chat.tsx` | Bolhas de conversa |
| `src/componentes/almoco.tsx` | Botão de almoço do consultor |
| `src/componentes/nova-mensagem.tsx` | Janela de nova mensagem |
| `src/componentes/arquivados.tsx` | Lista de arquivados (Excluir discreto, em vermelho, afastado de Restaurar) |
| `src/componentes/kanban/quadro.tsx` | Quadro com arrastar e soltar (etapas que exigem dados abrem a janela antes de mover), busca e filtros (inclui "Esperando resposta" e "Meus leads") |
| `src/componentes/kanban/card.tsx` | Card do lead: cor por espera, "esperando há X min", bolinha de não lidas, retorno (hoje/atrasado destacado), valor (orçamento ou fechado) |
| `src/componentes/kanban/bolinha.tsx` | Bolinha verde com o número de mensagens não lidas |
| `src/componentes/kanban/zoom.ts` | Zoom do quadro |
| `src/componentes/ficha/ficha.tsx` | Ficha: grade arrastável (PC) e abas (celular). Com a aba visível, marca a conversa como vista (zera as não lidas) |
| `src/componentes/ficha/dados-lead.tsx` | Blocos de dados da ficha (inclui retorno, valores e motivo da perda, com a janela para editar) |
| `src/componentes/ficha/conversa.tsx` | Conversa na ficha |
| `src/componentes/ficha/agendar.tsx` | Agendar/remarcar pela ficha |
| `src/componentes/agenda/agenda.tsx` | Grade da agenda. Marca o dia de hoje (pelo relógio do servidor); o "+" de bloquear só aparece ao passar o mouse (sempre visível em telas de toque) |
| `src/componentes/painel/painel.tsx` | Painel de métricas: atalhos e datas, filtro de vendedor (admin), total em negociação, total vendido, motivos de perda, tempo médio de resposta, funil. Resultado em cima; variação dos indicadores diz "+2 em relação ao período anterior (era 1)" e a cor segue o sentido bom/ruim de cada indicador (PROVISÓRIO: só "Sem resposta" é pior ao subir) |
| `src/componentes/simulador/simulador.tsx` | Tela do simulador |
| `src/componentes/simulador/relogio.tsx` | Controle do relógio simulado (saltos de +7 dias ou mais pedem confirmação) |
| `src/componentes/configuracoes/vendas.tsx` | Aba Vendas: interruptor do próximo contato em Negociação e lista editável de motivos de perda |
| `src/componentes/configuracoes/configuracoes.tsx` | Configurações (abas Geral, Vendas, Instruções e Exportar desempenho). A Geral tem distribuição, prazos de espera, regras da agenda e equipe |
| `src/componentes/configuracoes/whatsapp.tsx` | Cartão do WhatsApp em Configurações: modo, variáveis que faltam, endereço do webhook, últimos avisos da Meta |
| `src/componentes/configuracoes/uso-bot.tsx` | Cartão "Uso do bot" (tokens em 30 dias e os limites) |
| `src/componentes/configuracoes/exportar-desempenho.tsx` | Aba de exportação: vendedor, período, incluir mídia, baixar .zip |
| `src/componentes/configuracoes/instrucoes.tsx` | Aba de instruções: lista, edição, exportar, excluir |

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
| `src/lib/zip.ts` | Gerador de .zip simples, texto ou binário (exportar instruções e desempenho) |
| `prisma/seed.ts` | Dados fictícios (apaga tudo e recria) |
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
| `testes/unit/fluxos.test.ts` | Fluxos com banco: retomada, distribuição, agenda, mensagens |
| `testes/unit/instrucoes.test.ts` | Instruções: carga, edição, versão anterior, exclusão, zip |
| `testes/unit/painel.test.ts` | Painel: período, duração, filtro por vendedor, tempo de resposta |
| `testes/unit/exportacao.test.ts` | Exportação de desempenho: período, tempo de resposta, CSV, zip por vendedor |
| `testes/unit/alertas.test.ts` | Avisos: textos, título da aba, quem recebe cada um, passar o lead e visita marcada pelo bot, limpeza, prazo vermelho (uma vez por espera, só admin) |
| `testes/unit/espera.test.ts` | Espera do cliente: faixas, ordem das colunas, não lidas, fim da espera, prazos, lista de aguardando |
| `testes/unit/vendas.test.ts` | Vendas: dinheiro, o que cada etapa exige, limpeza ao sair da etapa, retornos (aviso uma vez por data, lista de hoje), painel de vendas, configurações de vendas (motivos editáveis, interruptor) |
| `testes/unit/agendador.test.ts` | Rotinas rodam sozinhas, uma vez, erro não derruba |
| `testes/unit/producao.test.ts` | Modo simulador: rotas 404 e relógio real em produção |
| `testes/unit/protecao-bot.test.ts` | Limite de mensagens, pausa do bot, uso da API, rota de saúde |
| `testes/unit/lgpd.test.ts` | Parar de receber, exportar, excluir com registro |
| `testes/unit/whatsapp.test.ts` | Webhook: assinatura, verificação, payloads, duplicata, envio real (simulado com fetch falso), status, mídia, produção sem chaves |
| `testes/unit/pendencias-meta.test.ts` | Nono dígito, consentimento, bloqueio de modelo, caixa de entrada do webhook, transcrição de áudio (OpenAI simulada) |
| `testes/unit/seguranca.test.ts` | Limite de login, usuários, primeiro admin, cookie Secure |
| `testes/unit/esquema.test.ts` | Esquema Postgres em sincronia e migrações cobrindo todas as tabelas e colunas |
| `testes/unit/mapa.test.ts` | Este mapa está completo e sem arquivo fantasma |
| `testes/unit/ajuda.ts` | Limpar banco e criar consultores de teste |
| `testes/unit/preparar.ts` | Cria o banco só dos testes |
| `testes/e2e/telas.spec.ts` | Telas no computador e no celular, com prints |

## Fora do código
- `agente/instrucoes/` (01 a 15): só a carga inicial do banco; 14 = dados da loja, 15 = regras do CRM e ferramentas. O bot lê só do banco.
- `tarefas/`: tarefas numeradas, uma por vez. 1–4: Bloco 1 (avisos e leads esperando resposta). 5–8: Bloco 2 (acompanhamento de vendas).
- `docs/`: `briefing.md`, `requisitos.md`, `design.md`, `rodadas/` (relatórios), `referencia/` (modelos HTML de layout e interação, só para consulta). `.claude/agents` e `.claude/skills`: revisores e comandos.
