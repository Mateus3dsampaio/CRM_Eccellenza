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
| O que o bot diz / como atende | Instruções: tela Configurações (banco). Regras do CRM: `agente/complemento-crm.md`. Montagem do prompt: `src/bot/prompt.ts` |
| Ferramentas do bot (o que ele grava) | `src/bot/ferramentas.ts` (esquemas) + `src/bot/executor.ts` (execução) |
| Colunas, etiquetas, classificações | `src/regras/etapas.ts` |
| Regras da agenda (horário, duração, vagas) | `src/regras/agenda.ts` + `src/servicos/agenda.ts` |
| Retomada / "Sem resposta" | `src/regras/retomada.ts` + `src/servicos/rotinas.ts` |
| Modelos de mensagem / janela de 24h | `src/regras/modelos.ts`, `src/regras/janela24h.ts` |
| Espera do cliente (cor do card, prazos, ordem das colunas, bolinha de não lidas) | `src/regras/espera.ts` + `src/servicos/mensagens.ts` (grava) + `src/servicos/configuracoes.ts` (prazos) |
| Quem recebe cada lead | `src/regras/distribuicao.ts` + `src/servicos/distribuicao.ts` |
| Cores, sombras, espaçamentos | `src/app/tokens.css` |
| Quem pode fazer o quê | `src/regras/permissoes.ts` |
| O que a exportação de desempenho leva | `src/servicos/exportacao.ts` (arquivos) + `src/regras/exportacao.ts` (período e cálculos) |
| Tabelas do banco | `prisma/schema.prisma` (depois `npx prisma db push`; ajuste `prisma/seed.ts` e `testes/unit/ajuda.ts` se a tabela precisa ser limpa) |

## Banco (`prisma/schema.prisma`)
| Tabela | Guarda |
|---|---|
| `Usuario` | Admin e consultores (perfil, status online/almoço) |
| `Lead` | Ficha do cliente: etapa, etiquetas, dados do projeto, consultor, modo (bot/humano), hora em que o bot repassou o lead (`repassadoEm`), desde quando o cliente espera um humano (`esperandoDesde`) e mensagens que nenhum humano abriu (`naoLidas`). `ordem` não é mais usada pelo kanban (a ordem das colunas vem de `regras/espera`) |
| `Mensagem` | Conversa (cliente, bot, consultor), status de envio, mídia |
| `ConversaApi` | Histórico enviado à API do Claude por lead |
| `Medida`, `Nota`, `Alteracao` | Medidas, notas internas e histórico de quem mudou o quê |
| `MudancaEtapa` | Cada mudança de etapa do lead (de, para, quem, quando). Gravada em `moverEtapa` e na criação do lead. Alimenta a exportação de desempenho |
| `Visita`, `Bloqueio` | Agenda: visitas e bloqueios de horário |
| `EventoMetrica` | Contadores anônimos do painel |
| `Configuracao` | Pares chave/valor (modo de distribuição, layout da ficha, versão dos dados, segredo da sessão) |
| `RegistroRotina` | Log das rotinas e do relógio simulado |
| `Instrucao` | Instruções de atendimento do bot (título, texto, ordem, ativa, versão anterior) |

## Telas (`src/app/(app)`)
| Arquivo | Tela |
|---|---|
| `src/app/layout.tsx` | Layout raiz (fonte, tema) |
| `src/app/globals.css` | Estilos globais |
| `src/app/tokens.css` | Design tokens: todas as cores, sombras, raios e espaços (claro e escuro) |
| `src/app/login/page.tsx` | Login |
| `src/app/(app)/layout.tsx` | Moldura das telas logadas: exige login e põe cabeçalho, avisos e versão dos dados |
| `src/app/(app)/page.tsx` | Kanban |
| `src/app/(app)/lead/[id]/page.tsx` | Ficha do lead |
| `src/app/(app)/agenda/page.tsx` | Agenda |
| `src/app/(app)/painel/page.tsx` | Painel de métricas |
| `src/app/(app)/simulador/page.tsx` | Simulador (chat do cliente fictício) |
| `src/app/(app)/arquivados/page.tsx` | Arquivados |
| `src/app/(app)/configuracoes/page.tsx` | Configurações (só admin) |

## API (`src/app/api`) → serviço que usa
| Rota | O que faz | Serviço |
|---|---|---|
| `src/app/api/login/route.ts` | Entrar | `lib/sessao` |
| `src/app/api/versao/route.ts` | Contador de mudanças (as telas recarregam) | `lib/versao` |
| `src/app/api/kanban/route.ts` | Cards do quadro (já ordenados) | `consultas`, `rotinas` |
| `src/app/api/aguardando/route.ts` | Leads esperando um humano (consultor: os dele; admin: todos) e os prazos de cor. Alimenta o contador do topo, a lista e a cor dos cards | `consultas`, `configuracoes` |
| `src/app/api/leads/[id]/route.ts` | Ficha e correção de dados | `consultas`, `leads`, `historico` |
| `src/app/api/leads/[id]/conversa/route.ts` | Assumir, devolver ao bot, responder, marcar como vista (zera a bolinha) | `conversa` |
| `src/app/api/leads/[id]/medidas/route.ts` | Medidas | `leads`, `historico` |
| `src/app/api/leads/[id]/notas/route.ts` | Notas internas | `historico` |
| `src/app/api/leads/acoes/route.ts` | Mover, arquivar, excluir em lote | `leads` |
| `src/app/api/arquivados/route.ts` | Lista de arquivados | `consultas`, `rotinas` |
| `src/app/api/agenda/route.ts` | Agenda, visitas, bloqueios | `agenda`, `consultas` |
| `src/app/api/painel/route.ts` | Métricas (atalho ou datas, vendedor só para admin) | `painel` |
| `src/app/api/nova-mensagem/route.ts` | Mensagem para qualquer número (MSG) | `conversa`, `leads`, `consultas` |
| `src/app/api/simulador/route.ts` | Chat do cliente fictício | `conversa`, `mensagens`, `consultas` |
| `src/app/api/relogio/route.ts` | Avançar o relógio e rodar rotinas | `rotinas` |
| `src/app/api/teste/route.ts` | Interface de teste (`npm run simular`, cliente-simulado) | `conversa`, `rotinas`, `consultas` |
| `src/app/api/equipe/status/route.ts` | Consultor online/almoço | `distribuicao` |
| `src/app/api/midias/[nome]/route.ts` | Serve fotos/plantas (só logado) | `lib/midias` |
| `src/app/api/configuracoes/route.ts` | Dados da tela de Configurações (inclui o período padrão da exportação) | `configuracoes`, `distribuicao` |
| `src/app/api/configuracoes/exportar-desempenho/route.ts` | Exporta .zip de desempenho de um vendedor (até 30 dias, mídia opcional). Só admin | `exportacao` |
| `src/app/api/configuracoes/distribuicao/route.ts` | Modo de distribuição | `configuracoes` |
| `src/app/api/configuracoes/prazos-espera/route.ts` | Prazos amarelo e vermelho da espera do cliente (minutos, PROVISÓRIO). Só admin | `configuracoes` |
| `src/app/api/configuracoes/layout-ficha/route.ts` | Layout padrão da ficha (chave `layout_ficha` em `Configuracao`) | `regras/layout-ficha` |
| `src/app/api/configuracoes/instrucoes/route.ts` | Listar e criar instruções | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/[id]/route.ts` | Editar, ativar/desativar, excluir | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/[id]/voltar/route.ts` | Voltar para a versão anterior | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/reordenar/route.ts` | Reordenar | `instrucoes` |
| `src/app/api/configuracoes/instrucoes/exportar/route.ts` | Exportar .txt ou .zip | `instrucoes`, `lib/zip` |

## Serviços (`src/servicos`) – gravam no banco
| Arquivo | Faz |
|---|---|
| `src/servicos/leads.ts` | Criar lead, mover etapa, etiquetas, campos, arquivar, restaurar, excluir |
| `src/servicos/mensagens.ts` | Registrar mensagem do cliente e da loja, status (entregue/lido). Mantém `esperandoDesde` e `naoLidas`: mensagem do cliente com lead aguardando humano abre a espera e soma a bolinha; resposta do consultor encerra |
| `src/servicos/conversa.ts` | Mensagem do cliente → bot; assumir, devolver (encerra a espera), responder como consultor, marcar conversa como vista |
| `src/servicos/agenda.ts` | Horários livres, agendar, cancelar visita, bloqueios |
| `src/servicos/distribuicao.ts` | Escolher consultor (rodízio ou menos leads), fila, status almoço |
| `src/servicos/configuracoes.ts` | Ler/gravar configurações, modo de distribuição, prazos de espera |
| `src/servicos/instrucoes.ts` | Instruções do bot: carga inicial, CRUD, versão anterior, exportar |
| `src/servicos/exportacao.ts` | Monta o .zip de desempenho do vendedor: resumo, leads, mudanças de etapa, uma conversa por lead, mídias (opcional). Sem telefone/nome do cliente. Bot e consultor separados |
| `src/servicos/consultas.ts` | Dados prontos para as telas (kanban, ficha, agenda, arquivados, lista de aguardando). O kanban sai ordenado: quem espera resposta primeiro, depois pela última mensagem |
| `src/servicos/painel.ts` | Dados do Painel por período e vendedor: contadores anônimos (geral) ou leads do vendedor, funil e tempo de resposta (bot e consultor) |
| `src/servicos/resumo.ts` | Resumo da ficha para o consultor copiar |
| `src/servicos/historico.ts` | Registro de quem mudou o quê |
| `src/servicos/metricas.ts` | Contadores anônimos |
| `src/servicos/rotinas.ts` | Retomada, "Sem resposta", limpeza de arquivados, relógio |

## Regras puras (`src/regras`)
| Arquivo | Regra |
|---|---|
| `src/regras/etapas.ts` | Colunas do kanban, etiquetas, classificações, cidades atendidas |
| `src/regras/agenda.ts` | Horário da loja, duração, vagas (PROVISÓRIO) |
| `src/regras/retomada.ts` | Quando retomar e quando ir para "Sem resposta" |
| `src/regras/janela24h.ts` | Texto livre só até 24h depois do cliente (Meta) |
| `src/regras/modelos.ts` | Modelos de mensagem aprovados (fictícios) |
| `src/regras/distribuicao.ts` | Modos de distribuição de leads |
| `src/regras/espera.ts` | Espera do cliente por um humano: faixa (normal, amarelo, vermelho), prazos padrão PROVISÓRIOS (10 e 30 min), validação, texto "12 min", ordem das colunas |
| `src/regras/almoco.ts` | Aviso ao cliente durante o almoço do consultor |
| `src/regras/permissoes.ts` | Quem pode o quê |
| `src/regras/layout-ficha.ts` | Grade da ficha do lead |
| `src/regras/limites.ts` | Limites usados na tela e no servidor (tamanho máximo de imagem) |
| `src/regras/limpeza.ts` | Quando um arquivado é excluído (30 dias) |
| `src/regras/exportacao.ts` | Exportação de desempenho: período (máx. 30 dias), CSV |
| `src/regras/tempo-resposta.ts` | Tempo de resposta: por turno do cliente (bot ou consultor primeiro), do consultor em toda resposta (ignora o bot), 1ª resposta do consultor depois do repasse do bot; média/mediana e formatar duração. Usado pelo Painel e pela exportação |
| `src/regras/painel.ts` | Período do Painel: atalhos (hoje, 7 dias, 30 dias, semana, mês), datas livres, período anterior do mesmo tamanho |
| `src/regras/telefone.ts` | Telefone E.164 |
| `src/regras/tempo.ts` | Fuso de Fortaleza e contas de data |

## Bot (`src/bot`)
| Arquivo | Faz |
|---|---|
| `src/bot/atendimento.ts` | Chama a API do Claude (modelo, histórico, cache, laço de ferramentas) |
| `src/bot/prompt.ts` | Monta o prompt: instruções (banco) + `agente/loja.md` + `agente/complemento-crm.md` |
| `src/bot/ferramentas.ts` | Esquemas das ferramentas e validação |
| `src/bot/executor.ts` | Executa cada ferramenta (grava no CRM) |
| `src/bot/saida.ts` | Limpa o texto do bot antes de ir ao cliente |

## Componentes (`src/componentes`)
| Arquivo | Faz |
|---|---|
| `src/componentes/ui.tsx` | Peças comuns: Botao, Modal, Campo, Avatar, Etiqueta, estados vazio/erro |
| `src/componentes/dados.tsx` | `chamarApi`, `useDados` (recarrega com a versão), avisos (toasts) |
| `src/componentes/estilos.ts` | Cores por código e `juntar` |
| `src/componentes/cabecalho.tsx` | Menu superior (inclui o contador "X aguardando você") |
| `src/componentes/espera.tsx` | Espera do cliente na tela: provedor (uma consulta a `/api/aguardando` para a tela toda), hora do servidor, tempo e faixa de cor, classes de cor |
| `src/componentes/aguardando.tsx` | Botão "X aguardando você" no topo e a lista que ele abre |
| `src/componentes/usuario.tsx` | Usuário logado no contexto |
| `src/componentes/tema.tsx` | Tema claro/escuro |
| `src/componentes/tema-script.ts` | Script do tema (lido pelo layout do servidor) |
| `src/componentes/texto.ts` | Formatação de texto |
| `src/componentes/chat.tsx` | Bolhas de conversa |
| `src/componentes/almoco.tsx` | Botão de almoço do consultor |
| `src/componentes/nova-mensagem.tsx` | Janela de nova mensagem |
| `src/componentes/arquivados.tsx` | Lista de arquivados |
| `src/componentes/kanban/quadro.tsx` | Quadro com arrastar e soltar, busca e filtros (inclui "Esperando resposta" e "Meus leads") |
| `src/componentes/kanban/card.tsx` | Card do lead: cor por espera, "esperando há X min", bolinha de não lidas |
| `src/componentes/kanban/bolinha.tsx` | Bolinha verde com o número de mensagens não lidas |
| `src/componentes/kanban/zoom.ts` | Zoom do quadro |
| `src/componentes/ficha/ficha.tsx` | Ficha: grade arrastável (PC) e abas (celular). Com a aba visível, marca a conversa como vista (zera as não lidas) |
| `src/componentes/ficha/dados-lead.tsx` | Blocos de dados da ficha |
| `src/componentes/ficha/conversa.tsx` | Conversa na ficha |
| `src/componentes/ficha/agendar.tsx` | Agendar/remarcar pela ficha |
| `src/componentes/agenda/agenda.tsx` | Grade da agenda |
| `src/componentes/painel/painel.tsx` | Painel de métricas: atalhos e datas, filtro de vendedor (admin), tempo médio de resposta, funil |
| `src/componentes/simulador/simulador.tsx` | Tela do simulador |
| `src/componentes/simulador/relogio.tsx` | Controle do relógio simulado |
| `src/componentes/configuracoes/configuracoes.tsx` | Configurações (abas Geral, Instruções e Exportar desempenho). A Geral tem distribuição, prazos de espera e equipe |
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
| `src/lib/midias.ts` | Fotos e plantas fora da pasta pública |
| `src/lib/json.ts` | `lerLista`/`gravarLista`: listas guardadas como JSON em texto (SQLite) |
| `src/lib/zip.ts` | Gerador de .zip simples, texto ou binário (exportar instruções e desempenho) |
| `prisma/seed.ts` | Dados fictícios (apaga tudo e recria) |
| `scripts/simular.ts` | `npm run simular`: conversa com o bot pelo terminal |
| `scripts/gerar-planta.ts` | Gera a planta fictícia de teste |

## Testes
| Arquivo | Cobre |
|---|---|
| `testes/unit/regras.test.ts` | Regras puras (24h, retomada, agenda, permissões) |
| `testes/unit/fluxos.test.ts` | Fluxos com banco: retomada, distribuição, agenda, mensagens |
| `testes/unit/instrucoes.test.ts` | Instruções: carga, edição, versão anterior, exclusão, zip |
| `testes/unit/painel.test.ts` | Painel: período, duração, filtro por vendedor, tempo de resposta |
| `testes/unit/exportacao.test.ts` | Exportação de desempenho: período, tempo de resposta, CSV, zip por vendedor |
| `testes/unit/espera.test.ts` | Espera do cliente: faixas, ordem das colunas, não lidas, fim da espera, prazos, lista de aguardando |
| `testes/unit/mapa.test.ts` | Este mapa está completo e sem arquivo fantasma |
| `testes/unit/ajuda.ts` | Limpar banco e criar consultores de teste |
| `testes/unit/preparar.ts` | Cria o banco só dos testes |
| `testes/e2e/telas.spec.ts` | Telas no computador e no celular, com prints |

## Fora do código
- `agente/complemento-crm.md`: regras do CRM para o bot (vale sobre as instruções). `agente/loja.md`: dados comerciais (cópia do projeto do WhatsApp). `agente/instrucoes/`: só a carga inicial.
- `tarefas/`: tarefas numeradas do Bloco 1 (avisos e leads esperando resposta), uma por vez.
- `docs/`: `briefing.md`, `requisitos.md`, `design.md`, `rodadas/` (relatórios). `.claude/agents` e `.claude/skills`: revisores e comandos.
