# CRM Eccellenza – simulador

CRM com atendimento por IA (API do Claude) para a Eccellenza. Nesta fase roda só no computador, **sem WhatsApp real** e **só com dados fictícios**.

## Estado atual (31/10/2026)
- **Etapa 1 (funcionar) construída.** Todos os requisitos E1 implementados, com testes automáticos de regras e de tela. Detalhes, pendências e itens PROVISÓRIOS em [`docs/rodadas/03-final-etapa-1.md`](docs/rodadas/03-final-etapa-1.md).
- **Decidido:** depois de passar o lead ao consultor, o bot fica em pausa total naquela conversa (provisório; revisitar nas próximas etapas).
- **Aguardando decisão do Mateus:** regras da agenda (visitas simultâneas, feriados, distribuição de leads), textos da retomada e dos modelos de mensagem, prazo até "Parou de responder", faixa para "só portas", nomes das colunas.
- **Etapa 2 (layout profissional):** só começa quando o Mateus liberar.

## Pronto para produção (03/11/2026)
O código já está preparado para o Railway e para o WhatsApp oficial da Meta: webhook, envio, Postgres, rotinas automáticas, login protegido, LGPD e limites do bot. **O que falta depende de você** (contas Railway e Meta, chaves, aprovação de textos): passo a passo em [`docs/colocar-no-ar.md`](docs/colocar-no-ar.md). No seu computador nada muda: o simulador continua igual.

**O que ainda falta fazer:** [`docs/pendencias.md`](docs/pendencias.md).

## Como rodar (passo a passo)
1. Tenha o **Node.js 20 ou mais novo** instalado.
2. Confira se o arquivo `.env` na raiz tem a sua chave (copie do `.env.example` se não tiver):
   ```
   ANTHROPIC_API_KEY=sua-chave-aqui
   ```
   O `.env` nunca vai para o Git. Sem a chave o sistema funciona, mas o bot avisa que não pode responder.
3. No terminal, dentro da pasta do projeto:
   ```
   npm install
   npm run seed
   npm run dev
   ```
   **No dia a dia (e nos computadores da loja), use a versão final:** dê dois cliques em `iniciar-crm.bat`. Ele gera a versão otimizada e abre o navegador. O `npm run dev` é só para programar e deixa o computador lento (principalmente com 8 GB de memória).
4. Abra **http://127.0.0.1:3000** e entre com um dos usuários de teste:

   | Usuário | Senha | Perfil |
   |---|---|---|
   | `mateus` | `mateus123` | Administrador (único que exclui) |
   | `rafael` | `rafael123` | Consultor (fictício) |
   | `beatriz` | `beatriz123` | Consultora (fictícia) |

   São senhas só do simulador. Antes de qualquer uso real, isso será trocado.

`npm run seed` apaga tudo e recria os dados de exemplo. Use quando quiser recomeçar do zero.

## O que testar primeiro
1. **Simulador** (menu Simulador): clique em **Novo**, invente um nome e converse como cliente ("Oi, quero fazer minha cozinha"). Em outra aba, deixe o **Kanban** aberto: o card aparece e muda de coluna sozinho.
2. **Foto de planta**: no simulador, use o botão de imagem e envie `testes/imagens/planta-cozinha.png`. O bot confirma as medidas e grava na ficha.
3. **Agenda**: o bot não agenda; ele convida para a loja e passa ao consultor. Na ficha (ou arrastando o card para Medição/Apresentação) o consultor marca visita à loja, medição ou apresentação. Veja em **Agenda**.
4. **Ficha do lead**: clique num card. Tem o resumo pronto para copiar, os dados (dá para corrigir), medidas, visita, notas e o histórico de quem mudou o quê. Em **Assumir conversa** o bot para de responder; **Devolver ao bot** volta.
5. **Relógio** (no Simulador, à direita): avance **+3 dias** para ver a retomada e mais **+4 dias** para o card ir a "Perdido" (motivo "Parou de responder").
6. **Nova mensagem** (botão no topo): digite um número qualquer. Para número novo só dá para mandar modelo aprovado (regra das 24h da Meta). Números terminados em `0000` simulam "sem WhatsApp" (status falhou).
7. **Limpeza**: selecione cards (botão **Selecionar**) e arquive. Em **Arquivados** dá para restaurar. Entrando como consultor, o botão de excluir não aparece.

## Comandos
| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o sistema em http://127.0.0.1:3000 (só neste computador) |
| `npm run seed` | Recria o banco com dados fictícios |
| `npm test` | Testes automáticos das regras (24h, retomada, 30 dias, permissões, agenda) |
| `npm run test:tela` | Testes de tela no computador e no celular, com prints em `docs/rodadas/evidencias/telas/` (o sistema sobe sozinho) |
| `npm run lint` / `npm run tipos` | Verificação do código |
| `npm run simular -- mensagem +5588900001234 "Oi" --nome "Ana"` | Conversa com o bot pelo terminal (o sistema precisa estar rodando) |
| `npm run simular -- lead +5588900001234` | Mostra a ficha do lead |
| `npm run simular -- relogio 72` | Avança o relógio 72 horas e roda as rotinas |

A primeira vez que rodar `npm run test:tela`, instale o navegador de teste dentro do projeto: `set PLAYWRIGHT_BROWSERS_PATH=0&& npx playwright install chromium` (Windows).

## Onde fica cada coisa
Mapa completo, arquivo por arquivo: [`docs/mapa-do-codigo.md`](docs/mapa-do-codigo.md). Resumo por pasta:

| Pasta / arquivo | O que é |
|---|---|
| `src/app` | Telas e rotas da API |
| `src/componentes` | Partes das telas (kanban, ficha, agenda, simulador, painel) |
| `src/regras` | Regras do negócio puras (24h, retomada, agenda, permissões, etapas) |
| `src/servicos` | Regras que gravam no banco (leads, mensagens, agenda, rotinas, métricas) |
| `src/bot` | O bot: monta o prompt a partir das instruções do banco (tela de Configurações) e executa as ferramentas |
| `src/app/tokens.css` | Todas as cores, sombras, raios e espaçamentos |
| `prisma/` | Banco (SQLite) e dados de exemplo |
| `midias/` | Fotos e plantas enviadas (fora da pasta pública; só com login) |
| `docs/` | Briefing, requisitos, design e relatórios de cada rodada |

## Arquivos de trabalho
- `/ciclo etapa 1` – constrói e revisa o sistema em rodadas (relatórios em `docs/rodadas/`).
- `/ciclo etapa 2` – layout profissional com animações (só depois de aprovar a etapa 1).
