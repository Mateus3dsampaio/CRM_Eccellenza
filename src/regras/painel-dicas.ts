// Dicas do Painel: o que cada número conta exatamente. Usadas pelo Painel (ícone ⓘ) e pelo arquivo exportado (painel-html.ts).
// Cada texto foi escrito a partir do cálculo (servicos/painel.ts, servicos/painel-dados.ts, regras/tempo-resposta.ts e de onde
// cada contador é gravado). Mudou o cálculo de um número → revise a dica dele aqui.

export const DICAS_DO_PAINEL: Record<string, string> = {
  // Resultado
  em_negociacao:
    "Soma do valor do orçamento dos leads que estão agora em Apresentação agendada ou Negociação (arquivados ficam fora). É a situação de hoje: não muda com o período. Lead sem valor preenchido entra como R$ 0 e aparece em \"sem valor informado\".",
  vendido:
    "Soma do valor fechado dos leads que entraram em Fechado dentro do período (vale a última vez que entraram). Conta também os leads que já foram excluídos.",

  // Leads no período (todos os vendedores)
  lead_novo:
    "Contatos novos que chegaram no período (cada lead conta uma vez). Já desconta os contatos marcados como \"Não é lead\" no período.",
  qualificado:
    "Leads que o bot classificou como Qualificado no período. Conta uma vez por lead. Só entra a classificação feita pelo bot: mudar a classificação à mão na ficha não conta aqui.",
  curioso:
    "Leads que o bot classificou como Curioso no período (sem intenção real de compra agora). Conta uma vez por lead e só a classificação feita pelo bot.",
  outra_cidade:
    "Leads que o bot classificou como Outra cidade (fora da área atendida) no período. Conta uma vez por lead e só a classificação feita pelo bot.",
  parceiro:
    "Leads que o bot classificou como arquiteto, designer ou construtora no período. Conta uma vez por lead e só a classificação feita pelo bot.",
  medicao_agendada:
    "Leads que tiveram a primeira medição marcada na agenda dentro do período (vale o dia em que foi marcada, não o dia da medição). Remarcar não conta de novo.",
  apresentacao_agendada:
    "Leads que tiveram a primeira apresentação marcada na agenda dentro do período (vale o dia em que foi marcada, não o dia da apresentação). Remarcar não conta de novo.",
  retomada_voltou:
    "Clientes que voltaram a escrever enquanto o card tinha a etiqueta \"Retomada enviada\". Hoje essa etiqueta só é posta à mão (a retomada automática saiu em 17/11/2026), então este número tende a ficar em zero.",
  nao_compareceu:
    "Vezes em que uma medição ou apresentação foi remarcada depois que a data já tinha passado: o CRM entende que o cliente faltou. Se a data passou e ninguém remarcou, não conta.",

  // Leads no período (com um vendedor escolhido)
  recebidos:
    "Leads deste vendedor (os que são dele hoje) que chegaram no período. Não conta os marcados como \"Não é lead\" nem os já excluídos.",
  atendidos:
    "Leads deste vendedor em que ele mandou ao menos uma mensagem no período.",

  motivos_perda:
    "Leads que entraram em Perdido no período, separados pelo motivo (inclui os já excluídos). Os descartados (\"Não é lead\") ficam à parte e não contam como perdidos. Quando o motivo pergunta o concorrente, os nomes aparecem embaixo.",

  // Recuperação de leads
  recuperacao_primeira:
    "Leads que receberam a 1ª mensagem automática de recuperação no período: cliente que parou de responder enquanto falava com o bot.",
  recuperacao_segunda:
    "Leads que receberam a 2ª mensagem automática de recuperação no período (não responderam à 1ª).",
  recuperacao_respondeu_primeira:
    "Leads que voltaram a escrever depois da 1ª mensagem de recuperação e antes da 2ª. Conta uma vez por lead.",
  recuperacao_respondeu_segunda:
    "Leads que voltaram a escrever depois da 2ª mensagem de recuperação. Conta uma vez por lead.",
  recuperacao_perdido:
    "Leads que não responderam às mensagens de recuperação e foram para Perdido sozinhos, com o motivo \"Sem resposta (automático)\". Também entram em Motivos de perda.",

  // Automação de leads
  rede_perdido:
    "Leads que a rede de segurança mandou para Perdido no período: ficaram com o bot além do prazo sem mensagem do cliente (prazo em Configurações > Automação de leads). Lead que já passou por um consultor fica de fora.",
  rede_arquivado:
    "Leads de pós-venda que a rede de segurança mandou direto para o arquivo no período, pelo mesmo prazo sem mensagem do cliente.",
  perdido_arquivado:
    "Cards que estavam em Perdido e foram para o arquivo sozinhos no período, depois do prazo configurado em Configurações > Automação de leads.",
  contato_bloqueado:
    "Contatos bloqueados no período, pela IA (quando encerra o contato) ou por alguém na tela. O card vai para o arquivo e mensagens novas só ficam guardadas.",

  // Conversão da agenda
  conversao_medicao:
    "Dos leads com medição marcada no período, quantos também têm apresentação marcada depois dela. Vale o dia em que o compromisso foi marcado. Compromisso cancelado sem remarcar não conta. Inclui leads excluídos.",
  conversao_apresentacao:
    "Dos leads com apresentação marcada no período, quantos estão em Fechado (ou estavam, quando foram excluídos). Vale o dia em que a apresentação foi marcada. Compromisso cancelado sem remarcar não conta.",

  // Janela de 24h
  janelas_abertas:
    "Dos leads ativos agora (fora de Fechado, Perdido e arquivo), quantos estão dentro das 24h desde a última mensagem do cliente. Fora da janela a Meta só deixa mandar modelo aprovado. Situação de agora: não muda com o período.",
  janelas_fechando:
    "Leads ativos com menos de 2 h para a janela de 24h fechar. Embaixo, os que têm entre 2 h e 6 h. Situação de agora: não muda com o período.",

  // Tempo de resposta
  tempo_geral:
    "Do momento em que o cliente escreve (recados seguidos contam como um) até a primeira resposta do bot ou do consultor. Mensagens do sistema e mensagens dispensadas não contam. O relógio corre o dia todo, inclusive à noite e aos domingos. A mediana mostra o caso típico, sem ser puxada por uma demora isolada.",
  tempo_consultor:
    "Toda vez que o cliente escreve e o consultor responde: da primeira mensagem do cliente até a do consultor, ignorando o bot. Se o bot responder no meio, a conta recomeça. Conversa puxada pelo consultor não entra.",
  tempo_primeira_resposta:
    "Da hora em que o bot passou o lead ao consultor até a primeira mensagem do consultor. Embaixo aparece quantos leads estão esperando essa primeira resposta agora.",
  tempo_bot:
    "Tempo de resposta só nas vezes em que o bot respondeu antes do consultor.",

  // Funil e consultores
  funil:
    "Leads que chegaram a cada etapa no período, uma vez por lead. Quem pula etapas conta nas anteriores também (Medição conta como Em qualificação; Negociação como Apresentação). A porcentagem compara com a etapa de cima.",
  funil_vendedor:
    "Para cada lead deste vendedor (os que são dele hoje), a etapa mais avançada que ele alcançou no período; quem chegou longe conta nas etapas anteriores também. A porcentagem compara com a etapa de cima.",
  apresentacoes_por_consultor:
    "Leads que tiveram a primeira apresentação marcada no período, por consultor da apresentação. Remarcar não conta de novo.",

  // Só no arquivo exportado
  perdidos:
    "Leads que entraram em Perdido no período, inclusive os já excluídos. Não inclui os descartados (\"Não é lead\").",
  descartados:
    "Contatos marcados em Perdido com um motivo \"Não é lead\" (pós-venda, parceiro, emprego, canal errado). Não contam como perdidos e saem de Leads novos.",
};

/** Dica de um número do Painel; vazio se não houver. */
export function dicaDoPainel(chave: string): string {
  return DICAS_DO_PAINEL[chave] ?? "";
}
