// Contrato do bot (tarefa 38): retrato, sem código, de tudo o que o bot recebe, pode fazer e o que o sistema faz por ele.
// Gera docs/contrato-do-bot.md (npm run contrato:bot), lido pelo agente que escreve as instruções no outro repositório.
// Função pura: monta o texto a partir das MESMAS constantes e funções que o bot usa. Sem data no texto, para o teste
// conseguir comparar o arquivo com o código.
import { AVISO_ALMOCO } from "@/regras/almoco";
import { REGRAS_AGENDA_PADRAO } from "@/regras/agenda";
import { CLASSIFICACOES } from "@/regras/etapas";
import { LIMITE_POR_DIA, LIMITE_POR_MINUTO } from "@/regras/limite-bot";
import { descricaoDoTipo } from "@/regras/midia";
import { buscarModelo, MODELOS } from "@/regras/modelos";
import { REGRAS_RETORNO_PADRAO } from "@/regras/retorno-fechada";
import { DIAS_PARA_RETOMADA } from "@/regras/retomada";
import { REGRAS_DESCLASSIFICADOS_PADRAO } from "@/regras/desclassificados";
import { REGRAS_RECUPERACAO_PADRAO } from "@/regras/recuperacao";
import { PEDIDOS_PARA_PARAR, TEXTO_CONFIRMA_PARAR } from "@/regras/optout";
import { descreverHorarioDeFuncionamento, situacaoDaLoja } from "@/regras/presenca";
import { formatarDataHora, formatarDiaSemana } from "@/regras/tempo";
import { AUDIO_NAO_PROCESSADO, AUDIO_NAO_TRANSCRITO, NAO_ENTENDIDO, NAO_ENTENDIDO_OUTRO, PREFIXO_AUDIO } from "@/regras/whatsapp";
import { ABERTURA_DO_PROMPT, avisoArquivoNaoLido, avisoDoTurno, avisoImagem, avisoMensagemEnviada, mensagemDoCliente } from "./avisos";
import { FERRAMENTAS } from "./ferramentas";
import { MANUAL_INICIAL } from "./manual-inicial";
import { SEM_RESPOSTA } from "./saida";

type Esquema = { type?: string; description?: string; enum?: readonly string[]; items?: Esquema; properties?: Record<string, Esquema>; required?: readonly string[] };

const bloco = (texto: string) => ["```", texto, "```"].join("\n");

// Exemplos fixos (horário de Fortaleza = UTC-3), para o texto gerado não mudar de um dia para o outro.
const SABADO_15H20 = new Date("2026-11-07T18:20:00Z");
const TERCA_10H = new Date("2026-11-10T13:00:00Z");

function avisoExemplo(instante: Date, primeiraVez: boolean): string {
  return avisoDoTurno({ diaSemana: formatarDiaSemana(instante), dataHora: formatarDataHora(instante), situacaoLoja: situacaoDaLoja(instante, REGRAS_AGENDA_PADRAO), primeiraVez, nomePerfil: "Ana Paula" });
}

function tipoDoCampo(e: Esquema): string {
  if (e.enum) return `uma destas opções: ${e.enum.map((o) => `\`${o}\``).join(", ")}`;
  if (e.type === "array") return e.items?.type === "object" ? "lista (cada item abaixo)" : "lista de textos";
  if (e.type === "boolean") return "sim/não (true/false)";
  return "texto";
}

function linhasDeCampos(props: Record<string, Esquema>, obrigatorios: readonly string[], prefixo = ""): string[] {
  return Object.entries(props).flatMap(([nome, e]) => {
    const linha = `| \`${prefixo}${nome}\` | ${obrigatorios.includes(nome) ? "sim" : "não"} | ${tipoDoCampo(e)} | ${(e.description ?? "").replace(/\|/g, "/")} |`;
    const filhos = e.type === "array" && e.items?.properties ? linhasDeCampos(e.items.properties, e.items.required ?? [], `${prefixo}${nome}[].`) : [];
    return [linha, ...filhos];
  });
}

function secaoFerramentas(): string[] {
  const linhas: string[] = ["## 3. Ferramentas (o que o bot pode gravar ou fazer)", "", "Só o que o bot registra com uma ferramenta fica no CRM. Não existe outra ação além destas (o bot não agenda nada)."];
  let anterior: { nome: string; campos: string } | null = null;
  for (const f of FERRAMENTAS) {
    const esquema = f.input_schema as Esquema;
    linhas.push("", `### \`${f.name}\``, "", f.description ?? "");
    const props = esquema.properties ?? {};
    const campos = JSON.stringify(esquema);
    if (anterior && anterior.campos === campos) {
      linhas.push("", `Mesmos campos de \`${anterior.nome}\`.`);
      continue;
    }
    anterior = { nome: f.name, campos };
    if (Object.keys(props).length === 0) {
      linhas.push("", "Sem campos.");
      continue;
    }
    linhas.push("", "| Campo | Obrigatório | Tipo | Para que serve |", "|---|---|---|---|", ...linhasDeCampos(props, esquema.required ?? []));
    if (f.name === "classificar_lead") {
      linhas.push("", "Nome de cada classificação no CRM:", ...Object.entries(CLASSIFICACOES).map(([codigo, nome]) => `- \`${codigo}\`: ${nome}`));
    }
  }
  return linhas;
}

export function montarContratoDoBot(): string {
  const partes: string[] = [
    "# Contrato do bot – CRM Eccellenza",
    "",
    "> Gerado automaticamente pelo CRM (`npm run contrato:bot`) a partir do código. **Não edite à mão.**",
    "> Descreve o que o bot recebe, o que ele pode fazer e o que o sistema faz sozinho. É a única fonte sobre o CRM para quem escreve as instruções numeradas.",
    "> Se uma instrução precisar de algo que não está aqui, peça ao projeto do CRM.",
    "",
    "## 1. Como o prompt do bot é montado",
    "",
    "Em cada resposta o bot recebe, nesta ordem:",
    "1. A abertura fixa (não editável):",
    "",
    bloco(ABERTURA_DO_PROMPT.join("\n")),
    "",
    "2. `# Instruções de atendimento`: as instruções numeradas **ativas**, em ordem de número, como foram importadas em Configurações > Instruções de atendimento.",
    "3. `# Manual do CRM`: o texto do Manual (seção 5).",
    "",
    "Sem nenhuma instrução ativa o bot não atende: o cliente vai direto ao consultor.",
    "Tudo o que o bot escreve vai ao cliente exatamente como está (ver a limpeza na seção 4).",
    "",
    "## 2. O que chega a cada mensagem",
    "",
    "Mensagens seguidas do cliente chegam juntas, numa vez só. Texto do cliente vem entre `<cliente>`; aviso do sistema, entre `<sistema>`. Exemplos exatos:",
    "",
    "**Começo de cada vez** (data, hora e situação da loja; o nome do perfil do WhatsApp só na primeira mensagem, e pode não ser o nome real):",
    "",
    bloco(avisoExemplo(SABADO_15H20, true)),
    "",
    "Com a loja aberta, numa mensagem seguinte:",
    "",
    bloco(avisoExemplo(TERCA_10H, false)),
    "",
    "**Texto do cliente:**",
    "",
    bloco(mensagemDoCliente("Quero orçamento de uma cozinha")),
    "",
    "**Áudio** (transcrito automaticamente quando a transcrição está ligada):",
    "",
    bloco(mensagemDoCliente(`${PREFIXO_AUDIO}quero orçamento de uma cozinha`)),
    "",
    "Se a transcrição falhar ou estiver desligada, o bot recebe um destes textos:",
    "",
    bloco([AUDIO_NAO_PROCESSADO, AUDIO_NAO_TRANSCRITO, NAO_ENTENDIDO.audio].map((t) => mensagemDoCliente(t)).join("\n")),
    "",
    "**Imagem:** o bot vê a imagem e recebe logo depois:",
    "",
    bloco(avisoImagem("essa é a parede da cozinha")),
    "",
    "**Vídeo, PDF, Word, Excel, DWG, ZIP e outros arquivos:** o bot **não** vê o conteúdo; só sabe que chegou. Exemplos:",
    "",
    bloco([avisoArquivoNaoLido(descricaoDoTipo("application/pdf"), "planta-apto.pdf", null), avisoArquivoNaoLido(descricaoDoTipo("video/mp4"), null, "olha o espaço")].join("\n")),
    "",
    "**Figurinha, localização, contato e outros tipos:**",
    "",
    bloco([NAO_ENTENDIDO.sticker, NAO_ENTENDIDO.location, NAO_ENTENDIDO.contacts, NAO_ENTENDIDO_OUTRO].map((t) => mensagemDoCliente(t)).join("\n")),
    "",
    "**Mensagem enviada ao cliente por um consultor ou pelo sistema** (o bot é avisado):",
    "",
    bloco(
      [
        avisoMensagemEnviada({ autor: "consultor", autorNome: "Carlos", rotuloArquivo: null, texto: "Bom dia! Aqui é o Carlos, da Eccellenza." }),
        avisoMensagemEnviada({ autor: "sistema", autorNome: null, rotuloArquivo: null, texto: buscarModelo("retomada")?.texto ?? "" }),
      ].join("\n"),
    ),
    "",
    ...secaoFerramentas(),
    "",
    "## 4. O que o sistema faz sozinho (o bot não precisa nem deve fazer)",
    "",
    // Comportamentos descritos à mão (não são texto no código). Revisar quando o comportamento mudar.
    `- **Horário da loja:** vem da agenda (Configurações). Padrão de fábrica: ${descreverHorarioDeFuncionamento(REGRAS_AGENDA_PADRAO)}. O bot recebe a situação pronta a cada mensagem (seção 2).`,
    "- **Depois de `passar_para_consultor`:** o card vai para \"Em qualificação\" com o consultor do rodízio e o bot fica em **pausa total** nessa conversa. Ele não responde mais, nem se o cliente voltar a escrever.",
    "- **Consultor assumiu a conversa:** o bot para na hora, mesmo no meio de uma resposta (o que ele ia enviar não é enviado).",
    `- **PARAR:** se a mensagem inteira do cliente for um destes pedidos (sem acento e sem pontuação), o sistema responde sozinho e o bot não responde mais esse cliente: ${PEDIDOS_PARA_PARAR.map((p) => `"${p}"`).join(", ")}. O botão "Não tenho interesse" do modelo de retorno vale igual. Resposta do sistema: "${TEXTO_CONFIRMA_PARAR}". Frase comprida com a palavra (ex.: "quero parar de pagar aluguel") não conta.`,
    `- **Limite de mensagens:** se o cliente mandar mais de ${LIMITE_POR_MINUTO} mensagens em 1 minuto ou mais de ${LIMITE_POR_DIA} em 24 horas, o bot pausa e a conversa vai para um humano.`,
    `- **Não responder:** se o bot responder exatamente \`${SEM_RESPOSTA}\`, nada é enviado.`,
    "- **Limpeza da resposta:** antes de enviar, o sistema apaga linhas que parecem anotação interna: linha inteira entre colchetes, \"Nota:\", \"nota interna\", \"Instrução 07…\", \"…insistência:\" e tags `<cliente>`/`<sistema>`. Se sobrar nada, a conversa vai para um humano.",
    "- **Falha da IA** (sem chave, recusa, resposta longa demais, repetição): a conversa vai para um humano com aviso no card.",
    `- **Horário de \`registrar_retorno\`:** a ferramenta funciona com a loja aberta ou fechada; o sistema só confere se o horário pedido é futuro e cai dentro do funcionamento. \`quando\` fora do formato AAAA-MM-DD HH:MM (ex.: "manhã", "à tarde", "depois das 3") é tratado como **sem horário**: o sistema grava a próxima abertura da loja + ${REGRAS_RETORNO_PADRAO.semHorarioMin} minutos (com a loja aberta, a abertura seguinte é a do próximo dia de funcionamento). Para período, as instruções precisam dizer qual hora o bot deve usar.`,
    `- **Retorno com a loja fechada (depois de \`registrar_retorno\`):** o card fica com o horário do retorno para o consultor. Sem horário escolhido pelo cliente, o sistema usa a reabertura da loja + ${REGRAS_RETORNO_PADRAO.semHorarioMin} minutos (padrão de fábrica; o Mateus pode mudar em Configurações), por isso o bot deve confirmar ao cliente o horário que a ferramenta devolveu, sem calcular por conta própria. No horário do retorno, se a janela de 24h da Meta já tiver fechado (o cliente não escreveu nas últimas 24h), o sistema envia sozinho o modelo "${buscarModelo(REGRAS_RETORNO_PADRAO.modelo)?.nome ?? REGRAS_RETORNO_PADRAO.modelo}" se o consultor dono do lead estiver online; senão passa o lead a quem estiver online; sem ninguém online, espera e avisa a equipe. Com a janela aberta, não envia modelo: o consultor responde normalmente. O envio automático pode ser desligado em Configurações; aí o consultor recebe o aviso e envia.`,
    `- **Quem recebe a resposta às mensagens automáticas:** só a "${buscarModelo("retomada")?.nome ?? "retomada"}" chega a um lead que ainda está com o bot (lead na primeira coluna, sem resposta do cliente há ${DIAS_PARA_RETOMADA} dias, uma vez só; nunca para lead classificado como \`pos_venda\`, que também não vai sozinho para Perdido); quando o cliente responde, o bot continua a conversa e vê o texto da retomada no aviso \`<sistema>\`. Os outros modelos são enviados pelo consultor (o que o tira do bot) ou vão para lead já passado ao consultor: a resposta do cliente fica com o consultor e o bot não responde.`,
    `- **Recuperação de leads (desligada de fábrica; o Mateus liga em Configurações):** se a última mensagem da conversa foi nossa e o cliente ficou em silêncio, o sistema envia sozinho, como texto livre e só dentro da janela de 24h, até 2 mensagens: a 1ª depois de ${REGRAS_RECUPERACAO_PADRAO.primeiraMin} minutos e a 2ª (opcional, o Mateus pode desligar) no dia seguinte ou algumas horas depois (padrões provisórios; o Mateus ajusta). Textos de fábrica: 1ª "${REGRAS_RECUPERACAO_PADRAO.primeiraTexto}"; 2ª "${REGRAS_RECUPERACAO_PADRAO.segundaTexto}" (sem nome na ficha, começam com "Oi!"). Só dentro do horário permitido de envio (padrão ${REGRAS_RECUPERACAO_PADRAO.horarioInicio}h às ${REGRAS_RECUPERACAO_PADRAO.horarioFim}h). Se o cliente responder, o que estava pendente é cancelado e o bot continua a conversa, vendo o texto enviado no aviso \`<sistema>\`. ${REGRAS_RECUPERACAO_PADRAO.perdidoHoras} horas depois da última mensagem enviada (a 2ª, ou a 1ª se a 2ª estiver desligada), sem resposta, o card vai sozinho para Perdido com o motivo "Sem resposta (automático)" (volta para a coluna anterior se o cliente escrever depois). Uma vez por lead: quem respondeu e sumiu de novo não recebe mais. Nunca para lead que pediu PARAR, em Perdido ou Fechado, passado ao consultor (bot em pausa) ou classificado como \`pos_venda\`. O bot não envia nem decide nada disso.`,
    `- **Desclassificados (desligada de fábrica; o Mateus liga em Configurações):** lead que continua com o bot e foi classificado como \`outra_cidade\` ou \`curioso\` (que no CRM também vale para cliente sem perfil) não recebe as mensagens de recuperação. ${REGRAS_DESCLASSIFICADOS_PADRAO.horas} horas depois da última mensagem do cliente, o card vai sozinho para Perdido com o motivo "Outra cidade (automático)" ou "Curioso / sem perfil (automático)". Se o cliente escrever depois, o card volta para a coluna anterior e o bot continua a conversa. Não vale para lead passado ao consultor nem para as outras classificações. Por isso a classificação precisa estar certa: \`classificar_lead\` com um desses dois valores tira o cliente do quadro sem nenhum humano olhar. Com a regra desligada, esses leads seguem a recuperação de leads normal.`,
    `- **Mensagens automáticas (modelos aprovados da Meta):** o sistema envia sozinho, conforme as regras do CRM, e o bot é avisado como na seção 2. Textos: ${MODELOS.map((m) => `${m.nome} – "${m.texto}"${m.botoes ? ` (botões: ${m.botoes.map((b) => `"${b}"`).join(", ")})` : ""}`).join("; ")}.`,
    `- **Almoço do consultor:** se o cliente já passado ao consultor escrever enquanto ele almoça, o sistema envia uma vez por almoço: "${AVISO_ALMOCO}"`,
    "",
    "## 5. Manual do CRM",
    "",
    "Texto do Manual no código do CRM. O Manual só muda no código, por proposta aprovada pelo Mateus (decisão de 08/11/2026); o CRM atualiza sozinho o da tela quando ninguém o editou lá. Se a tela do CRM avisar que o Manual está diferente do código, o bot está usando outro texto: avise o Mateus.",
    "",
    bloco(MANUAL_INICIAL),
    "",
  ];
  return partes.join("\n");
}
