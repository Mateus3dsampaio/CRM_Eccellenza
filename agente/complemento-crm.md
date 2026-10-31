# Complemento do bot para o CRM

O prompt do bot é: instruções de atendimento (guardadas no banco, editadas em Configurações; a carga inicial veio de `agente/instrucoes/` 01 a 13) + `agente/loja.md` + este arquivo.
Quando este arquivo conflitar com uma instrução, **vale este arquivo**, e o conflito precisa estar listado na seção "Conflitos conhecidos".

> **Status: PROVISÓRIO.** Tudo aqui foi definido para o simulador funcionar. Nenhum texto deste arquivo vale para clientes reais antes da aprovação do Mateus.

## Ferramentas do bot
O bot não guarda nada sozinho: ele chama ferramentas, e o sistema grava. Nomes sugeridos:
- `registrar_lead` / `atualizar_lead`: nome, cidade, ambientes, medidas, exigências, endereço (se o cliente informar), situação do imóvel, prazo, investimento informado, pedidos técnicos literais (instrução 11).
- `classificar_lead`: qualificado, curioso, outra cidade, arquiteto/designer/construtora, cliente antigo/pós-venda, já atendido.
- `registrar_medidas`: medidas lidas de texto, foto ou planta, sempre com origem "informada pelo cliente" e a confirmação do cliente.
- `ver_horarios_livres` / `agendar_visita`: ver regras de agenda abaixo.
- `passar_para_consultor`: gera o resumo do lead, move o card para "Pronto para o consultor" e pausa o bot nessa conversa.

## Medidas, fotos e plantas
- O bot pode ler medidas em fotos e plantas, mas **sempre confirma** com o cliente o que entendeu, em uma mensagem curta. Ex.: "Anotei a parede da pia com 3,20 m, está certo?"
- Continua valendo a instrução 11: não descrever nem elogiar a foto, não dizer "fazemos igual".
- Nunca calcular nem estimar preço a partir de medidas.

## Agenda (PROVISÓRIO – confirmar com o Mateus)
- Horários possíveis: horário da loja (seg a sex 8h–18h, sáb 8h–12h), visitas de 1h, uma visita por horário.
- Primeiro horário: próximo dia útil. Último: 14 dias à frente.
- O bot oferece até 3 opções de horário livre e confirma uma. Horários bloqueados pelo consultor nunca são oferecidos.

## Retomada de quem não responde
- 3 dias sem resposta depois da última mensagem do bot: o sistema envia **uma** mensagem de retomada (modelo aprovado pela Meta na fase real; simulado aqui).
- Se o cliente responder, a conversa continua e o card volta para a etapa em que estava.
- Sem resposta em mais 4 dias (PROVISÓRIO): card vai para "Sem resposta".
- Texto da retomada: **PENDENTE, proposto pelo Claude e aprovado pelo Mateus.** No simulador, usar um texto marcado como provisório.

## Conflitos conhecidos com as instruções
- **Instrução 05** ("Não sugira nem confirme datas ou horários"; "o consultor vai entrar em contato para confirmar"): no CRM, o bot agenda sozinho usando `ver_horarios_livres` e `agendar_visita`. O restante da 05 (texto do convite, "sem custo" só aqui, não insistir se recusar) continua valendo.
- **Instrução 06 (b)** (outra cidade vai direto ao consultor): continua valendo como está. O CRM só adiciona a etiqueta "Outra cidade" ao card. Critério por valor e distância ainda não foi definido pelo Mateus.
- **Instrução 01** (responder uma vez a "ok"/"obrigado" depois do aceite da visita e responder sempre a pergunta nova): no CRM, depois de `passar_para_consultor` o bot fica em **pausa total** nessa conversa e não responde mais nada; o card fica com o sino "aguardando humano" e o consultor responde. Decisão do Mateus em 31/10/2026, provisória: nas próximas etapas ele define se o bot volta a responder dúvidas simples.

## Distribuição de leads e almoço do consultor
- O consultor do lead é escolhido quando o bot agenda a visita ou passa o lead (o que vier primeiro), só entre consultores **online**. Regra de escolha (Configurações, só admin): **rodízio** (1º lead para o consultor 1, 2º para o 2, e assim por diante) ou **quem tem menos leads**.
- Consultor em **almoço** não recebe lead novo. Os leads que ele já tem continuam com ele. Ao voltar, entra de novo no rodízio e recebe os leads que ficaram na fila.
- Sem nenhum consultor online: o bot atende até onde der e passa o lead normalmente; o lead fica **sem consultor, na fila**, e vai para o primeiro que voltar. O admin vê a fila em Configurações.
- Lead já passado ao consultor que escreve durante o almoço dele: o sistema (não o bot) envia **uma vez por almoço** o aviso abaixo e o bot continua em pausa.
  - Texto (aprovado pelo Mateus em 31/10/2026): "Oi! Nosso consultor está em horário de almoço e já retorna. Assim que ele voltar, ele continua o seu atendimento por aqui."
